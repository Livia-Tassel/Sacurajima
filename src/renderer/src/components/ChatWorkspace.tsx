import type { ChatMessage } from '../../../shared/chat';

type ChatWorkspaceProps = {
  activeSessionId: string | null;
  busy: boolean;
  configReady: boolean;
  input: string;
  messages: ChatMessage[];
  onAbort: () => void;
  onInputChange: (value: string) => void;
  onOpenSettings: () => void;
  onSend: () => void;
  statusMessage: {
    tone: 'info' | 'error';
    text: string;
  } | null;
};

export function ChatWorkspace({
  activeSessionId,
  busy,
  configReady,
  input,
  messages,
  onAbort,
  onInputChange,
  onOpenSettings,
  onSend,
  statusMessage
}: ChatWorkspaceProps) {
  const visibleMessages = messages.filter((message) => message.role !== 'system');

  return (
    <div className="chat-shell">
      <div className="chat-hero-card">
        <div>
          <p className="panel-kicker">Chat Workspace</p>
          <h2>{activeSessionId ? 'Continue the current conversation' : 'Start a new conversation'}</h2>
          <p>
            Sakurajima keeps sessions locally and streams assistant deltas into this panel as they arrive.
          </p>
        </div>
        <div className="chat-hero-actions">
          {!configReady ? (
            <button className="settings-button secondary" onClick={onOpenSettings} type="button">
              Finish setup
            </button>
          ) : null}
          {busy ? (
            <button className="settings-button secondary" onClick={onAbort} type="button">
              Stop generation
            </button>
          ) : null}
        </div>
      </div>

      {statusMessage ? (
        <section className={statusMessage.tone === 'error' ? 'status-card status-card-error' : 'status-card'}>
          <strong>{statusMessage.tone === 'error' ? 'Chat error' : 'Chat update'}</strong>
          <p>{statusMessage.text}</p>
        </section>
      ) : null}

      <section className="chat-transcript">
        {visibleMessages.length === 0 ? (
          <div className="chat-empty-state">
            <p className="panel-label">No messages yet</p>
            <p className="panel-value">
              {configReady
                ? 'Send a message to create your first local session.'
                : 'Complete the API setup first, then come back to chat.'}
            </p>
          </div>
        ) : (
          visibleMessages.map((message) => (
            <article
              key={message.id}
              className={message.role === 'user' ? 'chat-bubble chat-bubble-user' : 'chat-bubble'}
            >
              <p className="panel-label">{message.role === 'user' ? 'You' : 'Sakurajima'}</p>
              <p className="chat-content">{message.content || (busy ? '...' : '')}</p>
            </article>
          ))
        )}
      </section>

      <section className="chat-composer">
        <textarea
          disabled={!configReady}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder={
            configReady
              ? 'Say something to Sakurajima...'
              : 'Configure New API in Settings before sending messages.'
          }
          rows={4}
          value={input}
        />
        <div className="chat-composer-actions">
          <span className="settings-hint">Messages stay local unless sent to your configured API.</span>
          <button
            className="settings-button"
            disabled={!configReady || busy || !input.trim()}
            onClick={onSend}
            type="button"
          >
            Send
          </button>
        </div>
      </section>
    </div>
  );
}

