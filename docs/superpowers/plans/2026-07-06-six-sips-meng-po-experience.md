# Six Sips of Meng Po Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the seven-stage generic forgetting flow with a guided six-sip Meng Po ritual, AI-directed presentation, three licensed emotional soundtracks, and a fully controllable music player.

**Architecture:** A shared `experience.ts` contract validates the one-request AI package and supplies field-level fallbacks. `main.ts` remains the flow coordinator, while onboarding, music state, and music playback stay in focused modules. The server prompt returns only client-approved tokens; the browser maps those tokens to predefined timing, color, and track behavior.

**Tech Stack:** Vite 5, TypeScript, native DOM/CSS/Canvas, Web Audio/HTMLAudioElement, Vitest, jsdom, Cloudflare Pages Functions, GLM API.

---

## File Structure

- Create `src/experience.ts`: six-sip constants, AI response types, validation, and fallback metadata.
- Create `src/experience.test.ts`: contract and field-level fallback tests.
- Create `src/music-state.ts`: pure previous/next/manual-selection state transitions.
- Create `src/music-state.test.ts`: wraparound and manual-choice precedence tests.
- Create `src/onboarding.ts`: first-visit dialog, replay, focus handling, and echo preference.
- Create `src/onboarding.test.ts`: first visit, persistence, replay, and language-refresh tests.
- Create `src/ritual-state.ts`: pure six-sip state transitions.
- Create `src/music.test.ts`: player rendering and load-failure behavior with a fake audio adapter.
- Create `public/music/CREDITS.md`: title, creator, source, license, attribution, and access date.
- Create `public/music/a-kind-of-hope.mp3`, `the-long-dark.mp3`, and `at-the-end-of-all-things.mp3`.
- Modify `src/fallback.ts`: return six taste-aligned stages.
- Modify `src/demo-data.ts`: six-item tuples and deterministic metadata.
- Modify `src/stages.ts`: six visual stages and taste tokens.
- Modify `src/llm.ts`: parse and validate one structured `ExperienceResult`.
- Modify `src/music.ts`: player UI, track selection, crossfade, and failure recovery.
- Modify `src/main.ts`: six-stage state machine and AI presentation application.
- Modify `src/i18n.ts`: guide, player, six sips, privacy, and epilogue copy.
- Modify `index.html`: guide dialog, replay control, player panel, and final echo slot.
- Modify `src/style.css`: guide/player surfaces, taste accents, mobile, focus, and reduced motion.
- Modify `prompt.js`: constrained six-stage JSON response with metadata and echo safety rules.
- Modify `functions/api/forget.ts`, `api/forget.ts`, and `server.mjs`: pass `echoEnabled` and preserve the one-request response.
- Modify `package.json` and `package-lock.json`: Vitest/jsdom test tooling and scripts.
- Modify `README.md`: six-sip concept, AI/privacy explanation, controls, and music attribution link.

### Task 1: Add a TypeScript Unit-Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/smoke.test.ts`

- [ ] **Step 1: Install the test dependencies**

Run:

```bash
npm install --save-dev vitest@^2.1.9 jsdom@^25.0.1
```

Expected: `package.json` and `package-lock.json` include `vitest` and `jsdom`.

- [ ] **Step 2: Add the failing smoke test**

```ts
// src/smoke.test.ts
import { describe, expect, it } from 'vitest';
import { SIP_COUNT } from './experience';

describe('six-sip contract', () => {
  it('exports six as the only ritual stage count', () => {
    expect(SIP_COUNT).toBe(6);
  });
});
```

- [ ] **Step 3: Update package scripts**

```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test": "npm run build && npm run test:unit && node --test test/deployment.test.mjs"
  }
}
```

- [ ] **Step 4: Run the test and verify RED**

Run: `npm run test:unit -- src/smoke.test.ts`

Expected: FAIL because `src/experience.ts` does not exist.

- [ ] **Step 5: Commit the harness**

