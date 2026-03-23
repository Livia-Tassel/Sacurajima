# Feature 08: Visual Polish & Panel Modernization

## Status

Approved for implementation.

## Goal

Close the gap between the documented visual system and the running application. The visual spec (see `docs/visual-system.md`) promises breathing animations, blinking, ambient glow, and panel slide-in — only the float animation is currently implemented. Simultaneously, replace the stale Feature 7 development hero card in the panel with a living companion status surface that surfaces data already flowing through the app.

## Scope

**In scope:**
- CSS animation additions: glow halo, blink, pet sparkles, EXP bar shimmer, mood glow system, button hover lift
- Panel hero card replacement with `CompanionStatusCard` component
- Full mood glow coverage for all 6 moods

**Out of scope:**
- No new IPC, no new main-process changes
- No new dependencies
- No audio, TTS, or Live2D
- No changes to data model, persistence, or CompanionEngine

## Architecture

All changes are confined to the renderer. No process boundaries crossed.

```
src/renderer/src/
├── styles.css                        ← CSS additions only (no removals)
├── lib/
│   └── fun-state.ts                  ← extract FUN_STORAGE_KEY, normalizeFunState, related types from CompanionView
├── components/
│   ├── CompanionView.tsx             ← import from lib/fun-state; add sparkle state; add halo div
│   ├── PanelView.tsx                 ← remove hero card; add mood state; mount CompanionStatusCard
│   └── CompanionStatusCard.tsx       ← new component; reads funState from localStorage via lib/fun-state
```

## Part 1 — Animation Polish

### 1.1 Ambient Glow Halo

A `<div className="companion-art-halo">` is inserted inside `.companion-art-zone`, behind the `<MascotArtwork>`. CSS animates it with `@keyframes haloBreath` (3.6 s, ease-in-out, infinite):

```
0%, 100% { opacity: 0.5; transform: scale(0.94); }
50%       { opacity: 1;   transform: scale(1.08); }
```

Base color: `radial-gradient(ellipse, rgba(255,180,210,0.30) 0%, transparent 70%)`.

Mood overrides via `.companion-card-{mood} .companion-art-halo`:
- `happy`    → `rgba(255,111,165,0.38)`
- `thinking` → `rgba(180,140,200,0.32)`
- `sleepy`   → `rgba(128,144,204,0.25)`
- `error`    → `rgba(220,80,112,0.28)`
- `checkin`  → `rgba(255,160,200,0.34)`

### 1.2 Blink Animation

A `::after` pseudo-element on `.companion-art-zone` renders two closed-eye bars using a `background` gradient pattern. `.companion-art-zone` is a `<div>` (not a replaced content element), so `::after` works correctly — no new wrapper needed. `@keyframes blinkEyes`:

```
0%, 94%, 100% { opacity: 0; }
95%, 98%      { opacity: 1; transform: scaleY(0.15); }
```

Duration: 5.5 s infinite. `.companion-art-zone` already has `position: relative` implied by its flex layout — add `position: relative` explicitly to ensure `::after` positioning works. The `::after` element is absolutely positioned at ~40% from top, centered horizontally, using a CSS gradient to paint two small bars (the closed eyes).

### 1.3 Pet Sparkle Burst

`CompanionView` adds one state variable:

```ts
const [sparkles, setSparkles] = useState<Array<{ id: number; x: number }>>([]);
```

On `handlePetCompanion`, 3 new entries are appended with random `x` offsets (−40 to +40 px). Each auto-removes via `window.setTimeout` after 1400 ms. Rendered inside `.companion-art-zone`:

```tsx
{sparkles.map(s => (
  <span key={s.id} className="companion-sparkle" style={{ left: `calc(50% + ${s.x}px)` }} />
))}
```

CSS: absolutely positioned, `@keyframes sparkleRise` (translateY −55 px, fade out, 1.4 s forwards). Three color variants via `:nth-child` (blush, rose, accent).

### 1.4 EXP Bar Glow

`.companion-exp-track span` gains:

```css
animation: expGlow 2s ease-in-out infinite alternate;
```

```
@keyframes expGlow {
  from { box-shadow: 0 0 4px rgba(255,138,178,0.25); }
  to   { box-shadow: 0 0 14px rgba(255,138,178,0.65); }
}
```

### 1.5 Mood Glow System

Extends the existing `.companion-card-{mood}` pattern. Each mood adds a `box-shadow` at the card level:

