export const FUN_STORAGE_KEY = 'sakurajima-companion-fun-v1';
export const DAILY_PET_TARGET = 8;

export type CompanionFunState = {
  petals: number;
  level: number;
  exp: number;
  streakDays: number;
  bestCombo: number;
  petCountToday: number;
  lastActiveDay: string;
  dailyDay: string;
  daily: {
    checkedIn: boolean;
    playedGame: boolean;
    pettedEnough: boolean;
    bonusClaimed: boolean;
  };
};

export function toLocalDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function previousLocalDayKey(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return toLocalDay(date);
}

export function expThreshold(level: number): number {
  return 60 + level * 24;
}

export function createDefaultFunState(today = toLocalDay()): CompanionFunState {
  return {
    petals: 24,
    level: 1,
    exp: 0,
    streakDays: 1,
    bestCombo: 0,
    petCountToday: 0,
    lastActiveDay: today,
    dailyDay: today,
    daily: {
      checkedIn: false,
      playedGame: false,
      pettedEnough: false,
      bonusClaimed: false
    }
  };
}

export function ensureDailyState(state: CompanionFunState): CompanionFunState {
  const today = toLocalDay();
  if (state.dailyDay === today) {
    return state;
  }
  return {
    ...state,
    dailyDay: today,
    petCountToday: 0,
    daily: {
      checkedIn: false,
      playedGame: false,
      pettedEnough: false,
      bonusClaimed: false
    }
  };
}

export function normalizeFunState(input: unknown): CompanionFunState {
  const today = toLocalDay();
  const fallback = createDefaultFunState(today);
  if (!input || typeof input !== 'object') {
    return fallback;
  }

  const value = input as Partial<CompanionFunState>;
  const daily = value.daily ?? fallback.daily;

  const normalized: CompanionFunState = {
    petals: Number.isFinite(value.petals)
      ? Math.max(0, Math.floor(value.petals as number))
      : fallback.petals,
    level: Number.isFinite(value.level)
      ? Math.max(1, Math.floor(value.level as number))
      : fallback.level,
    exp: Number.isFinite(value.exp)
      ? Math.max(0, Math.floor(value.exp as number))
      : fallback.exp,
    streakDays: Number.isFinite(value.streakDays)
      ? Math.max(1, Math.floor(value.streakDays as number))
      : fallback.streakDays,
    bestCombo: Number.isFinite(value.bestCombo)
      ? Math.max(0, Math.floor(value.bestCombo as number))
      : fallback.bestCombo,
    petCountToday: Number.isFinite(value.petCountToday)
      ? Math.max(0, Math.floor(value.petCountToday as number))
      : fallback.petCountToday,
    lastActiveDay:
      typeof value.lastActiveDay === 'string' ? value.lastActiveDay : fallback.lastActiveDay,
    dailyDay: typeof value.dailyDay === 'string' ? value.dailyDay : fallback.dailyDay,
    daily: {
      checkedIn: Boolean(daily.checkedIn),
      playedGame: Boolean(daily.playedGame),
      pettedEnough: Boolean(daily.pettedEnough),
      bonusClaimed: Boolean(daily.bonusClaimed)
    }
  };

  return ensureDailyState(normalized);
}

export function loadFunState(): CompanionFunState {
  try {
    const raw = window.localStorage.getItem(FUN_STORAGE_KEY);
    if (!raw) return createDefaultFunState();
    return normalizeFunState(JSON.parse(raw));
  } catch {
    return createDefaultFunState();
  }
}

export function applyRewards(
  state: CompanionFunState,
  expGain: number,
  petalGain: number
): { state: CompanionFunState; leveledUp: boolean } {
  let nextLevel = state.level;
  let nextExp = state.exp + Math.max(0, Math.floor(expGain));
  let leveledUp = false;

  while (nextExp >= expThreshold(nextLevel)) {
    nextExp -= expThreshold(nextLevel);
    nextLevel += 1;
    leveledUp = true;
  }

  return {
    leveledUp,
    state: {
      ...state,
      level: nextLevel,
      exp: nextExp,
      petals: state.petals + Math.max(0, Math.floor(petalGain))
    }
  };
}
