import { app, safeStorage } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  normalizeBaseUrl,
  type AppConfigInput,
  type AppConfigView,
  type ConnectionTestResult,
  type IpcError,
  type IpcResult
} from '../shared/config';

type StoredAppConfig = Omit<AppConfigView, 'hasApiKey'> & {
  apiKeyEncrypted?: string;
};

export type ResolvedAppConfig = AppConfigView & {
  apiKey: string;
};

const REQUEST_TIMEOUT_MS = 8_000;

function createError(code: IpcError['code'], message: string, retriable: boolean): IpcError {
  return { code, message, retriable };
}

function trimOptional(value?: string) {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : '';
}

export class ConfigStore {
  private readonly filePath = join(app.getPath('userData'), 'app-config.json');

  load(): IpcResult<AppConfigView> {
    const { stored, corrupted } = this.readStoredState();
    if (corrupted) {
      return {
        ok: false,
        error: createError('INVALID_RESPONSE', 'The saved configuration file is unreadable or corrupted.', false)
      };
    }

    return {
      ok: true,
      data: stored ? this.toView(stored) : DEFAULT_CONFIG
    };
  }

  save(input: AppConfigInput): IpcResult<AppConfigView> {
    const { stored: existing, corrupted } = this.readStoredState();
    if (corrupted) {
      return {
        ok: false,
        error: createError('INVALID_RESPONSE', 'The saved configuration file is unreadable or corrupted.', false)
      };
    }

    const validationError = this.validate(input, Boolean(existing?.apiKeyEncrypted));

    if (validationError) {
      return {
        ok: false,
        error: validationError
      };
    }

    const normalizedBaseUrl = normalizeBaseUrl(input);
    const nextKey = trimOptional(input.apiKey);
    const encryptedKey = nextKey
      ? this.encryptApiKey(nextKey)
      : existing?.apiKeyEncrypted;

    if (nextKey && !encryptedKey) {
      return {
        ok: false,
        error: createError('UNSUPPORTED_ENV', 'This environment cannot encrypt API keys with Electron safeStorage.', false)
      };
    }

    if (!encryptedKey) {
      return {
        ok: false,
        error: createError('MISSING_CONFIG', 'API Key is required before the configuration can be saved.', false)
      };
    }

    const stored: StoredAppConfig = {
      providerPreset: input.providerPreset,
      siteUrl: trimOptional(input.siteUrl),
      baseUrl: trimOptional(input.baseUrl),
      baseUrlNormalized: normalizedBaseUrl,
      model: input.model.trim(),
      systemPrompt: trimOptional(input.systemPrompt) || DEFAULT_SYSTEM_PROMPT,
      temperature: input.temperature,
      apiKeyEncrypted: encryptedKey
    };

    this.writeStored(stored);
    return {
      ok: true,
      data: this.toView(stored)
    };
  }