| Mood      | Card box-shadow color           |
|-----------|---------------------------------|
| idle      | `rgba(155, 96,130, 0.10)`      |
| happy     | `rgba(239,121,170, 0.22)`      |
| thinking  | `rgba(160,120,200, 0.20)`      |
| sleepy    | `rgba(120,140,200, 0.14)`      |
| error     | `rgba(210, 80,100, 0.18)`      |
| checkin   | `rgba(255,138,178, 0.20)`      |

Status chip colors are extended to cover `idle`, `sleepy`, `listening`, and `checkin` (currently only `thinking`, `happy`, `error` are styled).

### 1.6 Button Hover Lift

Add `transition: transform 0.12s ease, box-shadow 0.12s ease` and `:hover { transform: translateY(-1px); }` to:
- `.companion-nudge-button`
- `.companion-prompt-action`
- `.companion-trigger`
- `.companion-daily-claim`

## Part 2 — Panel Companion Status Card

### 2.1 Remove Hero Card

Delete the `<div className="panel-hero-card">` block from `PanelView.tsx` (the "Feature 7" static block). This is stale development milestone content.

### 2.2 New CompanionStatusCard Component

File: `src/renderer/src/components/CompanionStatusCard.tsx`

**Props:**
```ts
type CompanionStatusCardProps = {
  mood: CompanionMood;
  companionActivities: CompanionActivity[];
};
```

**Internal state:** Reads `funState` directly from `localStorage` using `FUN_STORAGE_KEY` and `normalizeFunState`. These are currently defined inside `CompanionView.tsx` and must be extracted to `src/renderer/src/lib/fun-state.ts` so both `CompanionView` and `CompanionStatusCard` can import them. `CompanionView` is updated to import from the new location. Refreshes on mount and when `mood` changes.

**Sections:**
1. **Header** — Animated avatar (CSS circle + SVG face), companion name, mood chip with pulsing dot
2. **Stats row** — 4 tiles: Level · Petals · Day Streak · Best Combo
3. **EXP bar** — with label and `{exp} / {threshold}` numeric display
4. **Recent activity** — last 3 `companionActivities`, color-coded dots (pink = prompt, purple = response, green = reward), relative time (`X min ago`)

**Relative time helper:** A small pure function `toRelativeTime(isoString: string): string` — no external library, covers seconds/minutes/hours/days.

### 2.3 Mount in PanelView

Replace the removed hero card with `<CompanionStatusCard mood={???} companionActivities={companionActivities} />`.

The panel does not currently track mood directly. Two approaches:
- **(Recommended)** Add a `mood` state to `PanelView`, initialized to `'idle'`, updated via `onCompanionEvent` handler already present in `PanelView` (it already listens to companion events — just extract `event.mood` from `companion-state` events).
- Alternative: Pass mood down from `App.tsx`.

## Data Flow

```
CompanionEngine (main)
  → IPC → companion-state event
    → PanelView.handleCompanionEvent() [already exists]
      → setMood(event.mood)              ← new, 1 line
        → CompanionStatusCard re-renders

localStorage[FUN_STORAGE_KEY]
  → CompanionStatusCard (reads on mount + mood change)
    → Level, Petals, Streak, Best Combo, EXP display
```

## Error Handling

- `CompanionStatusCard` defensively handles missing/corrupt localStorage via the existing `normalizeFunState` fallback path
- Empty `companionActivities` shows a graceful "No activity yet" message
- No new error states or loading spinners needed

## Testing

- `npm run typecheck` must pass
- `npm test` must pass (no new test files required — existing tests cover CompanionEngine)
- Visual: manual check that all 6 mood states produce correct glow colors in dev mode
- Visual: confirm sparkles appear and clear correctly on rapid petting (combo scenario)

## Acceptance Criteria

- [ ] Glow halo visible and pulsing behind character in all mood states
- [ ] Blink animation fires approximately every 5–6 seconds
- [ ] Petting companion triggers sparkle particles that rise and fade
- [ ] EXP bar shimmers continuously
- [ ] All 6 moods have distinct card-level glow and status chip color
- [ ] All interactive companion buttons show hover lift
- [ ] Panel no longer shows "Feature 7 is now live" static card
- [ ] Panel shows CompanionStatusCard with live level, petals, streak, best combo, EXP bar, and recent activities
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] `npm run build` passes
