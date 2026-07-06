import type { Lang } from './i18n';

export const SIP_COUNT = 6 as const;

export const EMOTIONS = [
  'warmth',
  'regret',
  'attachment',
  'grief',
  'weariness',
  'release',
] as const;

export const TRACK_IDS = [
  'looking-back',
  'rain-at-dusk',
  'far-shore',
] as const;

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

function validateStages(stages: unknown): asserts stages is string[] {
  if (
    !Array.isArray(stages) ||
    stages.length !== SIP_COUNT ||
    !stages.every(
      (stage) => typeof stage === 'string' && stage.trim().length > 0,
    )
  ) {
    throw new Error('INVALID_STAGES');
  }
}

function includes<T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === 'string' && values.some((item) => item === value);
}

export function normalizeExperience(
  raw: Record<string, unknown>,
  lang: Lang,
  fallbackStages: string[],
): ExperienceResult {
  validateStages(raw.stages);
  void fallbackStages;

  const echoLimit = lang === 'zh' ? 42 : 140;
  const trimmedEcho =
    typeof raw.echo === 'string' ? raw.echo.trim() : undefined;
  const echo =
    trimmedEcho && trimmedEcho.length <= echoLimit
      ? trimmedEcho
      : null;

  return {
    stages: raw.stages,
    emotion: includes(EMOTIONS, raw.emotion) ? raw.emotion : 'release',
    soundtrack: includes(TRACK_IDS, raw.soundtrack)
      ? raw.soundtrack
      : 'looking-back',
    pacing: includes(PACING_IDS, raw.pacing) ? raw.pacing : 'steady',
    echo,
    source: 'ai',
  };
}

export function fallbackExperience(stages: string[]): ExperienceResult {
  validateStages(stages);

  return {
    stages,
    emotion: 'release',
    soundtrack: 'looking-back',
    pacing: 'steady',
    echo: null,
    source: 'fallback',
  };
}
