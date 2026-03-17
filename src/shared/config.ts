export type ProviderPreset = 'newapi' | 'custom';

export type AppConfigInput = {
  providerPreset: ProviderPreset;
  siteUrl?: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  systemPrompt: string;
  temperature: number;
};

export type AppConfigView = {
  providerPreset: ProviderPreset;
  siteUrl?: string;
  baseUrl?: string;
  baseUrlNormalized: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  hasApiKey: boolean;
};

export type ConnectionTestResult = {
  ok: boolean;
  normalizedBaseUrl: string;
  modelCount?: number;
  sampledModels?: string[];
  message: string;
  errorCode?:
    | 'VALIDATION_ERROR'
    | 'MISSING_CONFIG'
    | 'UNAUTHORIZED'
    | 'TIMEOUT'
    | 'NETWORK_ERROR'
    | 'INVALID_RESPONSE'
    | 'UNKNOWN_ERROR';
};

export type IpcErrorCode =
  | 'VALIDATION_ERROR'
  | 'MISSING_CONFIG'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'NOT_FOUND'
  | 'UNSUPPORTED_ENV'
  | 'UNKNOWN_ERROR';

export type IpcError = {
  code: IpcErrorCode;
  message: string;
  retriable: boolean;
};

export type IpcResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: IpcError;
    };

export const DEFAULT_SYSTEM_PROMPT =
  'You are Sakurajima, a warm and observant desktop companion. Be gentle, concise, and emotionally supportive without being overly theatrical.';

export const DEFAULT_CONFIG: AppConfigView = {
  providerPreset: 'newapi',
  siteUrl: '',
  baseUrl: '',
  baseUrlNormalized: '',
  model: '',
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  temperature: 0.8,
  hasApiKey: false
};

function ensureProtocol(value: string) {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

export function normalizeBaseUrl(input: Pick<AppConfigInput, 'providerPreset' | 'siteUrl' | 'baseUrl'>): string {
  const raw =
    input.providerPreset === 'newapi' ? input.siteUrl?.trim() ?? '' : input.baseUrl?.trim() ?? '';

  if (!raw) {
    return '';
  }

  try {
    const url = new URL(ensureProtocol(raw));
    const pathname = url.pathname.replace(/\/+$/, '');

    if (pathname === '' || pathname === '/') {
      url.pathname = '/v1';
    } else {
      url.pathname = pathname;
    }

    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function hasEssentialConfig(config: AppConfigView): boolean {
  return Boolean(config.baseUrlNormalized && config.model && config.hasApiKey);
}
