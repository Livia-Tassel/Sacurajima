import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompanionEngine } from './companion-engine';
import {
  DEFAULT_COMPANION_MEMORY,
  DEFAULT_COMPANION_PREFS,
  type CompanionActivity,
  type CompanionEvent,
  type CompanionMemory,
  type CompanionPrefs
} from '../shared/companion';
import type { ChatSession } from '../shared/chat';
import type { CompanionStateStore } from './companion-state-store';

type ScheduledTask = {
  callback: () => void;
  canceled: boolean;
  dueAt: number;
};

class FakeClock {
  private nowMs = Date.parse('2026-03-17T10:00:00.000Z');
  private readonly tasks: ScheduledTask[] = [];

  now = () => new Date(this.nowMs);
  random = () => 0.5;

  setTimeout = (callback: () => void, delayMs: number) => {
    const task: ScheduledTask = {
      callback,
      canceled: false,
      dueAt: this.nowMs + delayMs
    };
    this.tasks.push(task);
    return task as unknown as ReturnType<typeof setTimeout>;
  };

  clearTimeout = (timer: ReturnType<typeof setTimeout>) => {
    const task = timer as unknown as ScheduledTask;
    task.canceled = true;
  };

  advance(ms: number) {
    const target = this.nowMs + ms;

    while (true) {
      let nextTask: ScheduledTask | null = null;
      for (const task of this.tasks) {
        if (task.canceled || task.dueAt > target) {
          continue;
        }
        if (!nextTask || task.dueAt < nextTask.dueAt) {
          nextTask = task;
        }
      }

      if (!nextTask) {
        break;
      }

      nextTask.canceled = true;
      this.nowMs = nextTask.dueAt;
      nextTask.callback();
    }

    this.nowMs = target;
  }
}

class FakeCompanionStateStore {
  prefs: CompanionPrefs = {
    ...DEFAULT_COMPANION_PREFS,
    quietHours: { ...DEFAULT_COMPANION_PREFS.quietHours }
  };
  memory: CompanionMemory = {
    ...DEFAULT_COMPANION_MEMORY,
    templateShownAt: {}
  };
  activities: CompanionActivity[] = [];

  getPrefs() {
    return {
      ...this.prefs,
      quietHours: { ...this.prefs.quietHours }
    };
  }

  savePrefs(prefs: CompanionPrefs) {
    this.prefs = {
      ...prefs,
      quietHours: { ...prefs.quietHours }
    };
    return this.getPrefs();
  }

  getMemory() {
    return {
      ...this.memory,
      templateShownAt: { ...this.memory.templateShownAt }
    };
  }

  updateMemory(nextMemory: Partial<CompanionMemory>) {
    this.memory = {
      ...this.memory,
      ...nextMemory,
      templateShownAt: {
        ...this.memory.templateShownAt,
        ...(nextMemory.templateShownAt ?? {})
      }
    };
  }

  noteInteraction(atIso: string) {
    this.updateMemory({ lastInteractionAt: atIso });
  }

  notePromptShown(templateId: string, atIso: string) {
    this.updateMemory({
      lastPromptAt: atIso,
      templateShownAt: {
        ...this.memory.templateShownAt,
        [templateId]: atIso
      }
    });
  }

  incrementIgnored() {
    this.updateMemory({
      ignoredCount: this.memory.ignoredCount + 1
    });
  }

  listActivities(limit = 8) {
    return this.activities.slice(0, limit);
  }

  addActivity(input: Omit<CompanionActivity, 'id'>) {
    const activity: CompanionActivity = {
      ...input,
      id: `activity-${this.activities.length + 1}`
    };
    this.activities.unshift(activity);
    return activity;
  }
}

