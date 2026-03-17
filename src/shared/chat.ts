import type { IpcError } from './config';

export const MAX_CHAT_MESSAGE_CHARS = 4_000;

export type ChatMessage = {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  createdAt: string;
  status?: 'streaming' | 'done' | 'error';
};

export type SessionSummary = {
  id: string;
  title: string;
  updatedAt: string;
  lastMessagePreview: string;
};

export type ChatSession = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ChatEvent =
  | { type: 'chat-start'; session: ChatSession }
  | { type: 'chat-delta'; sessionId: string; messageId: string; delta: string }
  | { type: 'chat-complete'; session: ChatSession }
  | { type: 'chat-error'; session: ChatSession; error: IpcError }
  | { type: 'chat-abort'; session: ChatSession };

export function deriveSessionTitle(message: string): string {
  const trimmed = message.replace(/\s+/g, ' ').trim();

  if (!trimmed) {
    return 'New chat';
  }

  return trimmed.length > 32 ? `${trimmed.slice(0, 32).trimEnd()}...` : trimmed;
}

export function toSessionSummary(session: ChatSession): SessionSummary {
  const lastMessage = [...session.messages]
    .reverse()
    .find((message) => message.role !== 'system');

  return {
    id: session.id,
    title: session.title,
    updatedAt: session.updatedAt,
    lastMessagePreview: lastMessage?.content.slice(0, 80) ?? ''
  };
}