  async testConnection(input: AppConfigInput): Promise<IpcResult<ConnectionTestResult>> {
    const resolved = this.resolve(input);

    if (!resolved.ok) {
      return resolved;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${resolved.data.baseUrlNormalized}/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${resolved.data.apiKey}`
        },
        signal: controller.signal
      });

      if (response.status === 401 || response.status === 403) {
        return {
          ok: true,
          data: {
            ok: false,
            normalizedBaseUrl: resolved.data.baseUrlNormalized,
            message: 'Authentication failed. Check the API Key or host.',
            errorCode: 'UNAUTHORIZED'
          }
        };
      }

      if (!response.ok) {
        return {
          ok: true,
          data: {
            ok: false,
            normalizedBaseUrl: resolved.data.baseUrlNormalized,
            message: `Connection test failed with HTTP ${response.status}.`,
            errorCode: 'NETWORK_ERROR'
          }
        };
      }

      let payload: {
        data?: Array<{ id?: string }>;
      };

      try {
        payload = (await response.json()) as {
          data?: Array<{ id?: string }>;
        };
      } catch {
        return {
          ok: true,
          data: {
            ok: false,
            normalizedBaseUrl: resolved.data.baseUrlNormalized,
            message: 'The server returned a non-JSON response to the model list request.',
            errorCode: 'INVALID_RESPONSE'
          }
        };
      }

      if (!Array.isArray(payload.data)) {
        return {
          ok: true,
          data: {
            ok: false,
            normalizedBaseUrl: resolved.data.baseUrlNormalized,
            message: 'The server response did not match the expected model list shape.',
            errorCode: 'INVALID_RESPONSE'
          }
        };
      }

      const sampledModels = payload.data
        .map((item) => item.id?.trim())
        .filter((id): id is string => Boolean(id))
        .slice(0, 5);

      return {
        ok: true,
        data: {
          ok: true,
          normalizedBaseUrl: resolved.data.baseUrlNormalized,
          modelCount: payload.data.length,
          sampledModels,
          message: `Connection succeeded. ${payload.data.length} model(s) discovered.`
        }
      };
    } catch (error) {
      const code =
        error instanceof DOMException && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR';
      const message =
        code === 'TIMEOUT'
          ? 'Connection test timed out before the model list returned.'
          : 'Unable to reach the configured API endpoint.';

      return {
        ok: true,
        data: {
          ok: false,
          normalizedBaseUrl: resolved.data.baseUrlNormalized,
          message,
          errorCode: code
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  resolve(input?: AppConfigInput): IpcResult<ResolvedAppConfig> {
    const { stored: existing, corrupted } = this.readStoredState();
    if (corrupted) {
      return {
        ok: false,
        error: createError('INVALID_RESPONSE', 'The saved configuration file is unreadable or corrupted.', false)
      };
    }

    if (!existing && !input) {
      return {
        ok: false,
        error: createError('MISSING_CONFIG', 'No saved configuration is available yet.', false)
      };
    }

    if (!input) {
      if (!existing?.apiKeyEncrypted) {
        return {
          ok: false,
          error: createError('MISSING_CONFIG', 'A saved API Key is required.', false)
        };
      }

      const apiKey = this.decryptApiKey(existing.apiKeyEncrypted);
      if (!apiKey) {
        return {
          ok: false,
          error: createError('UNSUPPORTED_ENV', 'Unable to decrypt the saved API Key.', false)
        };
      }

      return {
        ok: true,
        data: {
          ...this.toView(existing),
          apiKey
        }
      };
    }

    const validationError = this.validate(input, Boolean(existing?.apiKeyEncrypted));
    if (validationError) {
      return {
        ok: false,
        error: validationError
      };
    }

    const apiKey = trimOptional(input.apiKey) || this.decryptApiKey(existing?.apiKeyEncrypted);
    if (!apiKey) {
      return {
        ok: false,
        error: createError('MISSING_CONFIG', 'API Key is required before testing the connection.', false)
      };
    }

    return {
      ok: true,
      data: {
        providerPreset: input.providerPreset,
        siteUrl: trimOptional(input.siteUrl),
        baseUrl: trimOptional(input.baseUrl),
        baseUrlNormalized: normalizeBaseUrl(input),
        model: input.model.trim(),
        systemPrompt: trimOptional(input.systemPrompt) || DEFAULT_SYSTEM_PROMPT,
        temperature: input.temperature,
        hasApiKey: true,
        apiKey
      }
    };
  }

  private validate(input: AppConfigInput, hasStoredKey: boolean): IpcError | null {
    const siteUrl = trimOptional(input.siteUrl);
    const baseUrl = trimOptional(input.baseUrl);
    const apiKey = trimOptional(input.apiKey);

    if (input.providerPreset === 'newapi' && !siteUrl) {
      return createError('VALIDATION_ERROR', 'Site URL is required for the New API preset.', false);
    }

    if (input.providerPreset === 'custom' && !baseUrl) {
      return createError('VALIDATION_ERROR', 'Base URL is required for the custom provider preset.', false);
    }

    if (
      input.providerPreset === 'custom' &&
      /\/(models|chat\/completions)\/?$/i.test(baseUrl)
    ) {
      return createError(
        'VALIDATION_ERROR',
        'Use the API base URL, not a full /models or /chat/completions endpoint.',
        false
      );
    }

    if (!input.model.trim()) {
      return createError('VALIDATION_ERROR', 'Model is required.', false);
    }

    if (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2) {
      return createError('VALIDATION_ERROR', 'Temperature must be between 0 and 2.', false);
    }

    const normalizedBaseUrl = normalizeBaseUrl(input);
    if (!normalizedBaseUrl) {
      return createError('VALIDATION_ERROR', 'A valid API host is required.', false);
    }

    if (!apiKey && !hasStoredKey) {
      return createError('MISSING_CONFIG', 'API Key is required for the initial configuration.', false);
    }

    return null;
  }

  private encryptApiKey(apiKey: string) {
    if (!safeStorage.isEncryptionAvailable()) {
      return '';
    }

    return safeStorage.encryptString(apiKey).toString('base64');
  }

  private decryptApiKey(value?: string) {
    if (!value || !safeStorage.isEncryptionAvailable()) {
      return '';
    }

    try {
      return safeStorage.decryptString(Buffer.from(value, 'base64'));
    } catch {
      return '';
    }
  }

  private toView(stored: StoredAppConfig): AppConfigView {
    return {
      providerPreset: stored.providerPreset,
      siteUrl: stored.siteUrl,
      baseUrl: stored.baseUrl,
      baseUrlNormalized: stored.baseUrlNormalized,
      model: stored.model,
      systemPrompt: stored.systemPrompt,
      temperature: stored.temperature,
      hasApiKey: Boolean(this.decryptApiKey(stored.apiKeyEncrypted))
    };
  }

  private readStoredState(): { stored: StoredAppConfig | null; corrupted: boolean } {
    if (!existsSync(this.filePath)) {
      return { stored: null, corrupted: false };
    }

    try {
      return {
        stored: JSON.parse(readFileSync(this.filePath, 'utf8')) as StoredAppConfig,
        corrupted: false
      };
    } catch {
      return { stored: null, corrupted: true };
    }
  }

  private writeStored(config: StoredAppConfig) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(config, null, 2));
  }
}
