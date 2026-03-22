import { useEffect, useRef, useState } from 'react';
import type { ChatEvent } from '../../../shared/chat';
import type { CompanionMood } from '../../../shared/companion';
import {
  DAILY_PET_TARGET,
  FUN_STORAGE_KEY,
  applyRewards,
  ensureDailyState,
  expThreshold,
  loadFunState,
  previousLocalDayKey,
  toLocalDay,
  type CompanionFunState
} from '../lib/fun-state';
import { MascotArtwork } from './MascotArtwork';

const COMBO_TIMEOUT_MS = 1800;

const PET_REACTIONS = [
  'Soft pat received.',
  'That feels comforting.',
  'Your touch is warm today.',
  'Mood restored a little.'
];

type CompanionViewProps = {
  hasConfig: boolean;
  version: string;
  onOpenPanel: () => void;
};

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)] ?? items[0];
}

export function CompanionView({ hasConfig, version, onOpenPanel }: CompanionViewProps) {
  const [mood, setMood] = useState<CompanionMood>(hasConfig ? 'idle' : 'sleepy');
  const [statusHint, setStatusHint] = useState('');
  const [funState, setFunState] = useState<CompanionFunState>(() => loadFunState());
  const [combo, setCombo] = useState(0);
  const [levelUpPulse, setLevelUpPulse] = useState(false);
  const [sparkles, setSparkles] = useState<Array<{ id: number; x: number }>>([]);
  const comboRef = useRef(0);
  const lastTapAtRef = useRef(0);
  const comboTimerRef = useRef<number | null>(null);
  const lastKnownLevelRef = useRef(funState.level);
  const sparkleCounterRef = useRef(0);

  // Ensure daily state is fresh on mount
  useEffect(() => {
    setFunState((current) => ensureDailyState(current));
  }, []);

  // Persist fun-state to localStorage whenever it changes
  useEffect(() => {
    window.localStorage.setItem(FUN_STORAGE_KEY, JSON.stringify(funState));
  }, [funState]);

  // Level-up pulse
  useEffect(() => {
    if (funState.level > lastKnownLevelRef.current) {
      setStatusHint(`Level up! Lv.${funState.level}.`);
      setLevelUpPulse(true);
      window.setTimeout(() => setLevelUpPulse(false), 900);
    }
    lastKnownLevelRef.current = funState.level;
  }, [funState.level]);

  // Cleanup combo timer on unmount
  useEffect(
    () => () => {
      if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
    },
    []
  );

  useEffect(() => {
    setMood(hasConfig ? 'idle' : 'sleepy');
  }, [hasConfig]);

  useEffect(() => {
    const unsubscribe = window.sakurajima.events.onChatEvent((event: ChatEvent) => {
      if (event.type === 'chat-start') {
        setMood('thinking');
        return;
      }
      if (event.type === 'chat-complete') {
        setMood('happy');
        setFunState((current) => applyRewards(ensureDailyState(current), 10, 3).state);
        return;
      }
      if (event.type === 'chat-error') {
        setMood('error');
        return;
      }
      if (event.type === 'chat-abort') {
        setMood(hasConfig ? 'idle' : 'sleepy');
      }
    });

    return unsubscribe;
  }, [hasConfig]);

  useEffect(() => {
    if (mood === 'happy' || mood === 'error') {
      const timer = window.setTimeout(() => {
        setMood(hasConfig ? 'idle' : 'sleepy');
      }, 2800);
      return () => window.clearTimeout(timer);
    }
  }, [hasConfig, mood]);

  const moodText =
    mood === 'thinking'
      ? 'Thinking...'
      : mood === 'happy'
        ? 'Here with you.'
        : mood === 'error'
          ? 'Tap to regroup.'
          : hasConfig
            ? 'Ready.'
            : 'Finish setup.';

  const expProgress = Math.min(1, funState.exp / expThreshold(funState.level));

  const handlePetCompanion = () => {
    const now = Date.now();
    comboRef.current =
      now - lastTapAtRef.current <= COMBO_TIMEOUT_MS ? comboRef.current + 1 : 1;
    lastTapAtRef.current = now;
    setCombo(comboRef.current);

    if (comboTimerRef.current) window.clearTimeout(comboTimerRef.current);
    comboTimerRef.current = window.setTimeout(() => {
      comboRef.current = 0;
      setCombo(0);
    }, COMBO_TIMEOUT_MS);

    const reaction = pickRandom(PET_REACTIONS);
    const comboBonus = comboRef.current >= 5 ? 5 : comboRef.current >= 3 ? 2 : 0;

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

      const petCountToday = next.petCountToday + 1;
      const bestCombo = Math.max(next.bestCombo, comboRef.current);
      const pettedEnough = next.daily.pettedEnough || petCountToday >= DAILY_PET_TARGET;

      const afterFlags: CompanionFunState = {
        ...next,
        bestCombo,
        petCountToday,
        daily: { ...next.daily, pettedEnough }
      };

      return applyRewards(afterFlags, 6 + comboRef.current * 2, 1 + comboBonus).state;
    });

    setMood(comboRef.current >= 4 ? 'happy' : 'idle');
    setStatusHint(`${reaction} Combo ×${comboRef.current}.`);

    // Sparkle burst
    const newSparkles = Array.from({ length: 3 }, () => {
      sparkleCounterRef.current += 1;
      return { id: sparkleCounterRef.current, x: Math.round((Math.random() - 0.5) * 80) };
    });
    setSparkles((current) => [...current, ...newSparkles]);
    newSparkles.forEach((s) => {
      window.setTimeout(() => {
        setSparkles((current) => current.filter((sp) => sp.id !== s.id));
      }, 1400);
    });
  };

  return (
    <main className="companion-root">
      <section className="companion-shell">
        <div className="companion-aura" />
        <div
          className={`companion-card companion-card-${mood}${levelUpPulse ? ' companion-card-level-up' : ''}`}
        >
          <div className="companion-window-bar" aria-hidden="true">
            <span className="companion-window-grip">Move Companion</span>
          </div>
          <div className="companion-status-chip">{moodText}</div>
          <div className="companion-fun-stats">
            <span>Lv {funState.level}</span>
            <span>🌸 {funState.petals}</span>
            <span>🔥 ×{Math.max(1, combo)}</span>
            <span>📅 {funState.streakDays}d</span>
          </div>
          <div className="companion-exp-track" aria-hidden="true">
            <span style={{ width: `${Math.round(expProgress * 100)}%` }} />
          </div>
          <button
            className="companion-art-button"
            onClick={handlePetCompanion}
            type="button"
            aria-label="Pet companion"
          >
            <div className="companion-art-zone" aria-hidden="true">
              <div className="companion-art-halo" />
              {sparkles.map((s) => (
                <span
                  key={s.id}
                  className="companion-sparkle"
                  style={{ left: `calc(50% + ${s.x}px)` }}
                />
              ))}
              <MascotArtwork
                alt="Sakurajima companion"
                className="companion-illustration"
                variant={mood}
              />
            </div>
          </button>
          {statusHint ? (
            <p
              style={{
                margin: 0,
                fontSize: '0.78rem',
                color: '#97658a',
                textAlign: 'center',
                lineHeight: 1.3
              }}
            >
              {statusHint}
            </p>
          ) : null}
          <div className="companion-footer">
            <div>
              <p className="companion-name">Sakurajima</p>
              <p className="companion-meta">
                Build {version} · Best ×{funState.bestCombo}
              </p>
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
