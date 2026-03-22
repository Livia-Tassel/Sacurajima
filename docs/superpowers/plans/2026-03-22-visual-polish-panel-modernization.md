# Feature 08: Visual Polish & Panel Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add missing animations (glow halo, blink, pet sparkles, mood glow system), add a simple fun-state mechanic (petals/level/streak via localStorage), and replace the stale "Feature 4" development hero card in the panel with a live companion status card.

**Architecture:** All changes are renderer-only — no IPC changes, no main-process changes, no new dependencies. Mood for the panel status card is derived from the existing `onChatEvent` subscription already in `PanelView`. Fun-state is a localStorage-only mechanic living entirely in the renderer.

**Tech Stack:** React 19, TypeScript, CSS (no new dependencies)

**Spec:** `docs/superpowers/specs/2026-03-22-visual-polish-panel-modernization-design.md`

**Working in:** This plan is written against the worktree at `claude/awesome-boyd` which is at commit `95d0270`. Source files to read and edit are under `src/` in this worktree.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/shared/companion.ts` | `CompanionMood` type definition only — no IPC |
| Create | `src/renderer/src/lib/fun-state.ts` | Fun-state types, constants, localStorage helpers |
| Modify | `src/renderer/src/styles.css` | All new keyframes and animation rules (append-only) |
| Modify | `src/renderer/src/components/CompanionView.tsx` | Add halo wrapper, fun-state, pet mechanic, sparkles, stats |
| Create | `src/renderer/src/components/CompanionStatusCard.tsx` | Live companion status panel card |
| Modify | `src/renderer/src/components/PanelView.tsx` | Remove hero card; derive mood from chat events; mount status card |

---

## Task 1: Shared CompanionMood Type

**Files:**
- Create: `src/shared/companion.ts`

The mood type is needed by both `CompanionView` and `CompanionStatusCard`. Define it in shared with no IPC plumbing — just the type.

- [ ] **Step 1: Create `src/shared/companion.ts`**

```typescript
export type CompanionMood = 'idle' | 'thinking' | 'happy' | 'sleepy' | 'error';
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/companion.ts
git commit -m "feat: add CompanionMood shared type"
```

---

## Task 2: Fun-State Library

**Files:**
- Create: `src/renderer/src/lib/fun-state.ts`

A localStorage-only gamification layer. No IPC. Provides level, petals, streak, pet counter, EXP progression.

- [ ] **Step 1: Create `src/renderer/src/lib/fun-state.ts`**

```typescript
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
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/lib/fun-state.ts
git commit -m "feat: add fun-state localStorage library"
```

---

## Task 3: CSS — All New Animations and Styles

**Files:**
- Modify: `src/renderer/src/styles.css` (append to end only — do not edit existing rules)

- [ ] **Step 1: Append all new CSS to the end of `src/renderer/src/styles.css` (before the closing `@media` block)**

Find the `@media (max-width: 920px)` block near the end of the file. Insert everything below just before it:

```css
/* ── Feature 08: Animation Polish ─────────────────────────────────────────── */

/* Art zone wrapper — needed for halo and blink pseudo-element */
.companion-art-zone {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Glow halo behind the illustration */
.companion-art-halo {
  position: absolute;
  inset: -24px;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(255, 180, 210, 0.30) 0%, transparent 70%);
  animation: haloBreath 3.6s ease-in-out infinite;
  pointer-events: none;
  z-index: 0;
}

/* Lift illustration above halo */
.companion-illustration {
  position: relative;
  z-index: 1;
}

@keyframes haloBreath {
  0%, 100% { opacity: 0.5; transform: scale(0.94); }
  50%       { opacity: 1;   transform: scale(1.08); }
}

