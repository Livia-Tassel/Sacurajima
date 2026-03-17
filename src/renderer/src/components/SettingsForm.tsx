import { startTransition, useEffect, useState } from 'react';
import {
  DEFAULT_CONFIG,
  DEFAULT_SYSTEM_PROMPT,
  normalizeBaseUrl,
  type AppConfigInput,
  type AppConfigView,
  type ConnectionTestResult,
  type IpcError
} from '../../../shared/config';

type SettingsFormProps = {
  config: AppConfigView;
  loading: boolean;
  loadError: string;
  onSaved: (config: AppConfigView) => void;
};

type SettingsDraft = AppConfigInput & {
  apiKey: string;
};

type MessageState = {
  tone: 'info' | 'success' | 'error';
  text: string;
} | null;

function toDraft(config: AppConfigView): SettingsDraft {
  return {
    providerPreset: config.providerPreset,
    siteUrl: config.siteUrl ?? '',
    baseUrl: config.baseUrl ?? '',
    apiKey: '',
    model: config.model,
    systemPrompt: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
    temperature: config.temperature
  };
}

function describeError(error: IpcError) {
  return `${error.message} (${error.code})`;
}

export function SettingsForm({ config, loading, loadError, onSaved }: SettingsFormProps) {
  const [draft, setDraft] = useState<SettingsDraft>(() => toDraft(DEFAULT_CONFIG));
  const [message, setMessage] = useState<MessageState>(null);
  const [connectionResult, setConnectionResult] = useState<ConnectionTestResult | null>(null);
  const [busyAction, setBusyAction] = useState<'save' | 'test' | null>(null);

  useEffect(() => {
    setDraft(toDraft(config));
  }, [config]);

  const normalizedPreview = normalizeBaseUrl(draft);

  const updateDraft = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  };

  const handleSave = async () => {
    setBusyAction('save');
    setMessage(null);

    const result = await window.sakurajima.settings.save(draft);

    if (!result.ok) {
      setMessage({
        tone: 'error',
        text: describeError(result.error)
      });
      setBusyAction(null);
      return;
    }

    startTransition(() => {
      onSaved(result.data);
      setDraft(toDraft(result.data));
      setMessage({
        tone: 'success',
        text: 'Configuration saved. API Key remains hidden and encrypted locally.'
      });
    });
    setBusyAction(null);
  };

  const handleTestConnection = async () => {
    setBusyAction('test');
    setMessage(null);

    const result = await window.sakurajima.settings.testConnection(draft);

    if (!result.ok) {
      setMessage({
        tone: 'error',
        text: describeError(result.error)
      });
      setBusyAction(null);
      return;
    }

    setConnectionResult(result.data);
    setMessage({
      tone: result.data.ok ? 'success' : 'error',
      text: result.data.message
    });
    setBusyAction(null);
  };

  return (
    <div className="settings-shell">
      <section className="settings-section">
        <div className="settings-header">
          <div>
            <p className="panel-kicker">Onboarding</p>
            <h2 className="settings-title">Connect your OpenAI-compatible API</h2>
          </div>
          {config.hasApiKey ? <span className="settings-badge">API Key saved securely</span> : null}
        </div>

        {loadError ? (
          <div className="status-card status-card-error">
            <strong>Failed to load existing settings.</strong>
            <p>{loadError}</p>
          </div>
        ) : null}

        <div className="provider-toggle">
          <button
            className={draft.providerPreset === 'newapi' ? 'provider-button active' : 'provider-button'}
            onClick={() => updateDraft('providerPreset', 'newapi')}
            type="button"
          >
            New API
          </button>
          <button
            className={draft.providerPreset === 'custom' ? 'provider-button active' : 'provider-button'}
            onClick={() => updateDraft('providerPreset', 'custom')}
            type="button"
          >
            Custom Compatible
          </button>
        </div>

        <div className="field-grid">
          {draft.providerPreset === 'newapi' ? (
            <label className="field">
              <span>Site URL</span>
              <input
                autoComplete="off"
                onChange={(event) => updateDraft('siteUrl', event.target.value)}
                placeholder="https://your-newapi-host.example"
                type="text"
                value={draft.siteUrl ?? ''}
              />
            </label>
          ) : (
            <label className="field">
              <span>Base URL</span>
              <input
                autoComplete="off"
                onChange={(event) => updateDraft('baseUrl', event.target.value)}
                placeholder="https://gateway.example.com/openai/v1"
                type="text"
                value={draft.baseUrl ?? ''}
              />
            </label>
          )}

          <label className="field">
            <span>Model</span>
            <input
              autoComplete="off"
              onChange={(event) => updateDraft('model', event.target.value)}
              placeholder="gpt-4.1, gpt-4o-mini, ..."
              type="text"
              value={draft.model}
            />
          </label>

          <label className="field field-full">
            <span>API Key</span>
            <input
              autoComplete="off"
              onChange={(event) => updateDraft('apiKey', event.target.value)}
              placeholder={config.hasApiKey ? 'Leave blank to keep the saved key' : 'sk-...'}
              type="password"
              value={draft.apiKey}
            />
            <small className="settings-hint">
              The key is never shown again after save and is stored via Electron safeStorage.
            </small>
          </label>

          <label className="field field-full">
            <span>System Prompt</span>
            <textarea
              onChange={(event) => updateDraft('systemPrompt', event.target.value)}
              rows={5}
              value={draft.systemPrompt}
            />
          </label>

          <label className="field">
            <span>Temperature</span>
            <input
              max="2"
              min="0"
              onChange={(event) => updateDraft('temperature', Number(event.target.value))}
              step="0.1"
              type="range"
              value={draft.temperature}
            />
            <small className="settings-hint">{draft.temperature.toFixed(1)}</small>
          </label>

          <div className="field">
            <span>Normalized Base URL</span>
            <div className="settings-preview">{normalizedPreview || 'Waiting for host input...'}</div>
          </div>
        </div>

        <div className="settings-actions">
          <button
            className="settings-button secondary"
            disabled={loading || busyAction !== null}
            onClick={() => void handleTestConnection()}
            type="button"
          >
            {busyAction === 'test' ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            className="settings-button"
            disabled={loading || busyAction !== null}
            onClick={() => void handleSave()}
            type="button"
          >
            {busyAction === 'save' ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>

      {message ? (
        <section
          className={
            message.tone === 'error'
              ? 'status-card status-card-error'
              : message.tone === 'success'
                ? 'status-card status-card-success'
                : 'status-card'
          }
        >
          <strong>{message.tone === 'error' ? 'Action failed' : 'Action complete'}</strong>
          <p>{message.text}</p>
        </section>
      ) : null}

      <section className="settings-meta-grid">
        <div className="settings-info-card">
          <p className="panel-label">Preset behavior</p>
          <p className="panel-value">
            New API mode treats the host as a site URL and appends <code>/v1</code> when you only provide the root.
          </p>
        </div>

        <div className="settings-info-card">
          <p className="panel-label">Connection test</p>
          <p className="panel-value">
            The app calls <code>GET /models</code> against the normalized base URL and never logs your full bearer token.
          </p>
          {connectionResult ? (
            <div className="settings-model-list">
              <p className="panel-label">Latest result</p>
              <p className="panel-value">{connectionResult.normalizedBaseUrl}</p>
              {connectionResult.sampledModels?.length ? (
                <p className="settings-inline-list">{connectionResult.sampledModels.join(' · ')}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

