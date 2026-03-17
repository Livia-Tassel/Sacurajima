import { contextBridge, ipcRenderer } from 'electron';
import type { SakurajimaPreloadApi } from '../shared/preload-api';

const api: SakurajimaPreloadApi = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:get-version')
  }
};

contextBridge.exposeInMainWorld('sakurajima', api);

