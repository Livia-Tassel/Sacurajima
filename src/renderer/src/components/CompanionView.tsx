import { MascotArtwork } from './MascotArtwork';

type CompanionViewProps = {
  hasConfig: boolean;
  version: string;
  onOpenPanel: () => void;
};

export function CompanionView({ hasConfig, version, onOpenPanel }: CompanionViewProps) {
  return (
    <main className="companion-root">
      <section className="companion-shell">
        <div className="companion-aura" />
        <div className="companion-card">
          <MascotArtwork
            alt="Sakurajima companion"
            className="companion-illustration"
            variant={hasConfig ? 'idle' : 'sleepy'}
          />
          <p className="companion-name">Sakurajima</p>
          <p className="companion-mood">
            {hasConfig
              ? 'Idle and ready to keep you company.'
              : 'Open the panel to finish your New API setup.'}
          </p>
          <button className="companion-trigger" onClick={onOpenPanel} type="button">
            {hasConfig ? 'Open panel' : 'Finish setup'}
          </button>
          <p className="companion-meta">Build {version}</p>
        </div>
      </section>
    </main>
  );
}
