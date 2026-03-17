import { BrowserWindow } from 'electron';
import { randomUUID } from 'node:crypto';
import { ConfigStore } from './config-store';
import { ChatSessionStore } from './chat-session-store';
import {
  MAX_CHAT_MESSAGE_CHARS,
  deriveSessionTitle,
  type ChatEvent,
  type ChatMessage,
  type ChatSession
} from '../shared/chat';
import type { IpcError, IpcResult } from '../shared/config';

type SendChatResult = {
  sessionId: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string;
    };
    delta?: {
      content?: string;
    };
  }>;
};

function createError(code: IpcError['code'], message: string, retriable: boolean): IpcError {
  return { code, message, retriable };
}

export class ChatService {
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly configStore: ConfigStore,
    private readonly sessionStore: ChatSessionStore,
    private readonly getWindows: () => BrowserWindow[]
  ) {}

  listHistory() {
    return {
      ok: true as const,
      data: this.sessionStore.list()
    };
  }

  getHistory(sessionId: string) {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return {
        ok: false as const,
        error: createError('NOT_FOUND', 'The requested session does not exist.', false)
      };
    }

    return {
      ok: true as const,
      data: session
    };
  }

  clearHistory(sessionId: string) {
    this.controllers.get(sessionId)?.abort();
    this.controllers.delete(sessionId);
    this.sessionStore.clear(sessionId);

    return {
      ok: true as const,
      data: { sessionId }
    };
  }

  abort(sessionId: string) {
    this.controllers.get(sessionId)?.abort();
    return {
      ok: true as const,
      data: { sessionId }
    };
  }

  async send(message: string, sessionId?: string): Promise<IpcResult<SendChatResult>> {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return {
        ok: false,
        error: createError('VALIDATION_ERROR', 'Message cannot be empty.', false)
      };
    }
    if (trimmedMessage.length > MAX_CHAT_MESSAGE_CHARS) {
      return {
        ok: false,
        error: createError(
          'VALIDATION_ERROR',
          `Message cannot exceed ${MAX_CHAT_MESSAGE_CHARS} characters.`,
          false
        )
      };
    }

    const resolvedConfig = this.configStore.resolve();
    if (!resolvedConfig.ok) {
      return resolvedConfig;
    }

    const now = new Date().toISOString();
    const currentSession = sessionId ? this.sessionStore.get(sessionId) : null;
    if (currentSession && this.controllers.has(currentSession.id)) {
      return {
        ok: false,
        error: createError(
          'VALIDATION_ERROR',
          'This conversation is already generating a reply. Wait for it to finish or stop it first.',
          false
        )
      };
    }

    const userMessage: ChatMessage = {
      id: randomUUID(),
      role: 'user',
      content: trimmedMessage,
      createdAt: now,
      status: 'done'
    };
    const assistantMessage: ChatMessage = {
      id: randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: now,
      status: 'streaming'
    };
    const session: ChatSession = currentSession
      ? {
          ...currentSession,
          updatedAt: now,
          messages: [...currentSession.messages, userMessage, assistantMessage]
        }
      : {
          id: randomUUID(),
          title: deriveSessionTitle(trimmedMessage),
          createdAt: now,
          updatedAt: now,
          messages: [userMessage, assistantMessage]
        };

    this.sessionStore.save(session);
    this.broadcast({
      type: 'chat-start',
      session
    });

    const controller = new AbortController();
    this.controllers.set(session.id, controller);

    void this.runCompletion(session, assistantMessage.id, controller, resolvedConfig.data);

    return {
      ok: true,
      data: { sessionId: session.id }
    };
  }

  private async runCompletion(
    session: ChatSession,
    assistantMessageId: string,
    controller: AbortController,
    resolvedConfig: ReturnType<ConfigStore['resolve']> extends IpcResult<infer T> ? T : never
  ) {
    const requestBody = {
      model: resolvedConfig.model,
      temperature: resolvedConfig.temperature,
      stream: true,
      messages: [
        {
          role: 'system',
          content: resolvedConfig.systemPrompt
        },
        ...session.messages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role,
            content: message.content
          }))
      ]
    };

    try {
      const response = await fetch(`${resolvedConfig.baseUrlNormalized}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (response.status === 401 || response.status === 403) {
        this.failSession(session.id, assistantMessageId, createError('UNAUTHORIZED', 'Authentication failed.', false));
        return;
      }

      if (!response.ok) {
        this.failSession(
          session.id,
          assistantMessageId,
          createError('NETWORK_ERROR', `Chat request failed with HTTP ${response.status}.`, true)
        );
        return;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (contentType.includes('text/event-stream')) {
        await this.consumeSse(session.id, assistantMessageId, response, controller);
      } else {
        await this.consumeJson(session.id, assistantMessageId, response);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        this.abortSession(session.id, assistantMessageId);
      } else {
        this.failSession(
          session.id,
          assistantMessageId,
          createError('NETWORK_ERROR', 'Unable to reach the configured API endpoint.', true)
        );
      }
    } finally {
      this.controllers.delete(session.id);
    }
  }

  private async consumeJson(sessionId: string, assistantMessageId: string, response: Response) {
    let payload: ChatCompletionResponse;

    try {
      payload = (await response.json()) as ChatCompletionResponse;
    } catch {
      this.failSession(
        sessionId,
        assistantMessageId,
        createError('INVALID_RESPONSE', 'The server returned a non-JSON chat response.', false)
      );
      return;
    }

    const content = payload.choices?.[0]?.message?.content?.trim() ?? '';
    if (!content) {
      this.failSession(
        sessionId,
        assistantMessageId,
        createError('INVALID_RESPONSE', 'The chat response did not include assistant content.', false)
      );
      return;
    }

    this.appendAssistantDelta(sessionId, assistantMessageId, content);
    this.completeSession(sessionId, assistantMessageId);
  }

  private async consumeSse(
    sessionId: string,
    assistantMessageId: string,
    response: Response,
    controller: AbortController
  ) {
    const reader = response.body?.getReader();
    if (!reader) {
      this.failSession(
        sessionId,
        assistantMessageId,
        createError('INVALID_RESPONSE', 'The streaming response body was not readable.', false)
      );
      return;
    }

    const decoder = new TextDecoder('utf8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        const lines = chunk
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data:')) {
            continue;
          }

          const payload = line.slice(5).trim();
          if (payload === '[DONE]') {
            this.completeSession(sessionId, assistantMessageId);
            return;
          }

          try {
            const parsed = JSON.parse(payload) as ChatCompletionResponse;
            const delta = parsed.choices?.[0]?.delta?.content ?? '';
            if (delta) {
              this.appendAssistantDelta(sessionId, assistantMessageId, delta);
            }
            if (parsed.choices?.[0]?.finish_reason) {
              this.completeSession(sessionId, assistantMessageId);
              return;
            }
          } catch {
            if (!controller.signal.aborted) {
              this.failSession(
                sessionId,
                assistantMessageId,
                createError('INVALID_RESPONSE', 'The streaming response included malformed event data.', false)
              );
            }
            return;
          }
        }
      }
    }

    this.completeSession(sessionId, assistantMessageId);
  }

  private appendAssistantDelta(sessionId: string, assistantMessageId: string, delta: string) {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return;
    }

    const nextSession: ChatSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      messages: session.messages.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              content: `${message.content}${delta}`,
              status: 'streaming'
            }
          : message
      )
    };

    this.sessionStore.save(nextSession);
    this.broadcast({
      type: 'chat-delta',
      sessionId,
      messageId: assistantMessageId,
      delta
    });
  }

  private completeSession(sessionId: string, assistantMessageId: string) {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return;
    }

    const nextSession: ChatSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      messages: session.messages.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              status: 'done'
            }
          : message
      )
    };

    this.sessionStore.save(nextSession);
    this.broadcast({
      type: 'chat-complete',
      session: nextSession
    });
  }

  private abortSession(sessionId: string, assistantMessageId: string) {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return;
    }

    const nextMessages = session.messages.flatMap((message) => {
      if (message.id !== assistantMessageId) {
        return [message];
      }

      if (!message.content.trim()) {
        return [];
      }

      return [
        {
          ...message,
          status: 'done' as const
        }
      ];
    });

    const nextSession: ChatSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      messages: nextMessages
    };

    this.sessionStore.save(nextSession);
    this.broadcast({
      type: 'chat-abort',
      session: nextSession
    });
  }

  private failSession(sessionId: string, assistantMessageId: string, error: IpcError) {
    const session = this.sessionStore.get(sessionId);
    if (!session) {
      return;
    }

    const nextMessages = session.messages.flatMap((message) => {
      if (message.id !== assistantMessageId) {
        return [message];
      }

      if (!message.content.trim()) {
        return [];
      }

      return [
        {
          ...message,
          status: 'error' as const
        }
      ];
    });

    const nextSession: ChatSession = {
      ...session,
      updatedAt: new Date().toISOString(),
      messages: nextMessages
    };

    this.sessionStore.save(nextSession);
    this.broadcast({
      type: 'chat-error',
      session: nextSession,
      error
    });
  }

  private broadcast(event: ChatEvent) {
    for (const window of this.getWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('chat:event', event);
      }
    }
  }
}
