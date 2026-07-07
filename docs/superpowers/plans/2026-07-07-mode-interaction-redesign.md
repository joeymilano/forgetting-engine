# Ambient Mode Interaction Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `stardust`, `mist`, and `aurora` feel like three distinct rituals rather than three background skins.

**Architecture:** Add a focused `src/modes.ts` capability layer that defines each mode's advance style, transition style, progress style, and ambient particle behavior. Keep `src/main.ts` as the flow coordinator, let `src/ambient.ts` consume a small particle-field setting, let `src/weathering.ts` receive an explicit transition kind, and keep CSS responsible for settled visual states and mode-specific feedback.

**Tech Stack:** Vite 5, native TypeScript, Canvas 2D, CSS variables/transitions, Vitest with jsdom.

---

## File Structure

- Create `src/modes.ts`: source of truth for ambient modes, cycling order, gesture thresholds, behavior tokens, labels, and direction helpers.
- Create `src/modes.test.ts`: unit coverage for cycling, behavior lookup, Mist hold thresholds, and Aurora direction normalization.
- Modify `src/main.ts`: replace local theme array with `modes.ts`, route stage advancement through mode behavior, add Mist hold/release state, add Aurora direction state, update body dataset, and pass transition kinds into weathering.
- Modify `src/ambient.ts`: expose `setAmbientField(field)` so particles can behave as embers, fog, or streams without reading DOM state.
- Modify `src/weathering.ts`: add `TransitionKind` options for ash, fog, and ribbon while preserving the current ash default.
- Modify `src/style.css`: add mode-specific settled visuals for Mist pressure feedback, Aurora direction feedback, progress rail/bars, and reduced-motion behavior.
- Modify `src/i18n.ts`: add short accessible helper strings for Mist and Aurora.

---

### Task 1: Add The Mode Capability Model

**Files:**
- Create: `src/modes.ts`
- Create: `src/modes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AMBIENT_MODES,
  MIST_HOLD_THRESHOLD_MS,
  directionFromDelta,
  getModeBehavior,
  isMistReady,
  nextAmbientMode,
  normalizeAmbientMode,
} from './modes';

describe('ambient mode behavior model', () => {
  it('keeps the existing persisted theme order', () => {
    expect(AMBIENT_MODES).toEqual(['stardust', 'mist', 'aurora']);
    expect(nextAmbientMode('stardust')).toBe('mist');
    expect(nextAmbientMode('mist')).toBe('aurora');
    expect(nextAmbientMode('aurora')).toBe('stardust');
  });

  it('falls back unknown stored values to stardust', () => {
    expect(normalizeAmbientMode('mist')).toBe('mist');
    expect(normalizeAmbientMode('aurora')).toBe('aurora');
    expect(normalizeAmbientMode('old-theme')).toBe('stardust');
    expect(normalizeAmbientMode(null)).toBe('stardust');
  });

  it('defines distinct behavior tokens for each mode', () => {
    expect(getModeBehavior('stardust')).toMatchObject({
      advanceKind: 'click',
      transitionKind: 'ash',
      progressKind: 'dots',
      particleField: 'embers',
    });
    expect(getModeBehavior('mist')).toMatchObject({
      advanceKind: 'hold',
      transitionKind: 'fog',
      progressKind: 'rail',
      particleField: 'fog',
    });
    expect(getModeBehavior('aurora')).toMatchObject({
      advanceKind: 'directional',
      transitionKind: 'ribbon',
      progressKind: 'bars',
      particleField: 'streams',
    });
  });

  it('requires the full Mist hold threshold before release can advance', () => {
    expect(MIST_HOLD_THRESHOLD_MS).toBe(1100);
    expect(isMistReady(0)).toBe(false);
    expect(isMistReady(1099)).toBe(false);
    expect(isMistReady(1100)).toBe(true);
    expect(isMistReady(1400)).toBe(true);
  });

  it('normalizes Aurora pointer movement into four readable directions', () => {
    expect(directionFromDelta(80, 10)).toBe('right');
    expect(directionFromDelta(-80, 10)).toBe('left');
    expect(directionFromDelta(10, -80)).toBe('up');
    expect(directionFromDelta(10, 80)).toBe('down');
    expect(directionFromDelta(3, 4)).toBe('none');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:unit -- src/modes.test.ts`

