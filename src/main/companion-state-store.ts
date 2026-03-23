import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app } from 'electron';
import {
  DEFAULT_COMPANION_MEMORY,
  DEFAULT_COMPANION_PREFS,
  type CompanionActivity,
  type CompanionMemory,
  type CompanionPersistedState,
  type CompanionPrefs,
  sanitizeCompanionPrefs
} from '../shared/companion';

const MAX_ACTIVITY_ITEMS = 40;

function cloneMemory(memory: CompanionMemory): CompanionMemory {
  return {
    lastPromptAt: memory.lastPromptAt,
    lastInteractionAt: memory.lastInteractionAt,
    ignoredCount: memory.ignoredCount,
    templateShownAt: { ...memory.templateShownAt }
  };
}

function sanitizeMemory(input: Partial<CompanionMemory> | undefined): CompanionMemory {
  const ignoredCount =
    typeof input?.ignoredCount === 'number' && Number.isFinite(input.ignoredCount) && input.ignoredCount >= 0
      ? Math.floor(input.ignoredCount)
      : DEFAULT_COMPANION_MEMORY.ignoredCount;

  const templateShownAt: Record<string, string> = {};
  if (input?.templateShownAt && typeof input.templateShownAt === 'object') {
    for (const [key, value] of Object.entries(input.templateShownAt)) {
      if (typeof value === 'string' && value.trim()) {
        templateShownAt[key] = value;
      }
    }
  }

  return {
    lastPromptAt: typeof input?.lastPromptAt === 'string' ? input.lastPromptAt : DEFAULT_COMPANION_MEMORY.lastPromptAt,
    lastInteractionAt:
      typeof input?.lastInteractionAt === 'string'
        ? input.lastInteractionAt
        : DEFAULT_COMPANION_MEMORY.lastInteractionAt,
    ignoredCount,
    templateShownAt
  };
}

function sanitizeActivities(input: unknown): CompanionActivity[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item) => item && typeof item === 'object')
    .map((item) => item as Partial<CompanionActivity>)
    .filter(
      (item) =>
        typeof item.id === 'string' &&
        typeof item.type === 'string' &&
        typeof item.text === 'string' &&
        typeof item.createdAt === 'string'
    )
    .map((item) => ({
      id: item.id as string,
      type: item.type as CompanionActivity['type'],
      text: item.text as string,
      createdAt: item.createdAt as string,
      promptId: typeof item.promptId === 'string' ? item.promptId : undefined,
      actionId: typeof item.actionId === 'string' ? item.actionId : undefined,
      seedMessage: typeof item.seedMessage === 'string' ? item.seedMessage : undefined
    }))
    .slice(0, MAX_ACTIVITY_ITEMS);
}

export class CompanionStateStore {
  private readonly filePath = join(app.getPath('userData'), 'companion-state.json');
  private readonly saveDelayMs = 120;
  private saveTimer: NodeJS.Timeout | null = null;

  private state: CompanionPersistedState;

  constructor() {
    this.state = this.load();
  }

  getPrefs(): CompanionPrefs {
    return {
      ...this.state.prefs,
      quietHours: {
        ...this.state.prefs.quietHours
      }
    };
  }

  savePrefs(prefs: CompanionPrefs): CompanionPrefs {
    this.state = {
      ...this.state,
      prefs: sanitizeCompanionPrefs(prefs)
    };
    this.scheduleSave();
    return this.getPrefs();
  }

  getMemory(): CompanionMemory {
    return cloneMemory(this.state.memory);
  }

  updateMemory(nextMemory: Partial<CompanionMemory>) {
    this.state = {
      ...this.state,
      memory: sanitizeMemory({
        ...this.state.memory,
        ...nextMemory
      })
    };
    this.scheduleSave();
  }

  noteInteraction(atIso: string) {
    this.updateMemory({
      lastInteractionAt: atIso
    });
  }

  notePromptShown(templateId: string, atIso: string) {
    this.updateMemory({
      lastPromptAt: atIso,
      templateShownAt: {
        ...this.state.memory.templateShownAt,
        [templateId]: atIso
      }
    });
  }

  incrementIgnored() {
    this.updateMemory({
      ignoredCount: this.state.memory.ignoredCount + 1
    });
  }

  listActivities(limit = 8): CompanionActivity[] {
    return [...this.state.activities]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(1, limit));
  }

  addActivity(input: Omit<CompanionActivity, 'id'>): CompanionActivity {
    const activity: CompanionActivity = {
      ...input,
      id: randomUUID()
    };

    this.state = {
      ...this.state,
      activities: [activity, ...this.state.activities].slice(0, MAX_ACTIVITY_ITEMS)
    };
    this.scheduleSave();
    return activity;
  }

  flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.save();
  }

  private load(): CompanionPersistedState {
    if (!existsSync(this.filePath)) {
      return {
        prefs: DEFAULT_COMPANION_PREFS,
        memory: DEFAULT_COMPANION_MEMORY,
        activities: []
      };
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<CompanionPersistedState>;
      return {
        prefs: sanitizeCompanionPrefs(parsed.prefs),
        memory: sanitizeMemory(parsed.memory),
        activities: sanitizeActivities(parsed.activities)
      };
    } catch {
      return {
        prefs: DEFAULT_COMPANION_PREFS,
        memory: DEFAULT_COMPANION_MEMORY,
        activities: []
      };
    }
  }

  private save() {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2));
  }

  private scheduleSave() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, this.saveDelayMs);
  }
}
