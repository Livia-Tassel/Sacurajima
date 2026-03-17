import { useEffect, useState } from 'react';
import { APP_TAGLINE, createWelcomeHeading } from '../../shared/app-meta';
import type { AppVersionResponse } from '../../shared/preload-api';

export default function App() {
  const [version, setVersion] = useState('...');

  useEffect(() => {
    void window.sakurajima.app.getVersion().then((result: AppVersionResponse) => {
      setVersion(result.version);
    });
  }, []);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Document-Driven Foundation</p>
        <h1>{createWelcomeHeading(version)}</h1>
        <p className="tagline">{APP_TAGLINE}</p>
        <p className="body">
          Feature 1 establishes the Electron, preload, and renderer structure.
          Companion windows, New API onboarding, and chat flow will be layered
          on top of this baseline in subsequent commits.
        </p>
        <div className="pill-row">
          <span className="pill">Electron</span>
          <span className="pill">React</span>
          <span className="pill">TypeScript</span>
          <span className="pill">Docs First</span>
        </div>
      </section>
    </main>
  );
}