/* Mood-specific halo tints */
.companion-card-happy .companion-art-halo {
  background: radial-gradient(ellipse, rgba(255, 111, 165, 0.38) 0%, transparent 70%);
}
.companion-card-thinking .companion-art-halo {
  background: radial-gradient(ellipse, rgba(180, 140, 200, 0.32) 0%, transparent 70%);
}
.companion-card-sleepy .companion-art-halo {
  background: radial-gradient(ellipse, rgba(128, 144, 204, 0.25) 0%, transparent 70%);
}
.companion-card-error .companion-art-halo {
  background: radial-gradient(ellipse, rgba(220, 80, 112, 0.28) 0%, transparent 70%);
}

/* Blink overlay via ::after on the art zone div (safe — it's a div, not an img) */
.companion-art-zone::after {
  content: '';
  position: absolute;
  top: 38%;
  left: 50%;
  transform: translateX(-50%);
  width: 52px;
  height: 6px;
  background:
    linear-gradient(
      90deg,
      transparent 0px,  transparent 2px,
      #ef96b4    2px,  #ef96b4    15px,
      transparent 15px, transparent 37px,
      #ef96b4    37px, #ef96b4    50px,
      transparent 50px
    );
  border-radius: 3px;
  opacity: 0;
  pointer-events: none;
  z-index: 2;
  animation: blinkEyes 5.5s ease-in-out infinite;
}

@keyframes blinkEyes {
  0%, 93%, 100% { opacity: 0; transform: translateX(-50%) scaleY(1); }
  94%, 97%      { opacity: 1; transform: translateX(-50%) scaleY(0.15); }
}

/* Pet sparkles */
.companion-sparkle {
  position: absolute;
  bottom: 55%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  pointer-events: none;
  animation: sparkleRise 1.4s ease-out forwards;
  z-index: 3;
}

.companion-sparkle:nth-child(3n + 1) { background: var(--color-blush); width: 6px;  height: 6px; }
.companion-sparkle:nth-child(3n + 2) { background: var(--color-rose);  width: 10px; height: 10px; }
.companion-sparkle:nth-child(3n)     { background: var(--color-accent); }

@keyframes sparkleRise {
  0%   { opacity: 0; transform: translateY(0) scale(0.5); }
  25%  { opacity: 1; transform: translateY(-18px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-58px) scale(0.3); }
}

/* EXP bar shimmer */
.companion-exp-track span {
  animation: expGlow 2s ease-in-out infinite alternate;
}

@keyframes expGlow {
  from { box-shadow: 0 0 4px rgba(255, 138, 178, 0.25); }
  to   { box-shadow: 0 0 14px rgba(255, 138, 178, 0.65); }
}

/* ── Fun-state stat bar ─────────────────────────────────────────────────────── */

.companion-fun-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.companion-fun-stats span {
  padding: 4px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  color: #835b85;
  background: rgba(255, 255, 255, 0.7);
  box-shadow: inset 0 0 0 1px rgba(155, 96, 130, 0.13);
}

.companion-exp-track {
  width: min(220px, 92%);
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.companion-exp-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffc2d8, #ff8ab2);
}

/* ── Mood Glow System ──────────────────────────────────────────────────────── */

.companion-card-idle     { box-shadow: 0 8px 32px rgba(155,  96, 130, 0.10); }
.companion-card-happy    { box-shadow: 0 8px 32px rgba(239, 121, 170, 0.22); }
.companion-card-thinking { box-shadow: 0 8px 32px rgba(160, 120, 200, 0.20); }
.companion-card-sleepy   { box-shadow: 0 8px 32px rgba(120, 140, 200, 0.14); }
.companion-card-error    { box-shadow: 0 8px 32px rgba(210,  80, 100, 0.18); }

/* Status chip extensions for moods not yet styled */
.companion-card-idle .companion-status-chip {
  background: rgba(255, 250, 252, 0.72);
  color: #b1658d;
}
.companion-card-sleepy .companion-status-chip {
  background: rgba(235, 238, 255, 0.82);
  color: #6a79b8;
}

/* ── Button Hover Lift ─────────────────────────────────────────────────────── */

.companion-trigger {
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.companion-trigger:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 24px rgba(242, 122, 169, 0.40);
}

