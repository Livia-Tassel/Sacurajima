import { useEffect, useEffectEvent, useState } from 'react';
import { hasEssentialConfig, type AppConfigView } from '../../../shared/config';
import {
  MAX_CHAT_MESSAGE_CHARS,
  toSessionSummary,
  type ChatEvent,
  type ChatMessage,
  type SessionSummary
} from '../../../shared/chat';
import type { CompanionActivity, CompanionEvent } from '../../../shared/companion';
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
  const [tab, setTab] = useState<'chat' | 'settings'>('settings');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatStatus, setChatStatus] = useState<StatusState>(null);
  const [companionActivities, setCompanionActivities] = useState<CompanionActivity[]>([]);
  const [didHydrateInitialView, setDidHydrateInitialView] = useState(false);

  const loadSession = useEffectEvent(async (sessionId: string) => {
    try {
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
    } catch (error) {
      setChatStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to load the selected session.'
      });
    }
  });

  const refreshHistory = useEffectEvent(async () => {
    try {
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
    } catch (error) {
      setChatStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to load chat history.'
      });
    }
  });

  const refreshCompanionActivities = useEffectEvent(async () => {
    try {
      const result = await window.sakurajima.companion.listActivities();
      if (!result.ok) {
        setChatStatus({
          tone: 'error',
          text: result.error.message
        });
        return;
      }

      setCompanionActivities(result.data);
    } catch (error) {
      setChatStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to load companion activities.'
      });
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
    void refreshCompanionActivities();
  }, [refreshCompanionActivities, refreshHistory]);

  const handleCompanionEvent = useEffectEvent((event: CompanionEvent) => {
    if (event.type === 'companion-state') {
      return;
    }

    if (event.type === 'companion-action-result') {
      setChatStatus({
        tone: 'info',
        text: `Companion captured "${event.action.label}".`
      });
    }
    void refreshCompanionActivities();
  });

  useEffect(() => {
    const unsubscribe = window.sakurajima.events.onCompanionEvent((event) => {
      handleCompanionEvent(event);
    });

    return unsubscribe;
  }, [handleCompanionEvent]);

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

    if (!didHydrateInitialView) {
      setTab(hasEssentialConfig(config) && !loadError ? 'chat' : 'settings');
      setDidHydrateInitialView(true);
    }
  }, [config, didHydrateInitialView, loadError, loading]);

  const canChat = hasEssentialConfig(config);

  const injectCompanionDraft = (seedMessage: string) => {
    const normalized = seedMessage.trim();
    if (!normalized) {
      return;
    }

    setTab('chat');
    setChatInput((current) =>
      (current ? `${current}\n${normalized}` : normalized).slice(0, MAX_CHAT_MESSAGE_CHARS)
    );
    setChatStatus({
      tone: 'info',
      text: 'Draft injected from companion activity.'
    });
  };

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

    try {
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
    } catch (error) {
      setChatStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to clear the current session.'
      });
    }
  };

  const sendMessage = async () => {
    try {
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
    } catch (error) {
      setChatStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to send the message.'
      });
    }
  };

  const abortMessage = async () => {
    if (!activeSessionId) {
      return;
    }

    try {
      await window.sakurajima.chat.abort(activeSessionId);
    } catch (error) {
      setChatStatus({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Failed to abort the current response.'
      });
    }
  };

  return (
    <main className="panel-root">
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
              Configure your endpoint, chat in local sessions, and review companion
              check-ins from the same desktop shell.
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
          <section className="companion-feed-card">
            <div className="companion-feed-head">
              <p className="panel-kicker">Companion feed</p>
              <button
                className="settings-button secondary companion-feed-refresh"
                onClick={() => void refreshCompanionActivities()}
                type="button"
              >
                Refresh
              </button>
            </div>
            {companionActivities.length === 0 ? (
              <p className="panel-value">No companion updates yet. Sakurajima will check in shortly.</p>
            ) : (
              <div className="companion-feed-list">
                {companionActivities.slice(0, 5).map((activity) => (
                  <article className="companion-feed-item" key={activity.id}>
                    <div>
                      <p className="panel-label">{activity.type.toUpperCase()}</p>
                      <p className="panel-value">{activity.text}</p>
                      <p className="companion-feed-time">
                        {new Date(activity.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                    {activity.seedMessage ? (
                      <button
                        className="settings-button secondary companion-feed-action"
                        onClick={() => {
                          if (activity.seedMessage) {
                            injectCompanionDraft(activity.seedMessage);
                          }
                        }}
                        type="button"
                      >
                        Use as draft
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="panel-hero-card">
            <p className="panel-kicker">Feature 7</p>
            <h2>Companion interaction core is now live in the desktop flow</h2>
            <p>
              Sakurajima now pushes proactive care prompts, captures quick
              responses, and keeps the latest interaction feed connected to chat drafts.
            </p>
            <div className="panel-pill-row">
              <span className="panel-pill">Proactive Prompts</span>
              <span className="panel-pill">Quick Actions</span>
              <span className="panel-pill">Feed-to-Draft</span>
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