function createDummySession(): ChatSession {
  const now = '2026-03-17T10:00:00.000Z';
  return {
    id: 'session-1',
    title: 'Test',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

describe('companion engine', () => {
  it('emits startup prompt after initial delay', () => {
    const store = new FakeCompanionStateStore();
    const clock = new FakeClock();
    const events: CompanionEvent[] = [];
    const engine = new CompanionEngine(
      store as unknown as CompanionStateStore,
      (event) => {
        events.push(event);
      },
      {
        now: clock.now,
        random: clock.random,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
      }
    );

    engine.start();
    clock.advance(7_999);
    assert.equal(events.some((event) => event.type === 'companion-prompt'), false);

    clock.advance(1);
    assert.equal(events.some((event) => event.type === 'companion-prompt'), true);
    assert.equal(store.activities.some((activity) => activity.type === 'prompt'), true);
  });

  it('skips proactive prompt during quiet hours', () => {
    const store = new FakeCompanionStateStore();
    store.prefs = {
      ...store.prefs,
      quietHours: {
        start: '00:00',
        end: '23:59'
      }
    };
    const clock = new FakeClock();
    const events: CompanionEvent[] = [];
    const engine = new CompanionEngine(
      store as unknown as CompanionStateStore,
      (event) => {
        events.push(event);
      },
      {
        now: clock.now,
        random: clock.random,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
      }
    );

    engine.start();
    clock.advance(8_000);

    assert.equal(events.some((event) => event.type === 'companion-prompt'), false);
    assert.equal(
      events.some(
        (event) => event.type === 'companion-state' && event.mood === 'sleepy' && event.reason === 'quiet-hours'
      ),
      true
    );
  });

  it('captures action responses and dismisses active prompt', () => {
    const store = new FakeCompanionStateStore();
    const clock = new FakeClock();
    const events: CompanionEvent[] = [];
    const engine = new CompanionEngine(
      store as unknown as CompanionStateStore,
      (event) => {
        events.push(event);
      },
      {
        now: clock.now,
        random: clock.random,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
      }
    );

    engine.start();
    clock.advance(8_000);
    const promptEvent = events.find((event) => event.type === 'companion-prompt');
    assert.ok(promptEvent && promptEvent.type === 'companion-prompt');

    const firstAction = promptEvent.prompt.actions[0];
    const result = engine.respond({
      promptId: promptEvent.prompt.id,
      actionId: firstAction.id
    });
    assert.equal(result.ok, true);
    assert.equal(store.activities.some((activity) => activity.type === 'response'), true);
    assert.equal(events.some((event) => event.type === 'companion-action-result'), true);
    assert.equal(events.some((event) => event.type === 'companion-dismiss'), true);
  });

  it('avoids repeating the same template inside the cooldown window', () => {
    const store = new FakeCompanionStateStore();
    const clock = new FakeClock();
    const events: CompanionEvent[] = [];
    const engine = new CompanionEngine(
      store as unknown as CompanionStateStore,
      (event) => {
        events.push(event);
      },
      {
        now: clock.now,
        random: () => 0,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
      }
    );

    engine.start();
    clock.advance(8_000);
    const firstPrompt = events.find((event) => event.type === 'companion-prompt');
    assert.ok(firstPrompt && firstPrompt.type === 'companion-prompt');

    const dismissResult = engine.dismiss(firstPrompt.prompt.id);
    assert.equal(dismissResult.ok, true);

    const nudgeResult = engine.nudge();
    assert.equal(nudgeResult.ok, true);
    assert.equal(nudgeResult.data.triggered, true);

    const prompts = events.filter((event) => event.type === 'companion-prompt');
    assert.equal(prompts.length >= 2, true);
    const secondPrompt = prompts[1];
    assert.ok(secondPrompt && secondPrompt.type === 'companion-prompt');
    assert.notEqual(firstPrompt.prompt.templateId, secondPrompt.prompt.templateId);
  });

  it('maps chat lifecycle events to companion mood states', () => {
    const store = new FakeCompanionStateStore();
    const clock = new FakeClock();
    const events: CompanionEvent[] = [];
    const engine = new CompanionEngine(
      store as unknown as CompanionStateStore,
      (event) => {
        events.push(event);
      },
      {
        now: clock.now,
        random: clock.random,
        setTimeout: clock.setTimeout,
        clearTimeout: clock.clearTimeout
      }
    );

    engine.handleChatEvent({
      type: 'chat-start',
      session: createDummySession()
    });
    engine.handleChatEvent({
      type: 'chat-complete',
      session: createDummySession()
    });
    engine.handleChatEvent({
      type: 'chat-error',
      session: createDummySession(),
      error: {
        code: 'NETWORK_ERROR',
        message: 'Network',
        retriable: true
      }
    });

    assert.equal(
      events.some((event) => event.type === 'companion-state' && event.mood === 'thinking'),
      true
    );
    assert.equal(
      events.some((event) => event.type === 'companion-state' && event.mood === 'happy'),
      true
    );
    assert.equal(
      events.some((event) => event.type === 'companion-state' && event.mood === 'error'),
      true
    );
  });
});
