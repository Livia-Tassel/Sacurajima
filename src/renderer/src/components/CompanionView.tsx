import { useEffect, useState } from 'react';
import type { ChatEvent } from '../../../shared/chat';
import { MascotArtwork } from './MascotArtwork';

type CompanionViewProps = {
  hasConfig: boolean;
  version: string;
  onOpenPanel: () => void;
};

export function CompanionView({ hasConfig, version, onOpenPanel }: CompanionViewProps) {
  const [state, setState] = useState<'idle' | 'thinking' | 'happy' | 'sleepy' | 'error'>(
    hasConfig ? 'idle' : 'sleepy'
  );

  useEffect(() => {
    setState(hasConfig ? 'idle' : 'sleepy');
  }, [hasConfig]);

  useEffect(() => {
    const unsubscribe = window.sakurajima.events.onChatEvent((event: ChatEvent) => {
      if (event.type === 'chat-start') {
        setState('thinking');
        return;
      }
      if (event.type === 'chat-complete') {
        setState('happy');
        return;
      }
      if (event.type === 'chat-error') {
        setState('error');
        return;
      }
      if (event.type === 'chat-abort') {
        setState(hasConfig ? 'idle' : 'sleepy');
      }
    });

    return unsubscribe;
  }, [hasConfig]);

  useEffect(() => {
    if (state === 'happy' || state === 'error') {
      const timer = window.setTimeout(() => {
        setState(hasConfig ? 'idle' : 'sleepy');
      }, 2800);

      return () => {
        window.clearTimeout(timer);
      };
    }
  }, [hasConfig, state]);

  const moodText =
    state === 'thinking'
      ? 'Thinking...'
      : state === 'happy'
        ? 'Here with you.'
        : state === 'error'
          ? 'Tap to regroup.'
          : hasConfig
            ? 'Ready.'
            : 'Finish setup.';

  return (
    <main className="companion-root">
      <section className="companion-shell">
        <div className="companion-aura" />
        <div className={`companion-card companion-card-${state}`}>
          <div className="companion-window-bar" aria-hidden="true">
            <span className="companion-window-grip">Move Companion</span>
          </div>
          <div className="companion-status-chip">{moodText}</div>
          <MascotArtwork
            alt="Sakurajima companion"
            className="companion-illustration"
            variant={state}
          />
          <div className="companion-footer">
            <div>
              <p className="companion-name">Sakurajima</p>
              <p className="companion-meta">Build {version}</p>
            </div>
            <button className="companion-trigger" onClick={onOpenPanel} type="button">
              {hasConfig ? 'Open panel' : 'Finish setup'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
