type PanelViewProps = {
  version: string;
};

const sessions = ['Today', 'Ideas', 'Sakurajima Notes'];

export function PanelView({ version }: PanelViewProps) {
  return (
    <main className="panel-root">
      <section className="panel-shell">
        <aside className="panel-sidebar">
          <div>
            <p className="panel-kicker">Desktop Companion</p>
            <h1>Sakurajima</h1>
            <p className="panel-copy">
              The shell is ready. Onboarding, settings, and chat will land in the
              next features without changing the panel structure.
            </p>
          </div>
          <div className="panel-session-list">
            {sessions.map((session) => (
              <button key={session} className="panel-session" type="button">
                {session}
              </button>
            ))}
          </div>
        </aside>

        <section className="panel-content">
          <div className="panel-hero-card">
            <p className="panel-kicker">Feature 2</p>
            <h2>Floating companion shell is active</h2>
            <p>
              The tray menu, dual-window coordination, window persistence, and
              single-instance behavior are now handled by the main process.
            </p>
            <div className="panel-pill-row">
              <span className="panel-pill">Tray</span>
              <span className="panel-pill">Single Instance</span>
              <span className="panel-pill">Window Restore</span>
            </div>
          </div>

          <div className="panel-placeholder">
            <div>
              <p className="panel-label">Next up</p>
              <p className="panel-value">New API onboarding and encrypted config</p>
            </div>
            <div>
              <p className="panel-label">Current renderer build</p>
              <p className="panel-value">{version}</p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

