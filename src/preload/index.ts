import { contextBridge, ipcRenderer } from 'electron';
import type { SakurajimaPreloadApi } from '../shared/preload-api';

const api: SakurajimaPreloadApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version')
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (config) => ipcRenderer.invoke('settings:save', config),
    testConnection: (config) => ipcRenderer.invoke('settings:test-connection', config)
  },
  window: {
    togglePanel: () => ipcRenderer.invoke('window:toggle-panel'),
    showPanel: () => ipcRenderer.invoke('window:show-panel')
  }
};

contextBridge.exposeInMainWorld('sakurajima', api);
