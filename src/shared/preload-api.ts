import type {
  AppConfigInput,
  AppConfigView,
  ConnectionTestResult,
  IpcResult
} from './config';

export type AppVersionResponse = {
  version: string;
};

export type WindowVisibilityResponse = {
  visible: boolean;
};

export type SakurajimaPreloadApi = {
  app: {
    getVersion: () => Promise<AppVersionResponse>;
  };
  settings: {
    load: () => Promise<IpcResult<AppConfigView>>;
    save: (config: AppConfigInput) => Promise<IpcResult<AppConfigView>>;
    testConnection: (config: AppConfigInput) => Promise<IpcResult<ConnectionTestResult>>;
  };
  window: {
    togglePanel: () => Promise<WindowVisibilityResponse>;
    showPanel: () => Promise<WindowVisibilityResponse>;
  };
};