Expected: FAIL because `src/modes.ts` does not exist.

- [ ] **Step 3: Add the mode model**

Create `src/modes.ts`:

```ts
export const AMBIENT_MODES = ['stardust', 'mist', 'aurora'] as const;
export type AmbientMode = (typeof AMBIENT_MODES)[number];
export type AdvanceKind = 'click' | 'hold' | 'directional';
export type TransitionKind = 'ash' | 'fog' | 'ribbon';
export type ProgressKind = 'dots' | 'rail' | 'bars';
export type ParticleField = 'embers' | 'fog' | 'streams';
export type AuroraDirection = 'none' | 'left' | 'right' | 'up' | 'down';

export interface ModeBehavior {
  advanceKind: AdvanceKind;
  transitionKind: TransitionKind;
  progressKind: ProgressKind;
  particleField: ParticleField;
}

export const MIST_HOLD_THRESHOLD_MS = 1100;
export const AURORA_DIRECTION_DEADZONE_PX = 24;

const MODE_BEHAVIORS: Record<AmbientMode, ModeBehavior> = {
  stardust: {
    advanceKind: 'click',
    transitionKind: 'ash',
    progressKind: 'dots',
    particleField: 'embers',
  },
  mist: {
    advanceKind: 'hold',
    transitionKind: 'fog',
    progressKind: 'rail',
    particleField: 'fog',
  },
  aurora: {
    advanceKind: 'directional',
    transitionKind: 'ribbon',
    progressKind: 'bars',
    particleField: 'streams',
  },
};

export function normalizeAmbientMode(value: unknown): AmbientMode {
  return AMBIENT_MODES.includes(value as AmbientMode)
    ? (value as AmbientMode)
    : 'stardust';
}

export function nextAmbientMode(mode: AmbientMode): AmbientMode {
  const idx = AMBIENT_MODES.indexOf(mode);
  return AMBIENT_MODES[(idx + 1) % AMBIENT_MODES.length];
}

export function getModeBehavior(mode: AmbientMode): ModeBehavior {
  return MODE_BEHAVIORS[mode];
}

export function isMistReady(elapsedMs: number): boolean {
  return elapsedMs >= MIST_HOLD_THRESHOLD_MS;
}

export function directionFromDelta(dx: number, dy: number): AuroraDirection {
  if (Math.hypot(dx, dy) < AURORA_DIRECTION_DEADZONE_PX) return 'none';
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}
```

- [ ] **Step 4: Run tests to verify the model passes**

Run: `npm run test:unit -- src/modes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modes.ts src/modes.test.ts
git commit -m "feat: model ambient mode behaviors"
```

---

### Task 2: Route Theme Switching Through Mode Behavior

**Files:**
- Modify: `src/main.ts`
- Modify: `src/ambient.ts`
- Test: `src/modes.test.ts`

- [ ] **Step 1: Add a small ambient field API**

In `src/ambient.ts`, import the field type and add a field variable near `currentTheme`:

```ts
import type { ParticleField } from './modes';

let currentField: ParticleField = 'embers';
```

Add this exported function below `setAmbientTheme`:

```ts
export function setAmbientField(field: ParticleField): void {
  currentField = field;
}
```

Inside `seed()`, replace the velocity creation with field-specific values:

```ts
const field = currentField;
const vxBase =
  field === 'fog'
    ? (Math.random() - 0.5) * 0.18
    : field === 'streams'
      ? 0.16 + Math.random() * 0.2
      : (Math.random() - 0.5) * 0.1 * (0.5 + depth);
const vyBase =
  field === 'fog'
    ? (Math.random() - 0.5) * 0.035
    : field === 'streams'
      ? -0.02 - Math.random() * 0.08
      : -0.03 - Math.random() * 0.16 * (0.6 + depth);
```

Then use `vx: vxBase` and `vy: vyBase` in the particle object.

- [ ] **Step 2: Apply mode behavior from `main.ts`**

In `src/main.ts`, replace the ambient import:

```ts
import { initAmbient, setAmbientField, setAmbientTheme } from './ambient';
import {
  AMBIENT_MODES,
  type AmbientMode,
  getModeBehavior,
  nextAmbientMode,
  normalizeAmbientMode,
} from './modes';
```

Remove the local `THEMES` array and update the theme helpers:

```ts
const THEME_KEY = 'fe-theme';

function detectTheme(): AmbientMode {
  try {
    return normalizeAmbientMode(localStorage.getItem(THEME_KEY));
  } catch {
    return 'stardust';
  }
}

function applyTheme(theme: AmbientMode): void {
  const behavior = getModeBehavior(theme);
  document.body.dataset.theme = theme;
  document.body.dataset.mode = theme;
  document.body.dataset.advance = behavior.advanceKind;
  document.body.dataset.progress = behavior.progressKind;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* no storage permission */
  }
  setAmbientTheme(theme);
  setAmbientField(behavior.particleField);
  document.querySelectorAll<HTMLElement>('.theme-dots i').forEach((el) => {
    el.classList.toggle('active', el.dataset.theme === theme);
  });
}

function cycleTheme(): void {
  const cur = normalizeAmbientMode(document.body.dataset.theme);
  applyTheme(nextAmbientMode(cur));
}
```

- [ ] **Step 3: Add a regression test for the exported order**

Extend `src/modes.test.ts` with:

```ts
it('exposes only the three existing persisted mode names', () => {
  expect([...AMBIENT_MODES]).toEqual(['stardust', 'mist', 'aurora']);
});
```

- [ ] **Step 4: Run targeted tests**

Run: `npm run test:unit -- src/modes.test.ts`

Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts src/ambient.ts src/modes.test.ts
git commit -m "feat: route ambient themes through mode behavior"
```

---

### Task 3: Add Mist Hold-To-Release Advancement

**Files:**
- Modify: `src/main.ts`
- Modify: `src/i18n.ts`
- Modify: `src/style.css`
- Test: `src/modes.test.ts`

- [ ] **Step 1: Add pure hold-state coverage**

Add to `src/modes.ts`:

```ts
export function mistHoldProgress(elapsedMs: number): number {
  return Math.max(0, Math.min(1, elapsedMs / MIST_HOLD_THRESHOLD_MS));
}
```

Add to `src/modes.test.ts`:

```ts
import { mistHoldProgress } from './modes';

it('clamps Mist hold progress between zero and one', () => {
  expect(mistHoldProgress(-50)).toBe(0);
  expect(mistHoldProgress(550)).toBe(0.5);
  expect(mistHoldProgress(1100)).toBe(1);
  expect(mistHoldProgress(1600)).toBe(1);
});
```

- [ ] **Step 2: Run the targeted test**

Run: `npm run test:unit -- src/modes.test.ts`

Expected: PASS after adding the helper.

- [ ] **Step 3: Add Mist interaction state in `main.ts`**

Extend the `modes.ts` import:

```ts
import {
  AMBIENT_MODES,
  MIST_HOLD_THRESHOLD_MS,
  type AmbientMode,
  getModeBehavior,
  isMistReady,
  mistHoldProgress,
  nextAmbientMode,
  normalizeAmbientMode,
} from './modes';
```

Add state near the existing transition state:

```ts
let mistHoldStart = 0;
let mistHoldFrame = 0;
let mistHolding = false;
```

Add helpers near `cycleTheme()`:

```ts
function activeMode(): AmbientMode {
  return normalizeAmbientMode(document.body.dataset.theme);
}

function setMistProgress(value: number): void {
  document.body.style.setProperty('--mist-progress', value.toFixed(3));
  stageBtn.dataset.mistReady = value >= 1 ? 'true' : 'false';
}

function stopMistHold(resetProgress: boolean): number {
  if (mistHoldFrame) cancelAnimationFrame(mistHoldFrame);
  mistHoldFrame = 0;
  mistHolding = false;
  const elapsed = mistHoldStart ? performance.now() - mistHoldStart : 0;
  mistHoldStart = 0;
  if (resetProgress) setMistProgress(0);
  return elapsed;
}

function tickMistHold(): void {
  if (!mistHolding) return;
  const elapsed = performance.now() - mistHoldStart;
  setMistProgress(mistHoldProgress(elapsed));
  mistHoldFrame = requestAnimationFrame(tickMistHold);
}