/* ── CompanionStatusCard ───────────────────────────────────────────────────── */

.csc-root {
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
  box-shadow: inset 0 0 0 1px rgba(155, 96, 130, 0.10), 0 8px 32px rgba(155, 96, 130, 0.08);
  overflow: hidden;
}

.csc-header {
  padding: 20px 24px 14px;
  background: linear-gradient(180deg, rgba(255, 235, 245, 0.85), transparent);
  border-bottom: 1px solid rgba(155, 96, 130, 0.07);
  display: flex;
  align-items: center;
  gap: 14px;
}

.csc-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ffc2d8, #ef96b4);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(239, 150, 180, 0.35);
  flex: 0 0 auto;
  animation: companionFloat 4.8s ease-in-out infinite;
}

.csc-meta { flex: 1; }

.csc-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #4b3850;
}

.csc-mood-chip {
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  background: rgba(255, 230, 242, 0.9);
  color: #c0527a;
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.csc-mood-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef96b4;
  animation: dotPulse 2s ease-in-out infinite;
}

@keyframes dotPulse {
  0%, 100% { transform: scale(1);   opacity: 1; }
  50%       { transform: scale(1.5); opacity: 0.6; }
}

.csc-stats {
  padding: 14px 24px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.csc-stat {
  text-align: center;
  padding: 12px 6px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: inset 0 0 0 1px rgba(155, 96, 130, 0.08);
}

.csc-stat-val {
  font-size: 1.2rem;
  font-weight: 700;
  color: #6b3e62;
}

.csc-stat-key {
  margin-top: 3px;
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #b07096;
}

.csc-exp {
  padding: 0 24px 14px;
}

.csc-exp-label {
  font-size: 0.72rem;
  color: #b07096;
  margin-bottom: 6px;
  display: flex;
  justify-content: space-between;
}

.csc-exp-bar {
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  box-shadow: inset 0 0 0 1px rgba(155, 96, 130, 0.12);
  overflow: hidden;
}

.csc-exp-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #ffc2d8, #ff8ab2);
  animation: expGlow 2s ease-in-out infinite alternate;
}

.csc-tip {
  padding: 0 24px 18px;
}

.csc-tip-label {
  font-size: 0.72rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #c96d96;
  margin-bottom: 8px;
}

.csc-tip-text {
  font-size: 0.86rem;
  color: #7a667d;
  line-height: 1.55;
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/styles.css
git commit -m "feat: add animation polish CSS and mood glow system"
```

---

## Task 4: Update CompanionView — Halo, Fun-State, Pet Mechanic, Sparkles

**Files:**
- Modify: `src/renderer/src/components/CompanionView.tsx`

The current `CompanionView.tsx` is 92 lines. Replace it entirely with the enhanced version below. It keeps all existing chat-event mood logic and adds: fun-state from localStorage, pet interaction, sparkle burst, stats display, halo div, art-zone wrapper.

- [ ] **Step 1: Replace `src/renderer/src/components/CompanionView.tsx` entirely**

```typescript
import { useEffect, useRef, useState } from 'react';
import type { ChatEvent } from '../../../shared/chat';
import type { CompanionMood } from '../../../shared/companion';
import {
  DAILY_PET_TARGET,
  applyRewards,
  ensureDailyState,
  expThreshold,
  loadFunState,
  previousLocalDayKey,
  toLocalDay,
  type CompanionFunState
} from '../lib/fun-state';
import { FUN_STORAGE_KEY } from '../lib/fun-state';
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

  useEffect(() => {
    setFunState((current) => ensureDailyState(current));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(FUN_STORAGE_KEY, JSON.stringify(funState));
  }, [funState]);

  useEffect(() => {
    if (funState.level > lastKnownLevelRef.current) {
      setStatusHint(`Level up! Lv.${funState.level}.`);
      setLevelUpPulse(true);
      window.setTimeout(() => setLevelUpPulse(false), 900);
    }
    lastKnownLevelRef.current = funState.level;
  }, [funState.level]);

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
    comboRef.current = now - lastTapAtRef.current <= COMBO_TIMEOUT_MS ? comboRef.current + 1 : 1;
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
        <div className={`companion-card companion-card-${mood} ${levelUpPulse ? 'companion-card-level-up' : ''}`}>
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
          <button className="companion-art-button" onClick={handlePetCompanion} type="button"
            style={{ width: '100%', border: 0, padding: 0, margin: 0, background: 'transparent',
                     WebkitAppRegion: 'no-drag', cursor: 'pointer' } as React.CSSProperties}>
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
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#97658a', textAlign: 'center', lineHeight: 1.3 }}>
              {statusHint}
            </p>
          ) : null}
          <div className="companion-footer">
            <div>
              <p className="companion-name">Sakurajima</p>
              <p className="companion-meta">Build {version} · Best ×{funState.bestCombo}</p>
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
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/CompanionView.tsx
git commit -m "feat: add fun-state, pet mechanic, sparkles, and glow halo to companion window"
```

---

## Task 5: Create CompanionStatusCard Component

**Files:**
- Create: `src/renderer/src/components/CompanionStatusCard.tsx`

Reads fun-state from localStorage directly. Mood is passed as a prop (derived from chat events in PanelView).

- [ ] **Step 1: Create `src/renderer/src/components/CompanionStatusCard.tsx`**

```typescript
import { useEffect, useState } from 'react';
import type { CompanionMood } from '../../../shared/companion';
import { expThreshold, loadFunState, type CompanionFunState } from '../lib/fun-state';

