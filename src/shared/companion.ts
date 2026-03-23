export type CompanionMood =
  | 'idle'
  | 'checkin'
  | 'listening'
  | 'thinking'
  | 'happy'
  | 'sleepy'
  | 'error';

export type CompanionProactiveLevel = 'low' | 'balanced' | 'active';

export type CompanionPrefs = {
  proactiveEnabled: boolean;
  proactiveLevel: CompanionProactiveLevel;
  quietHours: {
    start: string;
    end: string;
  };
};

export type CompanionPromptAction = {
  id: string;
  label: string;
  seedMessage: string;
  resultingMood?: CompanionMood;
};

export type CompanionPrompt = {
  id: string;
  templateId: string;
  text: string;
  actions: CompanionPromptAction[];
  createdAt: string;
  expiresAt: string;
};

export type CompanionDismissReason = 'timeout' | 'manual' | 'acted';

export type CompanionEvent =
  | {
      type: 'companion-state';
      mood: CompanionMood;
      reason: string;
    }
  | {
      type: 'companion-prompt';
      prompt: CompanionPrompt;
    }
  | {
      type: 'companion-dismiss';
      promptId: string;
      reason: CompanionDismissReason;
    }
  | {
      type: 'companion-action-result';
      promptId: string;
      action: CompanionPromptAction;
      seedMessage: string;
      mood: CompanionMood;
    };

export type CompanionActivityType = 'prompt' | 'response' | 'dismiss';

export type CompanionActivity = {
  id: string;
  type: CompanionActivityType;
  text: string;
  createdAt: string;
  promptId?: string;
  actionId?: string;
  seedMessage?: string;
};

export type CompanionMemory = {
  lastPromptAt: string;
  lastInteractionAt: string;
  ignoredCount: number;
  templateShownAt: Record<string, string>;
};

export type CompanionPersistedState = {
  prefs: CompanionPrefs;
  memory: CompanionMemory;
  activities: CompanionActivity[];
};

export type CompanionRespondInput = {
  promptId: string;
  actionId: string;
};

export const DEFAULT_COMPANION_PREFS: CompanionPrefs = {
  proactiveEnabled: true,
  proactiveLevel: 'active',
  quietHours: {
    start: '23:00',
    end: '08:00'
  }
};

export const DEFAULT_COMPANION_MEMORY: CompanionMemory = {
  lastPromptAt: '',
  lastInteractionAt: '',
  ignoredCount: 0,
  templateShownAt: {}
};

export const DEFAULT_COMPANION_STATE: CompanionPersistedState = {
  prefs: DEFAULT_COMPANION_PREFS,
  memory: DEFAULT_COMPANION_MEMORY,
  activities: []
};

function parseHourMinute(value: string): { hour: number; minute: number } | null {
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(value)) {
    return null;
  }

  const [hour, minute] = value.split(':').map((part) => Number(part));
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return null;
  }

  return { hour, minute };
}

function toMinutes(value: { hour: number; minute: number }) {
  return value.hour * 60 + value.minute;
}

export function sanitizeCompanionPrefs(input: Partial<CompanionPrefs> | undefined): CompanionPrefs {
  const enabled =
    typeof input?.proactiveEnabled === 'boolean'
      ? input.proactiveEnabled
      : DEFAULT_COMPANION_PREFS.proactiveEnabled;

  const level =
    input?.proactiveLevel === 'low' ||
    input?.proactiveLevel === 'balanced' ||
    input?.proactiveLevel === 'active'
      ? input.proactiveLevel
      : DEFAULT_COMPANION_PREFS.proactiveLevel;

  const start = parseHourMinute(input?.quietHours?.start ?? '')
    ? (input?.quietHours?.start as string)
    : DEFAULT_COMPANION_PREFS.quietHours.start;

  const end = parseHourMinute(input?.quietHours?.end ?? '')
    ? (input?.quietHours?.end as string)
    : DEFAULT_COMPANION_PREFS.quietHours.end;

  return {
    proactiveEnabled: enabled,
    proactiveLevel: level,
    quietHours: {
      start,
      end
    }
  };
}

export function isWithinQuietHours(date: Date, quietHours: CompanionPrefs['quietHours']): boolean {
  const start = parseHourMinute(quietHours.start);
  const end = parseHourMinute(quietHours.end);

  if (!start || !end) {
    return false;
  }

  const nowMinutes = date.getHours() * 60 + date.getMinutes();
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);

  if (startMinutes === endMinutes) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }

  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export function resolveProactiveIntervalMs(level: CompanionProactiveLevel, randomValue: number): number {
  const baseMinutes = level === 'low' ? 60 : level === 'balanced' ? 45 : 30;
  const jitterMinutes = level === 'low' ? 12 : level === 'balanced' ? 10 : 8;
  const normalized = Math.min(Math.max(randomValue, 0), 1);
  const offset = Math.round((normalized * 2 - 1) * jitterMinutes);

  return Math.max(1, baseMinutes + offset) * 60_000;
}

export function hasTemplateCooldownElapsed(
  previousAtIso: string | undefined,
  now: Date,
  cooldownHours: number
): boolean {
  if (!previousAtIso) {
    return true;
  }

  const previousAt = new Date(previousAtIso);
  if (Number.isNaN(previousAt.getTime())) {
    return true;
  }

  return now.getTime() - previousAt.getTime() >= cooldownHours * 60 * 60 * 1000;
}

export function hasRecentInteraction(
  lastInteractionAtIso: string,
  now: Date,
  thresholdMinutes: number
): boolean {
  if (!lastInteractionAtIso) {
    return false;
  }

  const lastInteractionAt = new Date(lastInteractionAtIso);
  if (Number.isNaN(lastInteractionAt.getTime())) {
    return false;
  }

  return now.getTime() - lastInteractionAt.getTime() < thresholdMinutes * 60_000;
}
