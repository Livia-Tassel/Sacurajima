import { app, BrowserWindow, ipcMain, Tray } from 'electron';
import { ConfigStore } from './config-store';
import { createAppTray } from './tray';
import { runtimeState } from './runtime-state';
import { WindowStateStore } from './window-state-store';
import { createCompanionWindow, createPanelWindow } from './windows';

let companionWindow: BrowserWindow | null = null;
let panelWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const singleInstance = app.requestSingleInstanceLock();

if (!singleInstance) {
  app.quit();
}

function showPanel() {
  if (!panelWindow) {
    return { visible: false };
  }

  panelWindow.show();
  panelWindow.focus();
  return { visible: true };
}

function togglePanel() {
  if (!panelWindow) {
    return { visible: false };
  }

  if (panelWindow.isVisible()) {
    panelWindow.hide();
    return { visible: false };
  }

  panelWindow.show();
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
  }
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
    const windowStateStore = new WindowStateStore();

    companionWindow = createCompanionWindow(windowStateStore);
    panelWindow = createPanelWindow(windowStateStore);

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

    ipcMain.handle('app:get-version', () => ({
      version: app.getVersion()
    }));
    ipcMain.handle('settings:load', () => configStore.load());
    ipcMain.handle('settings:save', (_event, config) => configStore.save(config));
    ipcMain.handle('settings:test-connection', (_event, config) => configStore.testConnection(config));
    ipcMain.handle('window:toggle-panel', () => togglePanel());
    ipcMain.handle('window:show-panel', () => showPanel());

    app.on('activate', () => {
      if (companionWindow && !companionWindow.isDestroyed() && !companionWindow.isVisible()) {
        companionWindow.showInactive();
      }
      if (panelWindow && !panelWindow.isDestroyed() && !panelWindow.isVisible()) {
        panelWindow.show();
      }
    });
  });

  app.on('before-quit', () => {
    runtimeState.isQuitting = true;
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