function startMistHold(): void {
  if (isTransitioning || mistHolding || activeMode() !== 'mist') return;
  mistHolding = true;
  mistHoldStart = performance.now();
  stageBtn.dataset.mistHolding = 'true';
  tickMistHold();
}

async function releaseMistHold(): Promise<void> {
  if (!mistHolding) return;
  stageBtn.dataset.mistHolding = 'false';
  const elapsed = stopMistHold(!isMistReady(performance.now() - mistHoldStart));
  if (!isMistReady(elapsed) || isTransitioning) return;
  setMistProgress(1);
  await advanceStage();
  setMistProgress(0);
}
```

- [ ] **Step 4: Centralize stage advancement**

Replace the existing stage button click listener with a shared function:

```ts
async function advanceStage(): Promise<void> {
  if (isTransitioning) return;
  if (currentIdx < SIP_COUNT) await gotoStage(currentIdx + 1);
  else await enterEpilogue();
}

stageBtn.addEventListener('click', async () => {
  if (activeMode() !== 'stardust') return;
  await advanceStage();
});
```

Add Mist pointer and keyboard listeners after the click listener:

```ts
stageBtn.addEventListener('pointerdown', (e) => {
  if (activeMode() !== 'mist') return;
  e.preventDefault();
  stageBtn.setPointerCapture(e.pointerId);
  startMistHold();
});

stageBtn.addEventListener('pointerup', async (e) => {
  if (activeMode() !== 'mist') return;
  e.preventDefault();
  if (stageBtn.hasPointerCapture(e.pointerId)) {
    stageBtn.releasePointerCapture(e.pointerId);
  }
  await releaseMistHold();
});

stageBtn.addEventListener('pointercancel', () => {
  if (activeMode() !== 'mist') return;
  stageBtn.dataset.mistHolding = 'false';
  stopMistHold(true);
});

stageBtn.addEventListener('keydown', (e) => {
  if (activeMode() !== 'mist') return;
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  startMistHold();
});

stageBtn.addEventListener('keyup', async (e) => {
  if (activeMode() !== 'mist') return;
  if (e.key !== ' ' && e.key !== 'Enter') return;
  e.preventDefault();
  await releaseMistHold();
});
```

- [ ] **Step 5: Reset Mist progress on theme changes and reset**

In `applyTheme()`, add before setting body datasets:

```ts
stopMistHold(true);
```

In `reset()`, add before `enterIdle()`:

```ts
stopMistHold(true);
```

- [ ] **Step 6: Add Mist accessible strings**

In `src/i18n.ts`, extend the string model with:

```ts
modeHints: {
  mistIdle: string;
  mistHolding: string;
  mistReady: string;
  aurora: string;
};
```

Add English strings:

```ts
modeHints: {
  mistIdle: 'Hold to clear the fog',
  mistHolding: 'Keep holding',
  mistReady: 'Release to take the next sip',
  aurora: 'Move to bend the light',
},
```

Add Chinese strings:

```ts
modeHints: {
  mistIdle: '按住，让雾散开',
  mistHolding: '继续按住',
  mistReady: '松开，饮下下一口',
  aurora: '移动，牵引光带',
},
```

In `setMistProgress()`, set the title and aria label:

```ts
const hints = t().modeHints;
const label = value >= 1 ? hints.mistReady : value > 0 ? hints.mistHolding : hints.mistIdle;
stageBtn.setAttribute('aria-label', label);
stageBtn.setAttribute('title', label);
```

- [ ] **Step 7: Add Mist CSS**

Append to the mode section in `src/style.css`:

```css
body[data-mode='mist'] {
  --mist-progress: 0;
}

body[data-mode='mist'] .stage-text {
  filter: blur(calc((1 - var(--mist-progress)) * 1.2px));
  opacity: calc(0.58 + var(--mist-progress) * 0.42);
  transition: filter 0.22s ease, opacity 0.22s ease;
}

body[data-mode='mist'] .progress {
  gap: 0;
  height: 2px;
  border-radius: 999px;
  background: rgba(168, 204, 228, 0.18);
  overflow: hidden;
}

