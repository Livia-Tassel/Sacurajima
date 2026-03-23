import { useEffect, useMemo, useRef, useState } from 'react';
import type { CompanionEvent, CompanionMood, CompanionPrompt } from '../../../shared/companion';
import { MascotArtwork } from './MascotArtwork';

type CompanionViewProps = {
  hasConfig: boolean;
  version: string;
  onOpenPanel: () => void;
};

type RpsChoice = 'rock' | 'paper' | 'scissors';

type CompanionFunState = {
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

const FUN_STORAGE_KEY = 'sakurajima-companion-fun-v1';
const DAILY_PET_TARGET = 8;
const COMBO_TIMEOUT_MS = 1800;

const PET_REACTIONS = [
  'Soft pat received.',
  'That feels comforting.',
  'Your touch is warm today.',
  'Mood restored a little.'
];

const SURPRISE_EVENTS: Array<{
  text: string;
  exp: number;
  petals: number;
  mood: CompanionMood;
}> = [
  {
    text: 'A small sakura envelope drifted in with a gentle compliment.',
    exp: 16,
    petals: 7,
    mood: 'happy'
  },
  {
    text: 'Sakurajima queued a tiny breathing break for you.',
    exp: 14,
    petals: 5,
    mood: 'listening'
  },
  {
    text: 'A lucky shimmer popped. Bonus petals unlocked.',
    exp: 20,
    petals: 10,
    mood: 'happy'
  }
];

const RPS_LABELS: Record<RpsChoice, string> = {
  rock: 'Rock',
  paper: 'Paper',
  scissors: 'Scissors'
};

function toLocalDay(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function previousLocalDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() - 1);
  return toLocalDay(date);
}

function expThreshold(level: number) {
  return 60 + level * 24;
}

