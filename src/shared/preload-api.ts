export type AppVersionResponse = {
  version: string;
};

export type SakurajimaPreloadApi = {
  app: {
    getVersion: () => Promise<AppVersionResponse>;
  };
};

