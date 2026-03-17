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
  window: {
    togglePanel: () => Promise<WindowVisibilityResponse>;
    showPanel: () => Promise<WindowVisibilityResponse>;
  };
};
