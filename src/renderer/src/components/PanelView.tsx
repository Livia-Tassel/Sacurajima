import { useEffect, useEffectEvent, useState } from 'react';
import { hasEssentialConfig, type AppConfigView } from '../../../shared/config';
import { toSessionSummary, type ChatEvent, type ChatMessage, type SessionSummary } from '../../../shared/chat';
import { BrandMark } from './BrandMark';
import { ChatWorkspace } from './ChatWorkspace';
import { MascotArtwork } from './MascotArtwork';
import { SettingsForm } from './SettingsForm';

type PanelViewProps = {
  config: AppConfigView;
  loadError: string;
  loading: boolean;
  onSaved: (config: AppConfigView) => void;
  version: string;
};

type StatusState = {
  tone: 'info' | 'error';
  text: string;
} | null;

export function PanelView({ config, loadError, loading, onSaved, version }: PanelViewProps) {
  const [tab, setTab] = useState<'chat' | 'settings'>(hasEssentialConfig(config) ? 'chat' : 'settings');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState<StatusState>(null);

  const loadSession = useEffectEvent(async (sessionId: string) => {
    const result = await window.sakurajima.history.get(sessionId);
    if (!result.ok) {
      setChatStatus({
        tone: 'error',
        text: result.error.message
      });
      return;
    }

    setActiveSessionId(result.data.id);
    setMessages(result.data.messages);
    setTab('chat');
  });

  const refreshHistory = useEffectEvent(async () => {
    const result = await window.sakurajima.history.list();
    if (!result.ok) {
      setChatStatus({
        tone: 'error',
        text: result.error.message
      });
      return;
    }

    setSessions(result.data);

    if (!activeSessionId && result.data[0]) {
      void loadSession(result.data[0].id);
    }
  });

  const handleChatEvent = useEffectEvent((event: ChatEvent) => {
    if (event.type === 'chat-start') {
      setSessions((current) => {
        const next = [toSessionSummary(event.session), ...current.filter((item) => item.id !== event.session.id)];
        return next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      });
      setActiveSessionId(event.session.id);
      setMessages(event.session.messages);
      setChatBusy(true);
      setChatStatus(null);
      setTab('chat');
      return;
    }

    if (event.type === 'chat-delta') {
      if (event.sessionId !== activeSessionId) {
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === event.messageId
            ? {
                ...message,
                content: `${message.content}${event.delta}`,
                status: 'streaming'
              }
            : message
        )
      );
      return;
    }

    if (event.type === 'chat-complete') {
      setSessions((current) => {
        const next = [toSessionSummary(event.session), ...current.filter((item) => item.id !== event.session.id)];
        return next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      });
      if (event.session.id === activeSessionId) {
        setMessages(event.session.messages);
      }
      setChatBusy(false);
      setChatStatus(null);
      return;
    }

    if (event.type === 'chat-abort') {
      setSessions((current) => {
        const next = [toSessionSummary(event.session), ...current.filter((item) => item.id !== event.session.id)];
        return next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      });
      if (event.session.id === activeSessionId) {
        setMessages(event.session.messages);
      }
      setChatBusy(false);
      setChatStatus({
        tone: 'info',
        text: 'Generation stopped.'
      });
      return;
    }

    setSessions((current) => {
      const next = [toSessionSummary(event.session), ...current.filter((item) => item.id !== event.session.id)];
      return next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
    if (event.session.id === activeSessionId) {
      setMessages(event.session.messages);
    }
    setChatBusy(false);
    setChatStatus({
      tone: 'error',
      text: event.error.message
    });
  });

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const unsubscribe = window.sakurajima.events.onChatEvent((event) => {
      handleChatEvent(event);
    });

    return unsubscribe;
  }, [handleChatEvent]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (hasEssentialConfig(config) && !loadError) {
      setTab('chat');
      return;
    }

    setTab('settings');
  }, [config, loadError, loading]);

  const canChat = hasEssentialConfig(config);

  const startNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setChatStatus(null);
    setTab('chat');
  };

  const clearCurrentSession = async () => {
    if (!activeSessionId) {
      return;
    }

    const result = await window.sakurajima.history.clear(activeSessionId);
    if (!result.ok) {
      setChatStatus({
        tone: 'error',
        text: result.error.message
      });
      return;
    }

    setSessions((current) => current.filter((session) => session.id !== result.data.sessionId));
    setActiveSessionId(null);
    setMessages([]);
    setChatBusy(false);
  };

  const sendMessage = async () => {
    const result = await window.sakurajima.chat.send(chatInput, activeSessionId ?? undefined);
    if (!result.ok) {
      setChatStatus({
        tone: 'error',
        text: result.error.message
      });
      if (result.error.code === 'MISSING_CONFIG') {
        setTab('settings');
      }
      return;
    }

    setChatInput('');
    setActiveSessionId(result.data.sessionId);
    setChatBusy(true);
    setChatStatus(null);
  };

  const abortMessage = async () => {
    if (!activeSessionId) {
      return;
    }

    await window.sakurajima.chat.abort(activeSessionId);
  };

  return (
    <main className="panel-root">
      <div className="panel-window-bar" aria-hidden="true">
        <span className="panel-window-grip">Move Window</span>
      </div>
      <section className="panel-shell">
        <aside className="panel-sidebar">
          <div>
            <div className="panel-brand-lockup">
              <BrandMark alt="Sakurajima brand mark" className="panel-brand-mark" />
              <MascotArtwork alt="Sakurajima mascot" className="panel-brand-art" variant="happy" />
              <p className="panel-kicker">Desktop Companion</p>
            </div>
            <h1>Sakurajima</h1>
            <p className="panel-copy">
              Configure New API or any OpenAI-compatible endpoint here. Chat and
              local history will attach to this same shell in the next feature.
            </p>
          </div>
          <div className="panel-session-list">
            <div className="panel-sidebar-actions">
              <button className="settings-button secondary panel-sidebar-button" onClick={startNewChat} type="button">
                New chat
              </button>
              <button
                className={tab === 'settings' ? 'provider-button active panel-tab-button' : 'provider-button panel-tab-button'}
                onClick={() => setTab('settings')}
                type="button"
              >
                Settings
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="panel-session panel-session-static">
                <p className="panel-label">No sessions</p>
                <p className="panel-value">Your local history will appear here after the first message.</p>
              </div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  className={session.id === activeSessionId ? 'panel-session active' : 'panel-session'}
                  onClick={() => void loadSession(session.id)}
                  type="button"
                >
                  <p className="panel-label">{session.title}</p>
                  <p className="panel-value">{session.lastMessagePreview || 'Empty conversation'}</p>
                </button>
              ))
            )}

            <div className="panel-session panel-session-static">
              <p className="panel-label">Renderer</p>
              <p className="panel-value">{version}</p>
            </div>
          </div>
        </aside>

        <section className="panel-content">
          <div className="panel-hero-card">
            <p className="panel-kicker">Feature 4</p>
            <h2>Local sessions and streaming chat now live in the panel</h2>
            <p>
              The panel now keeps session history locally, streams assistant
              deltas in place, and falls back to standard JSON completions when
              the endpoint does not answer with SSE.
            </p>
            <div className="panel-pill-row">
              <span className="panel-pill">Streaming</span>
              <span className="panel-pill">Abort</span>
              <span className="panel-pill">Local History</span>
            </div>
          </div>

          {tab === 'settings' ? (
            <SettingsForm
              config={config}
              loadError={loadError}
              loading={loading}
              onSaved={(nextConfig) => {
                onSaved(nextConfig);
                if (hasEssentialConfig(nextConfig)) {
                  setTab('chat');
                }
              }}
            />
          ) : (
            <>
              <ChatWorkspace
                activeSessionId={activeSessionId}
                busy={chatBusy}
                configReady={canChat}
                input={chatInput}
                messages={messages}
                onAbort={() => void abortMessage()}
                onInputChange={setChatInput}
                onOpenSettings={() => setTab('settings')}
                onSend={() => void sendMessage()}
                statusMessage={chatStatus}
              />
              {activeSessionId ? (
                <div className="chat-toolbar">
                  <button className="settings-button secondary" onClick={() => void clearCurrentSession()} type="button">
                    Clear current session
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