```bash
git add package.json package-lock.json src/smoke.test.ts
git commit -m "test: add TypeScript unit test harness"
```

### Task 2: Define and Validate the AI Experience Contract

**Files:**
- Create: `src/experience.ts`
- Create: `src/experience.test.ts`
- Delete: `src/smoke.test.ts`

- [ ] **Step 1: Write contract tests**

```ts
// src/experience.test.ts
import { describe, expect, it } from 'vitest';
import { normalizeExperience, SIP_COUNT } from './experience';

const six = ['one', 'two', 'three', 'four', 'five', '…'];

describe('normalizeExperience', () => {
  it('accepts six stages and approved presentation tokens', () => {
    expect(
      normalizeExperience(
        { stages: six, emotion: 'regret', soundtrack: 'rain-at-dusk', pacing: 'deep', echo: 'It can rest.' },
        'en',
        six,
      ),
    ).toEqual({
      stages: six,
      emotion: 'regret',
      soundtrack: 'rain-at-dusk',
      pacing: 'deep',
      echo: 'It can rest.',
      source: 'ai',
    });
  });

  it('rejects any stage count other than six', () => {
    expect(() => normalizeExperience({ stages: six.slice(0, 5) }, 'en', six)).toThrow('INVALID_STAGES');
    expect(SIP_COUNT).toBe(6);
  });

  it('keeps valid stages while replacing invalid optional metadata', () => {
    expect(
      normalizeExperience(
        { stages: six, emotion: 'angry', soundtrack: 'unknown', pacing: 'fast', echo: 'x'.repeat(300) },
        'en',
        six,
      ),
    ).toMatchObject({
      stages: six,
      emotion: 'release',
      soundtrack: 'looking-back',
      pacing: 'steady',
      echo: null,
    });
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm run test:unit -- src/experience.test.ts`

Expected: FAIL because `normalizeExperience` is missing.

- [ ] **Step 3: Implement the shared contract**

```ts
// src/experience.ts
import type { Lang } from './i18n';

export const SIP_COUNT = 6 as const;
export const EMOTIONS = ['warmth', 'regret', 'attachment', 'grief', 'weariness', 'release'] as const;
export const TRACK_IDS = ['looking-back', 'rain-at-dusk', 'far-shore'] as const;
export const PACING_IDS = ['gentle', 'steady', 'deep'] as const;

export type Emotion = (typeof EMOTIONS)[number];
export type TrackId = (typeof TRACK_IDS)[number];
export type PacingId = (typeof PACING_IDS)[number];

export interface ExperienceResult {
  stages: string[];
  emotion: Emotion;
  soundtrack: TrackId;
  pacing: PacingId;
  echo: string | null;
  source: 'ai' | 'fallback' | 'demo';
}

const includes = <T extends readonly string[]>(values: T, value: unknown): value is T[number] =>
  typeof value === 'string' && values.includes(value);

export function normalizeExperience(
  raw: Record<string, unknown>,
  lang: Lang,
  fallbackStages: string[],
): ExperienceResult {
  const stages = raw.stages;
  if (!Array.isArray(stages) || stages.length !== SIP_COUNT || !stages.every((s) => typeof s === 'string' && s.trim())) {
    throw new Error('INVALID_STAGES');
  }
  const echoLimit = lang === 'zh' ? 42 : 140;
  const echo = typeof raw.echo === 'string' && raw.echo.trim().length <= echoLimit ? raw.echo.trim() : null;
  return {
    stages: stages as string[],
    emotion: includes(EMOTIONS, raw.emotion) ? raw.emotion : 'release',
    soundtrack: includes(TRACK_IDS, raw.soundtrack) ? raw.soundtrack : 'looking-back',
    pacing: includes(PACING_IDS, raw.pacing) ? raw.pacing : 'steady',
    echo,
    source: 'ai',
  };
}

export function fallbackExperience(stages: string[]): ExperienceResult {
  return {
    stages: stages.length === SIP_COUNT ? stages : stages.slice(0, SIP_COUNT),
    emotion: 'release',
    soundtrack: 'looking-back',
    pacing: 'steady',
    echo: null,
    source: 'fallback',
  };
}
```

