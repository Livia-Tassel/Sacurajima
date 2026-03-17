type CompanionViewProps = {
  version: string;
  onOpenPanel: () => void;
};

export function CompanionView({ version, onOpenPanel }: CompanionViewProps) {
  return (
    <main className="companion-root">
      <section className="companion-shell">
        <div className="companion-aura" />
        <div className="companion-card">
          <div className="companion-avatar">
            <div className="companion-hair" />
            <div className="companion-face">
              <span className="eye" />
              <span className="eye" />
            </div>
          </div>
          <p className="companion-name">Sakurajima</p>
          <p className="companion-mood">Idle and ready to keep you company.</p>
          <button className="companion-trigger" onClick={onOpenPanel} type="button">
            Open panel
          </button>
          <p className="companion-meta">Build {version}</p>
        </div>
      </section>
    </main>
  );
}

