import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { toSessionSummary, type ChatSession, type SessionSummary } from '../shared/chat';

type SessionStorePayload = {
  sessions: ChatSession[];
};

export class ChatSessionStore {
  private readonly filePath = join(app.getPath('userData'), 'chat-sessions.json');
  private sessions: ChatSession[];
  private writeTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.sessions = this.readSessionsFromDisk();
  }

  list(): SessionSummary[] {
    return [...this.sessions]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((session) => toSessionSummary(session));
  }

  get(sessionId: string): ChatSession | null {
    return this.sessions.find((session) => session.id === sessionId) ?? null;
  }

  save(session: ChatSession): ChatSession {
    const index = this.sessions.findIndex((item) => item.id === session.id);

    if (index >= 0) {
      this.sessions[index] = session;
    } else {
      this.sessions.push(session);
    }

    this.scheduleWrite();
    return session;
  }

  clear(sessionId: string) {
    this.sessions = this.sessions.filter((session) => session.id !== sessionId);
    this.scheduleWrite();
  }

  flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.writeSessions(this.sessions);
  }

  private readSessionsFromDisk(): ChatSession[] {
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

  private scheduleWrite() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }

    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.writeSessions(this.sessions);
    }, 120);
  }
}
