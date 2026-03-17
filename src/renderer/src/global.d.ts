import type { SakurajimaPreloadApi } from '../../shared/preload-api';

declare global {
  interface Window {
    sakurajima: SakurajimaPreloadApi;
  }
}

export {};

