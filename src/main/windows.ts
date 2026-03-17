import { BrowserWindow, app } from 'electron';
import { join } from 'node:path';
import { runtimeState } from './runtime-state';
import { WindowStateStore } from './window-state-store';
import type { WindowKind } from '../shared/window-state';

const isDev = !app.isPackaged;
const preloadPath = join(__dirname, '../preload/index.js');

function windowUrl(view: 'companion' | 'panel') {
  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    return `${process.env.ELECTRON_RENDERER_URL}?view=${view}`;
  }

  return {
    filePath: join(__dirname, '../renderer/index.html'),
    search: `?view=${view}`
  };
}

function bindWindowPersistence(
  kind: WindowKind,
  window: BrowserWindow,
  stateStore: WindowStateStore
) {
  const persist = () => {
    stateStore.update(kind, window.getBounds(), window.isVisible());
  };

  window.on('move', persist);
  window.on('resize', persist);
  window.on('show', persist);
  window.on('hide', persist);
}

export function createCompanionWindow(stateStore: WindowStateStore) {
  const state = stateStore.get('companion');
  const window = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 240,
    minHeight: 340,
    maxWidth: 300,
    maxHeight: 420,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    acceptFirstMouse: true,
    hasShadow: false,
    show: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    title: 'Sakurajima Companion',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  bindWindowPersistence('companion', window, stateStore);

  const target = windowUrl('companion');
  if (typeof target === 'string') {
    void window.loadURL(target);
  } else {
    void window.loadFile(target.filePath, { search: target.search });
  }

  window.once('ready-to-show', () => {
    if (state.visible) {
      window.showInactive();
    }
  });

  return window;
}

export function createPanelWindow(stateStore: WindowStateStore) {
  const state = stateStore.get('panel');
  const window = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 480,
    minHeight: 640,
    show: false,
    acceptFirstMouse: true,
    title: 'Sakurajima Panel',
    backgroundColor: '#fff7f3',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  bindWindowPersistence('panel', window, stateStore);

  window.on('close', (event) => {
    if (!runtimeState.isQuitting) {
      event.preventDefault();
      window.hide();
    }
  });

  const target = windowUrl('panel');
  if (typeof target === 'string') {
    void window.loadURL(target);
  } else {
    void window.loadFile(target.filePath, { search: target.search });
  }

  window.once('ready-to-show', () => {
    if (state.visible) {
      window.show();
    }
  });

  return window;
}