type CompanionStatusCardProps = {
  mood: CompanionMood;
};

function toRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return '';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)} d ago`;
}

function moodLabel(mood: CompanionMood): string {
  switch (mood) {
    case 'happy':    return 'Happy';
    case 'thinking': return 'Thinking';
    case 'sleepy':   return 'Quiet';
    case 'error':    return 'Needs attention';
    default:         return 'Ready';
  }
}

const COMPANION_TIPS: string[] = [
  'Click the companion to pet her and earn petals.',
  'Keep a daily streak to multiply your rewards.',
  'Combo pats by clicking quickly to boost EXP.',
  'Chat with Sakurajima to earn bonus petals.'
];

function pickTip(level: number): string {
  return COMPANION_TIPS[level % COMPANION_TIPS.length] ?? COMPANION_TIPS[0];
}

export function CompanionStatusCard({ mood }: CompanionStatusCardProps) {
  const [funState, setFunState] = useState<CompanionFunState>(() => loadFunState());

  useEffect(() => {
    setFunState(loadFunState());
  }, [mood]);

  const threshold = expThreshold(funState.level);
  const expPct = Math.min(100, Math.round((funState.exp / threshold) * 100));

  return (
    <section className="csc-root">
      <div className="csc-header">
        <div className="csc-avatar" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="10" fill="rgba(255,255,255,0.5)" />
            <circle cx="10" cy="13" r="2" fill="white" />
            <circle cx="18" cy="13" r="2" fill="white" />
            <path d="M10 19 Q14 22 18 19" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="csc-meta">
          <p className="csc-name">Sakurajima</p>
          <div className="csc-mood-chip">
            <span className="csc-mood-dot" />
            {moodLabel(mood)}
          </div>
        </div>
      </div>

      <div className="csc-stats">
        <div className="csc-stat">
          <div className="csc-stat-val">{funState.level}</div>
          <div className="csc-stat-key">Level</div>
        </div>
        <div className="csc-stat">
          <div className="csc-stat-val">{funState.petals}</div>
          <div className="csc-stat-key">Petals</div>
        </div>
        <div className="csc-stat">
          <div className="csc-stat-val">{funState.streakDays}d</div>
          <div className="csc-stat-key">Streak</div>
        </div>
        <div className="csc-stat">
          <div className="csc-stat-val">×{funState.bestCombo}</div>
          <div className="csc-stat-key">Best Combo</div>
        </div>
      </div>

      <div className="csc-exp">
        <div className="csc-exp-label">
          <span>EXP — Lv {funState.level}</span>
          <span>{funState.exp} / {threshold}</span>
        </div>
        <div className="csc-exp-bar">
          <div className="csc-exp-fill" style={{ width: `${expPct}%` }} />
        </div>
      </div>

      <div className="csc-tip">
        <div className="csc-tip-label">Tip</div>
        <p className="csc-tip-text">{pickTip(funState.level)}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/CompanionStatusCard.tsx
git commit -m "feat: add CompanionStatusCard component"
```