body[data-mode='mist'] .progress .dot {
  flex: 1;
  height: 2px;
  border-radius: 0;
  transform: none;
}

body[data-mode='mist'] .stage-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  width: calc(var(--mist-progress) * 100%);
  border-radius: inherit;
  background: rgba(168, 204, 228, 0.14);
  pointer-events: none;
}
```

If `.stage-btn` is not positioned, add:

```css
.stage-btn {
  position: relative;
  overflow: hidden;
}
```

- [ ] **Step 8: Verify Mist manually**

Run: `npm run dev`

Open: `http://localhost:5173/?demo=1`

Expected:
- `stardust` still advances on click.
- `mist` does not advance on a short press.
- `mist` advances when held past the pressure fill and released.
- Keyboard Space down/up works in `mist`.

- [ ] **Step 9: Run checks**

Run: `npm run test:unit -- src/modes.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/main.ts src/i18n.ts src/style.css src/modes.ts src/modes.test.ts
git commit -m "feat: add mist hold interaction"
```

---

### Task 4: Add Aurora Directional Advancement

**Files:**
- Modify: `src/main.ts`
- Modify: `src/style.css`
- Test: `src/modes.test.ts`

- [ ] **Step 1: Add direction state to `main.ts`**

Extend the `modes.ts` import:

```ts
import {
  AMBIENT_MODES,
  MIST_HOLD_THRESHOLD_MS,
  type AmbientMode,
  type AuroraDirection,
  directionFromDelta,
  getModeBehavior,
  isMistReady,
  mistHoldProgress,
  nextAmbientMode,
  normalizeAmbientMode,
} from './modes';
```

Add state near the Mist state:

```ts
let auroraPointerStart: { x: number; y: number } | null = null;
let auroraDirection: AuroraDirection = 'none';
```

Add helpers:

```ts
function setAuroraDirection(direction: AuroraDirection): void {
  auroraDirection = direction;
  document.body.dataset.auroraDirection = direction;
  stageBtn.dataset.auroraDirection = direction;
  if (activeMode() === 'aurora') {
    const label = t().modeHints.aurora;
    stageBtn.setAttribute('aria-label', label);
    stageBtn.setAttribute('title', label);
  }
}

function resetAuroraDirection(): void {
  setAuroraDirection('none');
}
```

- [ ] **Step 2: Add pointer and keyboard direction listeners**

Add after the Mist listeners:

```ts
stageView.addEventListener('pointerdown', (e) => {
  if (activeMode() !== 'aurora') return;
  auroraPointerStart = { x: e.clientX, y: e.clientY };
});

stageView.addEventListener('pointermove', (e) => {
  if (activeMode() !== 'aurora') return;
  if (!auroraPointerStart) {
    const rect = stageView.getBoundingClientRect();
    setAuroraDirection(
      directionFromDelta(e.clientX - rect.left - rect.width / 2, e.clientY - rect.top - rect.height / 2),
    );
    return;
  }
  setAuroraDirection(
    directionFromDelta(e.clientX - auroraPointerStart.x, e.clientY - auroraPointerStart.y),
  );
});

stageView.addEventListener('pointerup', () => {
  if (activeMode() !== 'aurora') return;
  auroraPointerStart = null;
});

stageBtn.addEventListener('keydown', async (e) => {
  if (activeMode() !== 'aurora') return;
  if (e.key === 'ArrowLeft') setAuroraDirection('left');
  else if (e.key === 'ArrowRight') setAuroraDirection('right');
  else if (e.key === 'ArrowUp') setAuroraDirection('up');
  else if (e.key === 'ArrowDown') setAuroraDirection('down');
  else if (e.key === 'Enter' || e.key === ' ') await advanceStage();
  else return;
  e.preventDefault();
});
```

Update the existing click listener to support Aurora:

```ts
stageBtn.addEventListener('click', async () => {
  if (activeMode() === 'mist') return;
  await advanceStage();
});
```

- [ ] **Step 3: Reset Aurora direction on mode change and reset**

In `applyTheme()`, after `stopMistHold(true)`:

```ts
resetAuroraDirection();
```

In `reset()`, before `enterIdle()`:

```ts
resetAuroraDirection();
```

