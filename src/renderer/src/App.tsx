import { useEffect, useState } from 'react';
import { parseWindowView } from '../../shared/window-view';
import type { AppVersionResponse } from '../../shared/preload-api';
import { CompanionView } from './components/CompanionView';
import { PanelView } from './components/PanelView';

export default function App() {
  const [version, setVersion] = useState('...');
  const view = parseWindowView(window.location.search);

  useEffect(() => {
    void window.sakurajima.app.getVersion().then((result: AppVersionResponse) => {
      setVersion(result.version);
    });
  }, []);

  if (view === 'companion') {
    return <CompanionView onOpenPanel={() => void window.sakurajima.window.showPanel()} version={version} />;
  }

  return <PanelView version={version} />;
}
