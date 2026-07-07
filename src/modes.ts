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