- [ ] **Step 4: Add Aurora CSS**

Append near the mode section in `src/style.css`:

```css
body[data-mode='aurora'] .bg-aurora {
  opacity: 0.78;
}

body[data-mode='aurora'] .stage-text {
  transition: transform 0.28s ease, text-shadow 0.28s ease;
  text-shadow: 0 0 18px rgba(118, 232, 182, 0.18);
}

body[data-mode='aurora'][data-aurora-direction='left'] .stage-text {
  transform: skewY(-1.5deg) translateX(-8px);
}

body[data-mode='aurora'][data-aurora-direction='right'] .stage-text {
  transform: skewY(1.5deg) translateX(8px);
}

body[data-mode='aurora'][data-aurora-direction='up'] .stage-text {
  transform: translateY(-8px);
}

body[data-mode='aurora'][data-aurora-direction='down'] .stage-text {
  transform: translateY(8px);
}

body[data-mode='aurora'] .progress .dot {
  width: 4px;
  height: 18px;
  border-radius: 999px;
  transform-origin: bottom;
}

body[data-mode='aurora'] .progress .dot.current {
  height: 30px;
  box-shadow: 0 0 16px rgba(118, 232, 182, 0.5);
}
```

- [ ] **Step 5: Verify Aurora manually**

Run: `npm run dev`

Open: `http://localhost:5173/?demo=1`

Expected:
- In `aurora`, moving near the stage subtly bends text.
- Dragging left/right/up/down changes the settled direction state.
- Arrow keys update the direction.
- Enter advances the stage.
- After transition, text settles readable.

- [ ] **Step 6: Run checks**