- [ ] **Step 4: Run the tests and verify GREEN**

Run: `npm run test:unit -- src/experience.test.ts`

Expected: 3 tests PASS.

- [ ] **Step 5: Remove the temporary smoke test and commit**

```bash
git rm src/smoke.test.ts
git add src/experience.ts src/experience.test.ts
git commit -m "feat: define six-sip AI experience contract"
```

### Task 3: Convert Visual, Fallback, and Demo Data to Six Sips

**Files:**
- Modify: `src/stages.ts`
- Modify: `src/fallback.ts`
- Modify: `src/demo-data.ts`
- Create: `src/fallback.test.ts`
- Create: `src/demo-data.test.ts`

- [ ] **Step 1: Write failing six-sip tests**

```ts
// src/fallback.test.ts
import { expect, it } from 'vitest';
import { fallbackStages } from './fallback';

it('creates exactly six progressively lighter sips', () => {
  const stages = fallbackStages('那年秋天我在车站等了很久，最后仍然没能说出那句道歉。后来每次下雨，我都会想起那一天。', 'zh');
  expect(stages).toHaveLength(6);
  expect(stages[5].length).toBeLessThanOrEqual(4);
  expect(stages[0].length).toBeGreaterThan(stages[4].length);
});
```

```ts
// src/demo-data.test.ts
import { expect, it } from 'vitest';
import { DEMO_DATA_EN, DEMO_DATA_ZH } from './demo-data';

it('stores six stages in every bilingual demo', () => {
  expect([...DEMO_DATA_ZH, ...DEMO_DATA_EN].every((set) => set.length === 6)).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm run test:unit -- src/fallback.test.ts src/demo-data.test.ts`

Expected: FAIL because current results contain seven stages.

- [ ] **Step 3: Replace the visual stage array**

Keep six entries and assign internal names/taste tokens:

```ts
export const STAGES: StageVisual[] = [
  { index: 1, name: 'sweet', taste: 'sweet', letterSpacing: '0.02em', blur: '0px', opacity: 1, wordSpacing: 'normal', fontSizeScale: 1, lineHeight: 2.1 },
  { index: 2, name: 'hot', taste: 'hot', letterSpacing: '0.05em', blur: '0.2px', opacity: 0.92, wordSpacing: '0.1em', fontSizeScale: 1, lineHeight: 2.1 },
  { index: 3, name: 'sour', taste: 'sour', letterSpacing: '0.09em', blur: '0.4px', opacity: 0.82, wordSpacing: '0.2em', fontSizeScale: 1, lineHeight: 2.1 },
  { index: 4, name: 'bitter', taste: 'bitter', letterSpacing: '0.14em', blur: '0.7px', opacity: 0.68, wordSpacing: '0.4em', fontSizeScale: 1, lineHeight: 2.2 },
  { index: 5, name: 'numb', taste: 'numb', letterSpacing: '0.22em', blur: '1px', opacity: 0.5, wordSpacing: '1.1em', fontSizeScale: 1.1, lineHeight: 2.4 },
  { index: 6, name: 'clear', taste: 'clear', letterSpacing: '0.46em', blur: '1.5px', opacity: 0.28, wordSpacing: 'normal', fontSizeScale: 1.8, lineHeight: 2.5 },
];
```

Add `taste: 'sweet' | 'hot' | 'sour' | 'bitter' | 'numb' | 'clear'` to `StageVisual`.

- [ ] **Step 4: Return six fallback and demo stages**

Merge the old poem/trace ending into one final clear-water stage:

```ts
const s5 = (picks.length ? picks : defaultWords).join('  ');
const s6 = isZh ? '……' : '…';
return [s1, s2, s3, s4, s5, s6];
```

Change `StageTuple` to:

```ts
export type StageTuple = [string, string, string, string, string, string];
```

Remove the former seventh item from every demo set.

- [ ] **Step 5: Run tests and verify GREEN**

Run: `npm run test:unit -- src/fallback.test.ts src/demo-data.test.ts`

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stages.ts src/fallback.ts src/demo-data.ts src/fallback.test.ts src/demo-data.test.ts
git commit -m "feat: rebuild forgetting flow around six tastes"
```

### Task 4: Make the Model Return Six Sips and Director Metadata

**Files:**
- Modify: `prompt.js`
- Modify: `src/llm.ts`
- Modify: `functions/api/forget.ts`
- Modify: `api/forget.ts`
- Modify: `server.mjs`
- Create: `src/llm.test.ts`

- [ ] **Step 1: Write failing parser tests**

Export `parseExperiencePayload` from `src/llm.ts` and test:

```ts
import { expect, it } from 'vitest';
import { parseExperiencePayload } from './llm';

it('parses six stages plus approved director metadata', () => {
  const result = parseExperiencePayload(
    JSON.stringify({
      stages: ['1', '2', '3', '4', '5', '…'],
      emotion: 'regret',
      soundtrack: 'rain-at-dusk',
      pacing: 'deep',
      echo: 'It no longer has to remain heavy.',
    }),
    'en',
    ['a', 'b', 'c', 'd', 'e', '…'],
  );
  expect(result.soundtrack).toBe('rain-at-dusk');
  expect(result.stages).toHaveLength(6);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- src/llm.test.ts`

Expected: FAIL because `parseExperiencePayload` is missing.

- [ ] **Step 3: Rewrite the shared prompt**

Make both prompts demand this exact object:

```json
{
  "stages": ["sip1", "sip2", "sip3", "sip4", "sip5", "sip6"],
  "emotion": "warmth|regret|attachment|grief|weariness|release",
  "soundtrack": "looking-back|rain-at-dusk|far-shore",
  "pacing": "gentle|steady|deep",
  "echo": "one restrained sentence or null"
}
```

The six semantic instructions must explicitly map sweet, hot, sour, bitter, numb, and clear.
Add the echo prohibitions from the design spec verbatim. Keep JSON-only output and the existing
no-commentary rule.

- [ ] **Step 4: Parse the complete object in `src/llm.ts`**

Replace `generateStages` with:

```ts
export async function generateExperience(
  memory: string,
  lang: Lang,
  echoEnabled: boolean,
): Promise<ExperienceResult>
```

`parseExperiencePayload` must call `normalizeExperience`; on complete request failure return
`fallbackExperience(fallbackStages(memory, lang))`. Send `{ memory, lang, echoEnabled }`.

- [ ] **Step 5: Pass the echo preference through all three API adapters**

Parse `echoEnabled` as `body.echoEnabled !== false` and include this instruction after the memory:

```ts
{
  role: 'user',
  content: `${memory}\n\nPersonalized final echo: ${echoEnabled ? 'enabled' : 'disabled; return null'}`,
}
```

- [ ] **Step 6: Run and verify GREEN**

Run: `npm run test:unit -- src/llm.test.ts src/experience.test.ts`

Expected: all parser and contract tests PASS.

- [ ] **Step 7: Commit**

```bash
git add prompt.js src/llm.ts src/llm.test.ts functions/api/forget.ts api/forget.ts server.mjs
git commit -m "feat: return AI-directed six-sip experiences"
```

### Task 5: Implement Pure Music Selection State

**Files:**
- Create: `src/music-state.ts`
- Create: `src/music-state.test.ts`

- [ ] **Step 1: Write failing state tests**

```ts
import { describe, expect, it } from 'vitest';
import { createMusicState, nextTrack, previousTrack, suggestTrack } from './music-state';

describe('music state', () => {
  it('wraps in both directions', () => {
    expect(nextTrack(createMusicState(2)).index).toBe(0);
    expect(previousTrack(createMusicState(0)).index).toBe(2);
  });

  it('never lets AI replace a manual selection', () => {
    const manual = nextTrack(createMusicState(0));
    expect(suggestTrack(manual, 2).index).toBe(1);
    expect(suggestTrack(createMusicState(0), 2).index).toBe(2);
  });
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- src/music-state.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the state reducer**

```ts
export interface MusicState {
  index: number;
  playing: boolean;
  manuallySelected: boolean;
}

export const createMusicState = (index = 0): MusicState => ({
  index,
  playing: false,
  manuallySelected: false,
});

export const nextTrack = (state: MusicState): MusicState => ({
  ...state,
  index: (state.index + 1) % 3,
  manuallySelected: true,
});

export const previousTrack = (state: MusicState): MusicState => ({
  ...state,
  index: (state.index + 2) % 3,
  manuallySelected: true,
});

export const suggestTrack = (state: MusicState, index: number): MusicState =>
  state.manuallySelected ? state : { ...state, index };
```

- [ ] **Step 4: Run and verify GREEN**

Run: `npm run test:unit -- src/music-state.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/music-state.ts src/music-state.test.ts
git commit -m "feat: add deterministic music selection state"
```

### Task 6: Replace the Audio Assets and Record Attribution

**Files:**
- Create: `public/music/a-kind-of-hope.mp3`
- Create: `public/music/the-long-dark.mp3`
- Create: `public/music/at-the-end-of-all-things.mp3`
- Create: `public/music/CREDITS.md`
- Delete: `public/bgm-1.mp3`
- Delete: `public/bgm-2.mp3`
- Delete: `public/bgm-3.mp3`

- [ ] **Step 1: Download the three full mixes from the creator's official library**

```bash
curl -L "https://www.scottbuckley.com.au/library/wp-content/uploads/2022/10/AKindOfHope.mp3" -o public/music/a-kind-of-hope.mp3
curl -L "https://www.scottbuckley.com.au/library/wp-content/uploads/2023/01/TheLongDark.mp3" -o public/music/the-long-dark.mp3
curl -L "https://www.scottbuckley.com.au/library/wp-content/uploads/2024/06/AtTheEndOfAllThings.mp3" -o public/music/at-the-end-of-all-things.mp3
```

- [ ] **Step 2: Verify the files are real audio**

Run:

```bash
file public/music/*.mp3
du -h public/music/*.mp3
```

Expected: all three report MPEG audio and have non-zero sizes.

- [ ] **Step 3: Create exact attribution**

```md
# Music Credits

Accessed 2026-07-06.

- "A Kind Of Hope" by Scott Buckley — CC BY 4.0  
  Source: https://www.scottbuckley.com.au/library/a-kind-of-hope/
- "The Long Dark" by Scott Buckley — CC BY 4.0  
  Source: https://www.scottbuckley.com.au/library/the-long-dark/
- "At The End Of All Things" by Scott Buckley — CC BY 4.0  
  Source: https://www.scottbuckley.com.au/library/at-the-end-of-all-things/

Required attribution: Music by Scott Buckley — released under CC BY 4.0.
https://www.scottbuckley.com.au
```

- [ ] **Step 4: Remove the old tracks and commit**

```bash
git rm public/bgm-1.mp3 public/bgm-2.mp3 public/bgm-3.mp3
git add public/music
git commit -m "assets: replace ambient tracks with licensed emotional score"
```

### Task 7: Build the Full Music Player

**Files:**
- Modify: `index.html`
- Modify: `src/music.ts`
- Create: `src/music.test.ts`
- Modify: `src/i18n.ts`
- Modify: `src/style.css`

- [ ] **Step 1: Write failing player tests**

Use jsdom and an injected `AudioPort` to verify that next/previous update the title, manual
selection survives `applySuggestedTrack`, and one failed track advances once.

```ts
// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { createMusicPlayer, type AudioPort } from './music';

const playerFixture = `
  <section id="music-player">
    <p id="music-track-title"></p>
    <p id="music-track-mood"></p>
    <span id="music-track-position"></span>
    <p id="music-error" hidden></p>
  </section>`;

const fakeAudioPort = (): AudioPort => ({
  load: async () => true,
  play: async () => true,
  pause: () => {},
  setVolume: () => {},
  onEnded: () => {},
});

beforeEach(() => {
  document.body.innerHTML = playerFixture;
  localStorage.clear();
});

it('renders track position and advances manually', async () => {
  const player = createMusicPlayer(fakeAudioPort());
  await player.next();
  expect(document.querySelector('#music-track-position')?.textContent).toBe('2 / 3');
  expect(player.getState().manuallySelected).toBe(true);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- src/music.test.ts`

Expected: FAIL because `createMusicPlayer` is missing.

- [ ] **Step 3: Add semantic player markup**

Add `#music-player` with:

```html
<section id="music-player" class="music-player" hidden aria-label="Music player">
  <button id="music-close" type="button" data-i18n-aria="musicClose">×</button>
  <p id="music-track-title"></p>
  <p id="music-track-mood"></p>
  <span id="music-track-position">1 / 3</span>
  <div class="music-actions">
    <button id="music-prev" type="button" data-i18n-aria="musicPrev">Previous</button>
    <button id="music-play" type="button" data-i18n-aria="musicPlay">Play</button>
    <button id="music-next" type="button" data-i18n-aria="musicNext">Next</button>
  </div>
  <a href="/music/CREDITS.md" target="_blank" rel="noreferrer" data-i18n="musicCredits">Music credits</a>
  <p id="music-error" role="status" hidden></p>
</section>
```

Use the project's existing icon language for controls; do not leave text-symbol approximations
in the final rendered UI.

- [ ] **Step 4: Refactor `music.ts` around an injectable audio port**

Use:

```ts
export interface MusicController {
  applySuggestedTrack(id: TrackId): void;
  next(): Promise<void>;
  previous(): Promise<void>;
  toggle(): Promise<void>;
  getState(): MusicState;
}
```

Map the three IDs to the new files and creator-visible titles. Preload only metadata. A failed
track advances once; three consecutive failures set `musicUnavailable` and show the inline status.

```ts
const TRACKS: Track[] = [
  { id: 'looking-back', src: '/music/a-kind-of-hope.mp3', title: 'A Kind Of Hope', artist: 'Scott Buckley' },
  { id: 'rain-at-dusk', src: '/music/the-long-dark.mp3', title: 'The Long Dark', artist: 'Scott Buckley' },
  { id: 'far-shore', src: '/music/at-the-end-of-all-things.mp3', title: 'At The End Of All Things', artist: 'Scott Buckley' },
];
```

- [ ] **Step 5: Add player copy and styling**

Add bilingual titles/moods and control labels to `i18n.ts`. Style the panel with the existing
blur, border, serif, and warm-gray tokens; ensure 44px controls, mobile-safe placement, visible
focus, and reduced motion.

- [ ] **Step 6: Run and verify GREEN**

Run: `npm run test:unit -- src/music-state.test.ts src/music.test.ts`

Expected: all music tests PASS.

- [ ] **Step 7: Commit**

```bash
git add index.html src/music.ts src/music.test.ts src/music-state.ts src/i18n.ts src/style.css
git commit -m "feat: add controllable three-track memory score"
```

### Task 8: Add the Three-Part Ritual Guide

**Files:**
- Create: `src/onboarding.ts`
- Create: `src/onboarding.test.ts`
- Modify: `index.html`
- Modify: `src/i18n.ts`
- Modify: `src/main.ts`
- Modify: `src/style.css`

- [ ] **Step 1: Write failing guide tests**

```ts
// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { initOnboarding } from './onboarding';

beforeEach(() => {
  document.body.innerHTML = `
    <dialog id="ritual-guide"></dialog>
    <button id="guide-replay"></button>
    <input id="echo-enabled" type="checkbox" checked>
  `;
  localStorage.clear();
});

it('shows on first visit and persists only completion and echo preference', () => {
  const guide = initOnboarding({ lang: 'zh' });
  expect(guide.isOpen()).toBe(true);
  guide.complete();
  expect(localStorage.getItem('fe-guide-complete')).toBe('1');
  expect([...Object.keys(localStorage)]).not.toContain('memory');
});

it('can be replayed after completion', () => {
  localStorage.setItem('fe-guide-complete', '1');
  const guide = initOnboarding({ lang: 'en' });
  expect(guide.isOpen()).toBe(false);
  guide.open();
  expect(guide.isOpen()).toBe(true);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- src/onboarding.test.ts`

Expected: FAIL because `initOnboarding` is missing.

- [ ] **Step 3: Add guide markup**

Add a native `<dialog id="ritual-guide">` with three step containers, progress text, Back,
Continue, Skip, and Begin controls; add `#guide-replay` to the existing top controls. Include
the AI/privacy explanation and `#echo-enabled` checkbox.

- [ ] **Step 4: Implement the guide controller**

Export:

```ts
export interface OnboardingController {
  open(): void;
  close(): void;
  complete(): void;
  isOpen(): boolean;
  isEchoEnabled(): boolean;
  refreshLanguage(): void;
}
```

Use `showModal`, native dialog focus behavior, `cancel` handling for replay, and the keys
`fe-guide-complete` and `fe-echo-enabled`. Never accept or store memory text.

- [ ] **Step 5: Initialize and refresh from `main.ts`**

Initialize after `applyLang`. On language toggle call `onboarding.refreshLanguage()`. First visit
opens after `body.revealed`; replay remains available in every non-transitioning state.

- [ ] **Step 6: Add bilingual guide copy and responsive styling**

Use the exact three sections from the design spec. Prevent the dialog from obscuring the writing
field after close; make the mobile dialog scroll internally; add reduced-motion rules.

- [ ] **Step 7: Run and verify GREEN**

Run: `npm run test:unit -- src/onboarding.test.ts`

Expected: guide tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/onboarding.ts src/onboarding.test.ts index.html src/i18n.ts src/main.ts src/style.css
git commit -m "feat: guide first-time visitors through the ritual"
```

### Task 9: Wire Six Sips, AI Direction, and Final Echo into the Main Flow

**Files:**
- Modify: `src/main.ts`
- Modify: `src/i18n.ts`
- Modify: `src/style.css`
- Create: `src/main-flow.test.ts`
- Create: `src/ritual-state.ts`

- [ ] **Step 1: Write failing state-transition tests**

Create `src/ritual-state.ts` with a pure `nextRitualState` helper and test:

```ts
import { expect, it } from 'vitest';
import { STRINGS } from './i18n';
import { nextRitualState } from './ritual-state';

it('moves from sip five to six and then to the epilogue', () => {
expect(nextRitualState({ stage: 5 })).toEqual({ kind: 'stage', stage: 6 });
expect(nextRitualState({ stage: 6 })).toEqual({ kind: 'epilogue' });
expect(STRINGS.zh.stageButtons).toHaveLength(6);
expect(STRINGS.en.stageButtons).toHaveLength(6);
});
```

Also assert `stageButtons` has six entries and the final entry is `渡过忘川` / `Cross the river`.

- [ ] **Step 2: Run and verify RED**

Run: `npm run test:unit -- src/main-flow.test.ts`

Expected: FAIL because the state helper and six-label contract do not exist.

- [ ] **Step 3: Replace hard-coded seven-stage state**

Use `SIP_COUNT` in progress construction, bounds checks, stage navigation, and reset logic.
Replace the state union with numeric stage state or explicit `STAGE_1` through `STAGE_6`.

- [ ] **Step 4: Apply the AI result once**

In `enterSealing`, call:

```ts
const experience = await generateExperience(memory, getLang(), onboarding.isEchoEnabled());
stages = experience.stages;
music.applySuggestedTrack(experience.soundtrack);
applyDirectorProfile(experience.emotion, experience.pacing);
finalEcho = experience.echo;
```

Map pacing IDs to fixed durations and emotion IDs to existing CSS variables. Never apply raw
model strings as selectors, classes, colors, or durations.

- [ ] **Step 5: Render the final echo safely**

Add `#epilogue-echo` and assign with `textContent`. Keep it hidden when echo is null or disabled.
The fixed epilogue always renders first.

- [ ] **Step 6: Update all bilingual ritual copy**

Use six taste labels, `饮下第一口 / Take the first sip`, subsequent sip actions, `渡过忘川 /
Cross the river`, and the new epilogue.

- [ ] **Step 7: Run and verify GREEN**

Run: `npm run test:unit -- src/main-flow.test.ts src/llm.test.ts src/experience.test.ts`

Expected: all flow and AI tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/main.ts src/main-flow.test.ts src/ritual-state.ts src/i18n.ts src/style.css index.html
git commit -m "feat: orchestrate the six-sip AI ritual"
```

### Task 10: Document, Verify, Deploy, and Inspect Production

**Files:**
- Modify: `README.md`
- Modify: `test/deployment.test.mjs`

- [ ] **Step 1: Expand documentation and deployment assertions**

Document the six-sip interpretation, AI/privacy boundary, guide replay, player controls, and link
to `public/music/CREDITS.md`. Extend the deployment test to assert all three music files and
credits exist in `dist/music`.

- [ ] **Step 2: Run the full automated gate**

Run: `npm test`

Expected: TypeScript build succeeds, all Vitest tests pass, and deployment tests report 0 failures.

- [ ] **Step 3: Run a local browser pass**

Run: `npm run dev -- --host 127.0.0.1`

Verify at desktop and mobile viewport:

- guide first visit, skip, completion, and replay;
- Chinese/English switching while guide/player are open;
- three audio files load; play, pause, previous, next, and wraparound work;
- manual track choice is not replaced by a later AI suggestion;
- demo journey reaches exactly six sips and the epilogue;
- optional echo off produces no generated echo;
- focus indicators, reduced motion, and no writing-field obstruction;
- console has no errors.

- [ ] **Step 4: Compare visual captures**

Capture the original production first screen and the updated local first screen at the same
1280×720 viewport. Place both images in one visual comparison, confirm the existing composition,
typography, frame, fog, and spacing remain intact, and fix any mismatch or crop before proceeding.

- [ ] **Step 5: Commit verification/documentation**

```bash
git add README.md test/deployment.test.mjs
git commit -m "docs: explain and verify the six-sip experience"
```

- [ ] **Step 6: Sync to the real repository and push**

Fast-forward `/Users/joeyzhao/Documents/forgetting-engine`, run `npm test` there, then:

```bash
git push origin main
```

Expected: GitHub `main` points to the verified commit.

- [ ] **Step 7: Deploy the compiled output**

Run: `npm run deploy`

Expected: Wrangler reports `Deployment complete`.

- [ ] **Step 8: Verify production**

Open `https://forgetting-engine.pages.dev` in the in-app browser and repeat:

- guide completion and replay;
- all music controls and three track changes;
- one full six-sip demo journey;
- bilingual copy;
- desktop and mobile layout;
- zero console errors.

- [ ] **Step 9: Final commit-status check**

Run:

```bash
git status --short
git rev-parse HEAD
git rev-parse origin/main
```

Expected: clean status and identical local/remote commit hashes.
