import { useEffect, useState } from 'react';
import type { CompanionMood } from '../../../shared/companion';
import { expThreshold, loadFunState, type CompanionFunState } from '../lib/fun-state';

type CompanionStatusCardProps = {
  mood: CompanionMood;
};

function moodLabel(mood: CompanionMood): string {
  switch (mood) {
    case 'happy':
      return 'Happy';
    case 'thinking':
      return 'Thinking';
    case 'sleepy':
      return 'Quiet';
    case 'error':
      return 'Needs attention';
    default:
      return 'Ready';
  }
}

const COMPANION_TIPS: string[] = [
  'Click the companion to pet her and earn petals.',
  'Keep a daily streak to multiply your rewards.',
  'Combo pats by clicking quickly to boost EXP.',
  'Chat with Sakurajima to earn bonus petals.',
  'Reach a ×5 combo to trigger happy mood instantly.'
];

function pickTip(level: number): string {
  return COMPANION_TIPS[level % COMPANION_TIPS.length] ?? COMPANION_TIPS[0];
}

export function CompanionStatusCard({ mood }: CompanionStatusCardProps) {
  const [funState, setFunState] = useState<CompanionFunState>(() => loadFunState());

  // Re-read localStorage whenever mood changes (companion window may have updated it)
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
            <path
              d="M10 19 Q14 22 18 19"
              stroke="white"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
            />
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
          <span>
            {funState.exp} / {threshold}
          </span>
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