Run: `npm run test:unit -- src/modes.test.ts`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/style.css src/modes.ts src/modes.test.ts
git commit -m "feat: add aurora directional interaction"
```

---

### Task 5: Add Fog And Ribbon Weathering Variants

**Files:**
- Modify: `src/weathering.ts`
- Modify: `src/main.ts`
- Test: Browser verification

- [ ] **Step 1: Add transition option types**

In `src/weathering.ts`, import the transition type:

```ts
import type { AuroraDirection, TransitionKind } from './modes';
```

Add an options interface below `LayerSpec`:

```ts
export interface TransitionOptions {
  kind?: TransitionKind;
  direction?: AuroraDirection;
}
```

Change the transition signature:

```ts
transition(
  fromSpec: LayerSpec,
  toSpec: LayerSpec,
  options: TransitionOptions = {},
): Promise<void> {
```

Inside the function, set:

```ts
const kind = options.kind ?? 'ash';
const direction = options.direction ?? 'none';
```

- [ ] **Step 2: Branch particle motion by transition kind**

In the disperse particle loop, replace the velocity assignment with:

```ts
if (kind === 'fog') {
  p.delay = Math.abs(0.5 - nx) * 0.7;
  p.vx = (nx - 0.5) * 0.8;
  p.vy = (Math.sin(p.phase * 3.7) * 0.22);
} else if (kind === 'ribbon') {
  const dirX = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dirY = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  p.delay = nx * 0.35;
  p.vx = dirX * (0.8 + Math.abs(Math.sin(p.phase)) * 1.1) + 0.2;
  p.vy = dirY * (0.55 + Math.abs(Math.cos(p.phase)) * 0.8) - 0.08;
} else {
  p.delay = (1 - nx) * 1.0;
  p.vx = 0.3 + Math.abs(Math.sin(p.phase * 7.1)) * 1.1;
  p.vy = -0.2 - Math.abs(Math.cos(p.phase * 5.3)) * 0.7;
}
```

Keep `p.dur`, `p.mode`, `p.alpha`, `p.size`, `p.x`, and `p.y` assignments after this block.

In the assemble particle loop, replace the start position with:

```ts
if (kind === 'fog') {
  p.sx = p.ox + (nx - 0.5) * 80;
  p.sy = p.oy + Math.sin(p.phase) * 10;
  p.dur = ASM_DUR * 1.25;
} else if (kind === 'ribbon') {
  const dirX = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dirY = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  p.sx = p.ox - dirX * 70 + Math.sin(p.phase) * 18;
  p.sy = p.oy - dirY * 50 + Math.cos(p.phase) * 14;
  p.dur = ASM_DUR * 0.9;
} else {
  p.sx = p.ox;
  p.sy = p.oy + 30;
  p.dur = ASM_DUR;
}
```

- [ ] **Step 3: Pass behavior from `main.ts`**

In `gotoStage(nextIdx)`, before calling weathering:

```ts
const behavior = getModeBehavior(activeMode());
const direction = activeMode() === 'aurora' ? auroraDirection : 'none';
```

Replace:

```ts
await weathering.transition(fromSpec, toSpec);
```

with:

```ts
await weathering.transition(fromSpec, toSpec, {
  kind: behavior.transitionKind,
  direction,
});
```

After `updateStageChrome(nextIdx);`, add:

```ts
if (behavior.transitionKind === 'ribbon') resetAuroraDirection();
```

- [ ] **Step 4: Keep epilogue dispersal stable**

Do not change `disperseOnly(fromSpec)` in this task. The epilogue remains a quiet final release across all modes.

- [ ] **Step 5: Browser verify transitions**

Run: `npm run dev`

Open: `http://localhost:5173/?demo=1`

Expected:
- `stardust` transition still looks like the current ash dispersal.
- `mist` transition dissolves more horizontally and assembles more slowly.
- `aurora` transition bends along the selected direction and settles flat afterward.

- [ ] **Step 6: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/main.ts src/weathering.ts
git commit -m "feat: vary weathering by ambient mode"
```

---

### Task 6: Polish Reduced Motion, Mobile, And Full Journey

**Files:**
- Modify: `src/style.css`
- Modify: `README.md` if the mode behavior needs one short documentation sentence
- Test: existing test suite and browser verification

- [ ] **Step 1: Add reduced-motion mode fallbacks**

Append to `src/style.css`:

```css
@media (prefers-reduced-motion: reduce) {
  body[data-mode='mist'] .stage-text,
  body[data-mode='aurora'] .stage-text {
    transition-duration: 0.01ms;
    transform: none;
  }

  body[data-mode='mist'] .stage-btn::before {
    transition: none;
  }

  body[data-mode='aurora'] .progress .dot {
    transition: none;
  }
}
```

- [ ] **Step 2: Add mobile sizing safeguards**

Append to the existing mobile media section in `src/style.css`:

```css
@media (max-width: 767px) {
  body[data-mode='mist'] .progress {
    width: min(220px, 62vw);
  }

  body[data-mode='aurora'] .progress {
    gap: 6px;
  }

  body[data-mode='aurora'] .progress .dot {
    width: 4px;
    max-height: 24px;
  }
}
```

- [ ] **Step 3: Run the full automated gate**

Run: `npm test`

Expected: PASS, including build, Vitest unit tests, and deployment tests.

- [ ] **Step 4: Browser verify desktop**

Run: `npm run dev`

Open: `http://localhost:5173/?demo=1`

Expected on desktop:
- Complete the full journey in `stardust`.
- Refresh, switch to `mist`, complete the full journey with hold/release.
- Refresh, switch to `aurora`, complete the full journey with pointer movement and button advance.
- No console errors.
- Top-right controls do not overlap.

- [ ] **Step 5: Browser verify mobile viewport**

Use the browser device toolbar or a 390px-wide viewport.

Expected on mobile:
- The writing textarea and primary action remain reachable.
- Mist long-press/drag advances only after the threshold.
- Aurora swipe direction gives visible feedback.
- Stage text is readable after every transition.

- [ ] **Step 6: Commit**

```bash
git add src/style.css README.md
git commit -m "polish: verify ambient mode interactions"
```

---

## Self-Review

- Spec coverage: The plan covers the approved verbs, keeps `stardust` as baseline, implements Mist hold/release, implements Aurora direction steering, adds a shared mode system, keeps existing mode names, preserves the LLM contract, adds accessibility paths, and lists browser verification for all modes.
- Placeholder scan: No placeholder tasks remain. Every code-changing step includes exact file targets and code blocks.
- Type consistency: `AmbientMode`, `ModeBehavior`, `TransitionKind`, `ParticleField`, and `AuroraDirection` are defined in Task 1 and reused consistently in later tasks.
