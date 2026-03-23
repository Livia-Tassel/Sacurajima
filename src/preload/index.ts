import { contextBridge, ipcRenderer } from 'electron';
import type { SakurajimaPreloadApi } from '../shared/preload-api';

const api: SakurajimaPreloadApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version')
  },
  chat: {
    send: (message, sessionId) => ipcRenderer.invoke('chat:send', message, sessionId),
    abort: (sessionId) => ipcRenderer.invoke('chat:abort', sessionId)
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    get: (sessionId) => ipcRenderer.invoke('history:get', sessionId),
    clear: (sessionId) => ipcRenderer.invoke('history:clear', sessionId)
  },
  events: {
    onChatEvent: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
        callback(payload);
      };

      ipcRenderer.on('chat:event', listener);
      return () => {
        ipcRenderer.removeListener('chat:event', listener);
      };
    },
    onCompanionEvent: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: Parameters<typeof callback>[0]) => {
        callback(payload);
      };

      ipcRenderer.on('companion:event', listener);
      return () => {
        ipcRenderer.removeListener('companion:event', listener);
      };
    }
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (config) => ipcRenderer.invoke('settings:save', config),
    testConnection: (config) => ipcRenderer.invoke('settings:test-connection', config)
  },
  companion: {
    getPrefs: () => ipcRenderer.invoke('companion:get-prefs'),
    savePrefs: (prefs) => ipcRenderer.invoke('companion:save-prefs', prefs),
    listActivities: () => ipcRenderer.invoke('companion:list-activities'),
    respond: (input) => ipcRenderer.invoke('companion:respond', input),
    dismiss: (promptId) => ipcRenderer.invoke('companion:dismiss', promptId),
    nudge: () => ipcRenderer.invoke('companion:nudge')
  },
  window: {
    togglePanel: () => ipcRenderer.invoke('window:toggle-panel'),
    showPanel: () => ipcRenderer.invoke('window:show-panel')
  }
};

contextBridge.exposeInMainWorld('sakurajima', api);
