import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { toSessionSummary, type ChatSession, type SessionSummary } from '../shared/chat';

type SessionStorePayload = {
  sessions: ChatSession[];
};

export class ChatSessionStore {
  private readonly filePath = join(app.getPath('userData'), 'chat-sessions.json');

  list(): SessionSummary[] {
    return this.readSessions()
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((session) => toSessionSummary(session));
  }

  get(sessionId: string): ChatSession | null {
    return this.readSessions().find((session) => session.id === sessionId) ?? null;
  }

  save(session: ChatSession): ChatSession {
    const sessions = this.readSessions();
    const index = sessions.findIndex((item) => item.id === session.id);

    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }

    this.writeSessions(sessions);
    return session;
  }

  clear(sessionId: string) {
    const sessions = this.readSessions().filter((session) => session.id !== sessionId);
    this.writeSessions(sessions);
  }

  private readSessions(): ChatSession[] {
    if (!existsSync(this.filePath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as SessionStorePayload;
      return Array.isArray(parsed.sessions) ? parsed.sessions : [];
    } catch {
      return [];
    }
  }

  private writeSessions(sessions: ChatSession[]) {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify({ sessions }, null, 2));
  }
}