---

## Task 6: Update PanelView — Remove Hero Card, Add Mood State, Mount Status Card

**Files:**
- Modify: `src/renderer/src/components/PanelView.tsx`

- [ ] **Step 1: Add `CompanionMood` import and `CompanionStatusCard` import**

At the top of `PanelView.tsx`, add two new imports alongside the existing ones:

```typescript
import type { CompanionMood } from '../../../shared/companion';
import { CompanionStatusCard } from './CompanionStatusCard';
```

- [ ] **Step 2: Add `companionMood` state**

After the existing `const [didHydrateInitialView, setDidHydrateInitialView] = useState(false);` line, add:

```typescript
const [companionMood, setCompanionMood] = useState<CompanionMood>('idle');
```

- [ ] **Step 3: Derive mood from existing `handleChatEvent`**

`PanelView` already has `handleChatEvent` that processes all chat events. Add mood updates inside the existing branches:

In the `chat-start` branch, after `setChatBusy(true)`, add:
```typescript
setCompanionMood('thinking');
```

In the `chat-complete` branch, after `setChatBusy(false)`, add:
```typescript
setCompanionMood('happy');
```

In the `chat-abort` branch, after `setChatBusy(false)`, add:
```typescript
setCompanionMood('idle');
```

In the final catch-all error block, after `setChatBusy(false)`, add:
```typescript
setCompanionMood('error');
```

- [ ] **Step 4: Remove the "Feature 4" hero card JSX and replace with CompanionStatusCard**

In the JSX (around line 311), remove this entire block:

```tsx
<div className="panel-hero-card">
  <p className="panel-kicker">Feature 4</p>
  <h2>Local sessions and streaming chat now live in the panel</h2>
  <p>
    The panel now keeps session history locally, streams assistant
    deltas in place, and falls back to standard JSON completions when
    the endpoint does not answer with SSE.
  </p>
  <div className="panel-pill-row">
    <span className="panel-pill">Streaming</span>
    <span className="panel-pill">Abort</span>
    <span className="panel-pill">Local History</span>
  </div>
</div>
```

Replace with:

```tsx
<CompanionStatusCard mood={companionMood} />
```

- [ ] **Step 5: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Run build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/components/PanelView.tsx
git commit -m "feat: replace Feature 4 hero card with live CompanionStatusCard in panel"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Full check**

```bash
npm run typecheck && npm test && npm run build
```

Expected: all pass, zero errors.

- [ ] **Step 2: Manual acceptance checklist**

Start with `npm run dev` and verify:

- [ ] Glow halo pulses softly behind the character
- [ ] Blink animation fires approximately every 5–6 seconds
- [ ] Clicking the companion character triggers sparkle particles
- [ ] Stats row (Lv / Petals / Combo / Streak) appears and updates on pet
- [ ] EXP bar fills and shimmers
- [ ] Mood card glow changes color when chat starts (thinking = purple) and completes (happy = pink)
- [ ] Open panel button shows hover lift
- [ ] Panel no longer shows the "Feature 4 / Local sessions" hero card
- [ ] Panel shows CompanionStatusCard with live Level, Petals, Streak, Best Combo, EXP bar
- [ ] Panel mood chip updates to "Thinking" during chat generation and "Happy" on completion

- [ ] **Step 3: Done**

```bash
git log --oneline -8
```

Review the commit history to confirm all tasks are represented.