function createDefaultFunState(today = toLocalDay()): CompanionFunState {
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

function normalizeFunState(input: unknown): CompanionFunState {
  const today = toLocalDay();
  const fallback = createDefaultFunState(today);
  if (!input || typeof input !== 'object') {
    return fallback;
  }

  const value = input as Partial<CompanionFunState>;
  const daily = value.daily ?? fallback.daily;

  const normalized: CompanionFunState = {
    petals: Number.isFinite(value.petals) ? Math.max(0, Math.floor(value.petals as number)) : fallback.petals,
    level: Number.isFinite(value.level) ? Math.max(1, Math.floor(value.level as number)) : fallback.level,
    exp: Number.isFinite(value.exp) ? Math.max(0, Math.floor(value.exp as number)) : fallback.exp,
    streakDays: Number.isFinite(value.streakDays)
      ? Math.max(1, Math.floor(value.streakDays as number))
      : fallback.streakDays,
    bestCombo: Number.isFinite(value.bestCombo)
      ? Math.max(0, Math.floor(value.bestCombo as number))
      : fallback.bestCombo,
    petCountToday: Number.isFinite(value.petCountToday)
      ? Math.max(0, Math.floor(value.petCountToday as number))
      : fallback.petCountToday,
    lastActiveDay: typeof value.lastActiveDay === 'string' ? value.lastActiveDay : fallback.lastActiveDay,
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

function loadFunState() {
  try {
    const raw = window.localStorage.getItem(FUN_STORAGE_KEY);
    if (!raw) {
      return createDefaultFunState();
    }
    return normalizeFunState(JSON.parse(raw));
  } catch {
    return createDefaultFunState();
  }
}

function ensureDailyState(state: CompanionFunState): CompanionFunState {
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

function applyRewards(
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

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

function resolveRpsResult(player: RpsChoice, companion: RpsChoice): 'win' | 'lose' | 'draw' {
  if (player === companion) {
    return 'draw';
  }

  if (
    (player === 'rock' && companion === 'scissors') ||
    (player === 'paper' && companion === 'rock') ||
    (player === 'scissors' && companion === 'paper')
  ) {
    return 'win';
  }

  return 'lose';
}

export function CompanionView({ hasConfig, version, onOpenPanel }: CompanionViewProps) {
  const [mood, setMood] = useState<CompanionMood>(hasConfig ? 'idle' : 'sleepy');
  const [prompt, setPrompt] = useState<CompanionPrompt | null>(null);
  const [statusHint, setStatusHint] = useState('');
  const [busyActionId, setBusyActionId] = useState('');
  const [funState, setFunState] = useState<CompanionFunState>(() => loadFunState());
  const [combo, setCombo] = useState(0);
  const [showGame, setShowGame] = useState(false);
  const [lastGameResult, setLastGameResult] = useState('');
  const [surpriseText, setSurpriseText] = useState('');
  const [levelUpPulse, setLevelUpPulse] = useState(false);
  const comboRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const comboTimerRef = useRef<number | null>(null);
  const lastKnownLevelRef = useRef(funState.level);

  useEffect(() => {
    setFunState((current) => ensureDailyState(current));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FUN_STORAGE_KEY, JSON.stringify(funState));
  }, [funState]);

  useEffect(() => {
    if (funState.level > lastKnownLevelRef.current) {
      setStatusHint(`Level up! You reached Lv.${funState.level}.`);
      setLevelUpPulse(true);
      window.setTimeout(() => {
        setLevelUpPulse(false);
      }, 900);
    }
    lastKnownLevelRef.current = funState.level;
  }, [funState.level]);

  useEffect(
    () => () => {
      if (comboTimerRef.current) {
        window.clearTimeout(comboTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!hasConfig) {
      setMood('sleepy');
    }
  }, [hasConfig]);

  useEffect(() => {
    const unsubscribe = window.sakurajima.events.onCompanionEvent((event: CompanionEvent) => {
      if (event.type === 'companion-state') {
        const nextMood = !hasConfig && event.mood === 'idle' ? 'sleepy' : event.mood;
        setMood(nextMood);
        return;
      }

      if (event.type === 'companion-prompt') {
        setPrompt(event.prompt);
        setStatusHint('');
        setShowGame(false);
        setMood('checkin');
        return;
      }

      if (event.type === 'companion-dismiss') {
        setPrompt((current) => (current?.id === event.promptId ? null : current));
        setBusyActionId('');
        return;
      }

      if (event.type === 'companion-action-result') {
        setPrompt((current) => (current?.id === event.promptId ? null : current));
        setMood(event.mood);
        setBusyActionId('');
        setStatusHint(`Captured: ${event.action.label}`);
        setFunState((current) => {
          let next = ensureDailyState(current);
          const today = toLocalDay();
          const yesterday = previousLocalDayKey(today);

          if (next.lastActiveDay !== today) {
            next = {
              ...next,
              streakDays: next.lastActiveDay === yesterday ? next.streakDays + 1 : 1,
              lastActiveDay: today
            };
          }

          next = {
            ...next,
            daily: {
              ...next.daily,
              checkedIn: true
            }
          };

          return applyRewards(next, 14, 5).state;
        });
      }
    });

    return unsubscribe;
  }, [hasConfig]);

  const moodText = useMemo(() => {
    if (!hasConfig) {
      return 'Finish setup.';
    }

    if (mood === 'checkin') {
      return 'A gentle check-in.';
    }
    if (mood === 'listening') {
      return 'I am listening.';
    }
    if (mood === 'thinking') {
      return 'Thinking...';
    }
    if (mood === 'happy') {
      return 'Here with you.';
    }
    if (mood === 'error') {
      return 'Tap to regroup.';
    }
    if (mood === 'sleepy') {
      return 'Quiet mode.';
    }

    return 'Ready.';
  }, [hasConfig, mood]);

  const expProgress = Math.min(1, funState.exp / expThreshold(funState.level));
  const dailyComplete =
    funState.daily.checkedIn &&
    funState.daily.playedGame &&
    funState.daily.pettedEnough;

  const touchStreakAndReward = (
    expGain: number,
    petalGain: number,
    updates?: Partial<CompanionFunState['daily']> & {
      petCountDelta?: number;
      bestComboCandidate?: number;
    }
  ) => {
    setFunState((current) => {
      let next = ensureDailyState(current);
      const today = toLocalDay();
      const yesterday = previousLocalDayKey(today);

      if (next.lastActiveDay !== today) {
        next = {
          ...next,
          streakDays: next.lastActiveDay === yesterday ? next.streakDays + 1 : 1,
          lastActiveDay: today
        };
      }

      const petCountToday = next.petCountToday + (updates?.petCountDelta ?? 0);
      const bestCombo = Math.max(next.bestCombo, updates?.bestComboCandidate ?? 0);
      const pettedEnough = (updates?.pettedEnough ?? next.daily.pettedEnough) || petCountToday >= DAILY_PET_TARGET;
      const afterFlags: CompanionFunState = {
        ...next,
        bestCombo,
        petCountToday,
        daily: {
          ...next.daily,
          checkedIn: updates?.checkedIn ?? next.daily.checkedIn,
          playedGame: updates?.playedGame ?? next.daily.playedGame,
          pettedEnough,
          bonusClaimed: updates?.bonusClaimed ?? next.daily.bonusClaimed
        }
      };

      return applyRewards(afterFlags, expGain, petalGain).state;
    });
  };

  const handlePetCompanion = () => {
    const now = Date.now();
    comboRef.current = now - lastTapAtRef.current <= COMBO_TIMEOUT_MS ? comboRef.current + 1 : 1;
    lastTapAtRef.current = now;
    setCombo(comboRef.current);

    if (comboTimerRef.current) {
      window.clearTimeout(comboTimerRef.current);
    }
    comboTimerRef.current = window.setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
    }, COMBO_TIMEOUT_MS);

    const reaction = pickRandom(PET_REACTIONS);
    const comboBonus = comboRef.current >= 5 ? 5 : comboRef.current >= 3 ? 2 : 0;
    touchStreakAndReward(6 + comboRef.current * 2, 1 + comboBonus, {
      petCountDelta: 1,
      bestComboCandidate: comboRef.current
    });

    setMood(comboRef.current >= 4 ? 'happy' : 'listening');
    setStatusHint(`${reaction} Combo x${comboRef.current}.`);
  };

  const triggerNudge = async () => {
    setStatusHint('');
    try {
      const result = await window.sakurajima.companion.nudge();
      if (!result.ok) {
        setStatusHint(result.error.message);
        return;
      }
      touchStreakAndReward(12, 4, {
        checkedIn: true
      });
      setStatusHint(result.data.triggered ? 'Prompt sent.' : 'Prompt already active.');
    } catch (error) {
      setStatusHint(error instanceof Error ? error.message : 'Failed to trigger companion prompt.');
    }
  };

  const dismissPrompt = async () => {
    if (!prompt) {
      return;
    }
    try {
      const result = await window.sakurajima.companion.dismiss(prompt.id);
      if (!result.ok) {
        setStatusHint(result.error.message);
      }
    } catch (error) {
      setStatusHint(error instanceof Error ? error.message : 'Failed to dismiss companion prompt.');
    }
  };

  const respondToPrompt = async (actionId: string) => {
    if (!prompt) {
      return;
    }

    setBusyActionId(actionId);
    setStatusHint('');
    try {
      const result = await window.sakurajima.companion.respond({
        promptId: prompt.id,
        actionId
      });
      if (!result.ok) {
        setStatusHint(result.error.message);
        return;
      }
      setStatusHint('Response recorded.');
    } catch (error) {
      setStatusHint(error instanceof Error ? error.message : 'Failed to submit companion action.');
    } finally {
      setBusyActionId('');
    }
  };

  const playRps = (choice: RpsChoice) => {
    const companionChoice = pickRandom<RpsChoice>(['rock', 'paper', 'scissors']);
    const result = resolveRpsResult(choice, companionChoice);

    if (result === 'win') {
      touchStreakAndReward(22, 10, {
        playedGame: true
      });
      setMood('happy');
      setStatusHint('You won the round. Nice read.');
    } else if (result === 'draw') {
      touchStreakAndReward(10, 4, {
        playedGame: true
      });
      setMood('idle');
      setStatusHint('Draw. You two are synced.');
    } else {
      touchStreakAndReward(8, 3, {
        playedGame: true
      });
      setMood('listening');
      setStatusHint('Companion wins this one. Rematch?');
    }

    setLastGameResult(`You: ${RPS_LABELS[choice]} · Sakurajima: ${RPS_LABELS[companionChoice]} · ${result.toUpperCase()}`);
  };

  const triggerSurprise = () => {
    const event = pickRandom(SURPRISE_EVENTS);
    setSurpriseText(event.text);
    setMood(event.mood);
    touchStreakAndReward(event.exp, event.petals);
    setStatusHint(`Surprise unlocked: +${event.petals} petals`);
  };

  const claimDailyBonus = () => {
    if (!dailyComplete || funState.daily.bonusClaimed) {
      return;
    }

    touchStreakAndReward(64, 24, {
      bonusClaimed: true
    });
    setStatusHint('Daily combo completed. Big reward claimed.');
  };

  return (
    <main className="companion-root">
      <section className="companion-shell">
        <div className={`companion-card companion-card-${mood} ${levelUpPulse ? 'companion-card-level-up' : ''}`}>
          <div className="companion-top-stack">
            <div className="companion-window-bar" aria-hidden="true">
              <span className="companion-window-grip">Move Companion</span>
            </div>
            <div className="companion-status-chip">{moodText}</div>
            <div className="companion-fun-stats">
              <span>Lv {funState.level}</span>
              <span>🌸 {funState.petals}</span>
              <span>🔥 x{Math.max(1, combo)}</span>
              <span>📅 {funState.streakDays}d</span>
            </div>
            <div className="companion-exp-track" aria-hidden="true">
              <span style={{ width: `${Math.round(expProgress * 100)}%` }} />
            </div>
          </div>

          <div className="companion-interaction-zone">
            {prompt ? (
              <section className="companion-prompt-card">
                <p className="companion-prompt-text">{prompt.text}</p>
                <div className="companion-prompt-actions">
                  {prompt.actions.map((action) => (
                    <button
                      key={action.id}
                      className="companion-prompt-action"
                      disabled={busyActionId !== '' && busyActionId !== action.id}
                      onClick={() => void respondToPrompt(action.id)}
                      type="button"
                    >
                      {busyActionId === action.id ? 'Sending...' : action.label}
                    </button>
                  ))}
                </div>
                <button className="companion-prompt-dismiss" onClick={() => void dismissPrompt()} type="button">
                  Dismiss
                </button>
              </section>
            ) : (
              <>
                <div className="companion-fun-actions">
                  <button className="companion-nudge-button" onClick={() => void triggerNudge()} type="button">
                    Check in
                  </button>
                  <button className="companion-nudge-button" onClick={handlePetCompanion} type="button">
                    Pat
                  </button>
                  <button className="companion-nudge-button" onClick={() => setShowGame((current) => !current)} type="button">
                    {showGame ? 'Hide Game' : 'Mini Game'}
                  </button>
                  <button className="companion-nudge-button" onClick={triggerSurprise} type="button">
                    Surprise
                  </button>
                </div>

                {showGame ? (
                  <section className="companion-mini-game-card">
                    <p className="companion-mini-game-title">Rock · Paper · Scissors</p>
                    <div className="companion-mini-game-actions">
                      {(['rock', 'paper', 'scissors'] as RpsChoice[]).map((choice) => (
                        <button
                          key={choice}
                          className="companion-mini-choice"
                          onClick={() => playRps(choice)}
                          type="button"
                        >
                          {RPS_LABELS[choice]}
                        </button>
                      ))}
                    </div>
                    {lastGameResult ? <p className="companion-mini-game-result">{lastGameResult}</p> : null}
                  </section>
                ) : (
                  <section className="companion-daily-card">
                    <p className="companion-mini-game-title">Daily Missions</p>
                    <p className="companion-daily-item">
                      {funState.daily.checkedIn ? '✓' : '○'} Trigger one check-in
                    </p>
                    <p className="companion-daily-item">
                      {funState.daily.playedGame ? '✓' : '○'} Play one mini game
                    </p>
                    <p className="companion-daily-item">
                      {funState.daily.pettedEnough ? '✓' : '○'} Pat {DAILY_PET_TARGET} times ({funState.petCountToday}/
                      {DAILY_PET_TARGET})
                    </p>
                    <button
                      className="companion-daily-claim"
                      disabled={!dailyComplete || funState.daily.bonusClaimed}
                      onClick={claimDailyBonus}
                      type="button"
                    >
                      {funState.daily.bonusClaimed ? 'Bonus Claimed' : 'Claim Daily Bonus'}
                    </button>
                  </section>
                )}
              </>
            )}
            {surpriseText && !showGame ? <p className="companion-surprise-text">{surpriseText}</p> : null}
            {statusHint ? <p className="companion-inline-status">{statusHint}</p> : null}
          </div>

          <button className="companion-art-button" onClick={handlePetCompanion} type="button">
            <div className="companion-art-zone" aria-hidden="true">
              <MascotArtwork
                alt="Sakurajima companion"
                className="companion-illustration"
                variant={mood}
              />
            </div>
          </button>
          <div className="companion-footer">
            <div>
              <p className="companion-name">Sakurajima</p>
              <p className="companion-meta">Build {version} · Best combo x{funState.bestCombo}</p>
            </div>
            <button className="companion-trigger" onClick={onOpenPanel} type="button">
              {hasConfig ? 'Open panel' : 'Finish setup'}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
