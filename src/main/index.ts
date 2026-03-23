import { app, BrowserWindow, ipcMain, screen, Tray } from 'electron';
import { join } from 'node:path';
import { ChatService } from './chat-service';
import { ChatSessionStore } from './chat-session-store';
import { CompanionEngine } from './companion-engine';
import { CompanionStateStore } from './companion-state-store';
import { ConfigStore } from './config-store';
import { createAppTray } from './tray';
import { runtimeState } from './runtime-state';
import { WindowStateStore } from './window-state-store';
import { createCompanionWindow, createPanelWindow } from './windows';
import { sanitizeCompanionPrefs, type CompanionEvent, type CompanionRespondInput } from '../shared/companion';

let companionWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let chatSessionStore: ChatSessionStore | null = null;
let windowStateStore: WindowStateStore | null = null;
let companionStateStore: CompanionStateStore | null = null;
let companionEngine: CompanionEngine | null = null;
const PANEL_GAP = 28;

app.setName('Sakurajima');
app.setPath('userData', join(app.getPath('appData'), 'Sakurajima'));

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance) {
  app.quit();
}

function rectsOverlap(
  left: { x: number; y: number; width: number; height: number },
  right: { x: number; y: number; width: number; height: number }
) {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function clampBoundsToWorkArea(
  bounds: { x: number; y: number; width: number; height: number },
  workArea: { x: number; y: number; width: number; height: number }
) {
  return {
    ...bounds,
    x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + Math.max(0, workArea.width - bounds.width)),
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + Math.max(0, workArea.height - bounds.height))
  };
}

function syncCompanionLayering() {
  if (!companionWindow) {
    return;
  }

  const panelVisible = panelWindow?.isVisible() ?? false;
  companionWindow.setAlwaysOnTop(!panelVisible, panelVisible ? 'normal' : 'floating');

  const overlap =
    panelVisible && panelWindow
      ? rectsOverlap(companionWindow.getBounds(), panelWindow.getBounds())
      : false;

  companionWindow.setOpacity(overlap ? 0 : 1);
  companionWindow.setIgnoreMouseEvents(overlap);
}

function positionPanelAwayFromCompanion() {
  if (!panelWindow || !companionWindow || !panelWindow.isVisible() || !companionWindow.isVisible()) {
    return;
  }

  const panelBounds = panelWindow.getBounds();
  const companionBounds = companionWindow.getBounds();

  if (!rectsOverlap(panelBounds, companionBounds)) {
    return;
  }

  const workArea = screen.getDisplayMatching(panelBounds).workArea;
  const candidates = [
    {
      x: companionBounds.x - panelBounds.width - PANEL_GAP,
      y: companionBounds.y,
      width: panelBounds.width,
      height: panelBounds.height
    },
    {
      x: companionBounds.x + companionBounds.width + PANEL_GAP,
      y: companionBounds.y,
      width: panelBounds.width,
      height: panelBounds.height
    },
    {
      x: panelBounds.x,
      y: companionBounds.y + companionBounds.height + PANEL_GAP,
      width: panelBounds.width,
      height: panelBounds.height
    },
    {
      x: panelBounds.x,
      y: companionBounds.y - panelBounds.height - PANEL_GAP,
      width: panelBounds.width,
      height: panelBounds.height
    }
  ];

  for (const candidate of candidates) {
    const clamped = clampBoundsToWorkArea(candidate, workArea);
    if (!rectsOverlap(clamped, companionBounds)) {
      panelWindow.setBounds(clamped);
      return;
    }
  }
}

function showPanel() {
  if (!panelWindow) {
    return { visible: false };
  }

  panelWindow.show();
  syncCompanionLayering();
  positionPanelAwayFromCompanion();
  panelWindow.focus();
  return { visible: true };
}

function togglePanel() {
  if (!panelWindow) {
    return { visible: false };
  }

  if (panelWindow.isVisible()) {
    panelWindow.hide();
    syncCompanionLayering();
    return { visible: false };
  }

  panelWindow.show();
  syncCompanionLayering();
  positionPanelAwayFromCompanion();
  panelWindow.focus();
  return { visible: true };
}

function toggleCompanion() {
  if (!companionWindow) {
    return;
  }

  if (companionWindow.isVisible()) {
    companionWindow.hide();
  } else {
    companionWindow.showInactive();
    syncCompanionLayering();
    positionPanelAwayFromCompanion();
  }
}

function broadcastCompanionEvent(event: CompanionEvent) {
  for (const window of [companionWindow, panelWindow]) {
    if (window && !window.isDestroyed()) {
      window.webContents.send('companion:event', event);
    }
  }
}

function companionUnavailable() {
  return {
    ok: false as const,
    error: {
      code: 'UNKNOWN_ERROR' as const,
      message: 'Companion engine is not ready.',
      retriable: true
    }
  };
}

