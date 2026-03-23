import { startTransition, useEffect, useEffectEvent, useState } from 'react';
import { DEFAULT_CONFIG, hasEssentialConfig, type AppConfigView } from '../../shared/config';
import type { AppVersionResponse } from '../../shared/preload-api';
import { parseWindowView } from '../../shared/window-view';
import { CompanionView } from './components/CompanionView';
import { PanelView } from './components/PanelView';

export default function App() {
  const [version, setVersion] = useState('...');
  const [config, setConfig] = useState<AppConfigView>(DEFAULT_CONFIG);
  const [configLoading, setConfigLoading] = useState(true);
  const [configLoadError, setConfigLoadError] = useState('');
  const view = parseWindowView(window.location.search);

  const loadSettings = useEffectEvent(async () => {
    try {
      const result = await window.sakurajima.settings.load();

      if (!result.ok) {
        startTransition(() => {
          setConfig(DEFAULT_CONFIG);
          setConfigLoadError(result.error.message);
          setConfigLoading(false);
        });
        return;
      }

      startTransition(() => {
        setConfig(result.data);
        setConfigLoadError('');
        setConfigLoading(false);
      });
    } catch (error) {
      startTransition(() => {
        setConfig(DEFAULT_CONFIG);
        setConfigLoadError(error instanceof Error ? error.message : 'Failed to load settings.');
        setConfigLoading(false);
      });
    }
  });

  useEffect(() => {
    document.body.dataset.view = view;

    void window.sakurajima.app
      .getVersion()
      .then((result: AppVersionResponse) => {
        setVersion(result.version);
      })
      .catch(() => {
        setVersion('unknown');
      });
    void loadSettings();
  }, [loadSettings, view]);

  if (view === 'companion') {
    return (
      <CompanionView
        hasConfig={hasEssentialConfig(config)}
        onOpenPanel={() => void window.sakurajima.window.showPanel()}
        version={version}
      />
    );
  }

  return (
    <PanelView
      config={config}
      loadError={configLoadError}
      loading={configLoading}
      onSaved={setConfig}
      version={version}
    />
  );
}
