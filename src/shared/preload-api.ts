import type {
  AppConfigInput,
  AppConfigView,
  ConnectionTestResult,
  IpcResult
} from './config';
import type { ChatEvent, ChatSession, SessionSummary } from './chat';

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
  chat: {
    send: (message: string, sessionId?: string) => Promise<IpcResult<{ sessionId: string }>>;
    abort: (sessionId: string) => Promise<IpcResult<{ sessionId: string }>>;
  };
  history: {
    list: () => Promise<IpcResult<SessionSummary[]>>;
    get: (sessionId: string) => Promise<IpcResult<ChatSession>>;
    clear: (sessionId: string) => Promise<IpcResult<{ sessionId: string }>>;
  };
  events: {
    onChatEvent: (callback: (event: ChatEvent) => void) => () => void;
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