if (singleInstance) {
  app.on('second-instance', () => {
    if (companionWindow && !companionWindow.isVisible()) {
      companionWindow.showInactive();
    }

    showPanel();
  });

  app.whenReady().then(() => {
    const configStore = new ConfigStore();
    chatSessionStore = new ChatSessionStore();
    companionStateStore = new CompanionStateStore();
    companionEngine = new CompanionEngine(companionStateStore, broadcastCompanionEvent);
    const chatService = new ChatService(configStore, chatSessionStore, () =>
      [companionWindow, panelWindow].filter((window): window is BrowserWindow => Boolean(window)),
      (event) => {
        companionEngine?.handleChatEvent(event);
      }
    );
    windowStateStore = new WindowStateStore();

    ipcMain.handle('app:get-version', () => ({
      version: app.getVersion()
    }));
    ipcMain.handle('chat:send', (_event, message, sessionId) => chatService.send(message, sessionId));
    ipcMain.handle('chat:abort', (_event, sessionId) => chatService.abort(sessionId));
    ipcMain.handle('history:list', () => chatService.listHistory());
    ipcMain.handle('history:get', (_event, sessionId) => chatService.getHistory(sessionId));
    ipcMain.handle('history:clear', (_event, sessionId) => chatService.clearHistory(sessionId));
    ipcMain.handle('settings:load', () => configStore.load());
    ipcMain.handle('settings:save', (_event, config) => configStore.save(config));
    ipcMain.handle('settings:test-connection', (_event, config) => configStore.testConnection(config));
    ipcMain.handle('companion:get-prefs', () => {
      if (!companionEngine) {
        return companionUnavailable();
      }

      return {
        ok: true as const,
        data: companionEngine.getPrefs()
      };
    });
    ipcMain.handle('companion:save-prefs', (_event, input) => {
      if (!companionEngine) {
        return companionUnavailable();
      }

      return companionEngine.savePrefs(sanitizeCompanionPrefs(input));
    });
    ipcMain.handle('companion:list-activities', () => {
      if (!companionEngine) {
        return companionUnavailable();
      }

      return {
        ok: true as const,
        data: companionEngine.listActivities()
      };
    });
    ipcMain.handle('companion:respond', (_event, input: CompanionRespondInput) => {
      if (!companionEngine) {
        return companionUnavailable();
      }

      if (!input || typeof input.promptId !== 'string' || typeof input.actionId !== 'string') {
        return {
          ok: false as const,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Companion response payload is invalid.',
            retriable: false
          }
        };
      }

      return companionEngine.respond(input);
    });
    ipcMain.handle('companion:dismiss', (_event, promptId: string) => {
      if (!companionEngine) {
        return companionUnavailable();
      }

      if (typeof promptId !== 'string' || !promptId.trim()) {
        return {
          ok: false as const,
          error: {
            code: 'VALIDATION_ERROR' as const,
            message: 'Companion prompt id is required.',
            retriable: false
          }
        };
      }

      return companionEngine.dismiss(promptId);
    });
    ipcMain.handle('companion:nudge', () => {
      if (!companionEngine) {
        return companionUnavailable();
      }

      return companionEngine.nudge();
    });
    ipcMain.handle('window:toggle-panel', () => togglePanel());
    ipcMain.handle('window:show-panel', () => showPanel());

    companionWindow = createCompanionWindow(windowStateStore);
    panelWindow = createPanelWindow(windowStateStore);

    panelWindow.on('show', () => {
      syncCompanionLayering();
      positionPanelAwayFromCompanion();
    });
    panelWindow.on('hide', () => {
      syncCompanionLayering();
    });
    companionWindow.on('show', () => {
      syncCompanionLayering();
      positionPanelAwayFromCompanion();
    });

    companionEngine.start();

    setTimeout(() => {
      syncCompanionLayering();
      positionPanelAwayFromCompanion();
    }, 250);

    tray = createAppTray({
      toggleCompanion: () => {
        toggleCompanion();
      },
      showPanel: () => {
        showPanel();
      },
      quit: () => {
        runtimeState.isQuitting = true;
        app.quit();
      },
      isCompanionVisible: () => companionWindow?.isVisible() ?? false
    });

    app.on('activate', () => {
      if (companionWindow && !companionWindow.isDestroyed() && !companionWindow.isVisible()) {
        companionWindow.showInactive();
      }
      if (panelWindow && !panelWindow.isDestroyed() && !panelWindow.isVisible()) {
        panelWindow.show();
      }
      syncCompanionLayering();
      positionPanelAwayFromCompanion();
    });
  });

  app.on('before-quit', () => {
    runtimeState.isQuitting = true;
    companionEngine?.stop();
    chatSessionStore?.flush();
    companionStateStore?.flush();
    windowStateStore?.flush();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('quit', () => {
    tray?.destroy();
  });
}
