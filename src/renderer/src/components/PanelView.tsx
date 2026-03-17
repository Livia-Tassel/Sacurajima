import type { AppConfigView } from '../../../shared/config';
import { SettingsForm } from './SettingsForm';

type PanelViewProps = {
  config: AppConfigView;
  loadError: string;
  loading: boolean;
  onSaved: (config: AppConfigView) => void;
  version: string;
};

export function PanelView({ config, loadError, loading, onSaved, version }: PanelViewProps) {
  return (
    <main className="panel-root">
      <section className="panel-shell">
        <aside className="panel-sidebar">
          <div>
            <p className="panel-kicker">Desktop Companion</p>
            <h1>Sakurajima</h1>
            <p className="panel-copy">
              Configure New API or any OpenAI-compatible endpoint here. Chat and
              local history will attach to this same shell in the next feature.
            </p>
          </div>
          <div className="panel-session-list">
            <div className="panel-session panel-session-static">
              <p className="panel-label">Renderer</p>
              <p className="panel-value">{version}</p>
            </div>
            <div className="panel-session panel-session-static">
              <p className="panel-label">Saved key</p>
              <p className="panel-value">{config.hasApiKey ? 'Encrypted locally' : 'Not saved yet'}</p>
            </div>
            <div className="panel-session panel-session-static">
              <p className="panel-label">Normalized base URL</p>
              <p className="panel-value">{config.baseUrlNormalized || 'Waiting for setup'}</p>
            </div>
          </div>
        </aside>

        <section className="panel-content">
          <div className="panel-hero-card">
            <p className="panel-kicker">Feature 3</p>
            <h2>New API onboarding is now the primary panel flow</h2>
            <p>
              Configuration persists locally, API keys stay encrypted, and the
              connection test uses the normalized OpenAI-compatible base URL.
            </p>
            <div className="panel-pill-row">
              <span className="panel-pill">New API</span>
              <span className="panel-pill">safeStorage</span>
              <span className="panel-pill">GET /models</span>
            </div>
          </div>

          <SettingsForm config={config} loadError={loadError} loading={loading} onSaved={onSaved} />
        </section>
      </section>
    </main>
  );
}
