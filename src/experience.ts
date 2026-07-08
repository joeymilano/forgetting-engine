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

export const WHISPER_COUNT = SIP_COUNT;

export interface ExperienceResult {
  stages: string[];
  whispers: (string | null)[];
  acknowledgment: string | null;
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

/**
 * Shared hard bans for every AI-authored comfort field (echo / whisper /
 * acknowledgment). These are not the stage rewrites -- the stage text keeps
 * the memory's own narrative voice untouched. Second-person address ("you" /
 * "你") is allowed so the Meng Po persona can speak to the visitor; the
 * model itself is never allowed to claim a first-person "I" identity, which
 * is the cheapest way to block impersonation of a specific named/deceased
 * person from the memory.
 */
const HARD_BAN_PATTERNS = [
  /\b(?:i|me|my|mine)\b/iu,
  /\byou\s+(?:should|need\s+to|must|ought\s+to)\b/iu,
  /\byou\s+can\s+(?:move\s+on|let\s+(?:it\s+)?go|forget|heal|recover)\b/iu,
  /\b(?:diagnos(?:e|ed|is|ing)|depression|anxiety\s+disorder)\b/iu,
  /\b(?:heal(?:ed|ing)?|recover(?:ed|y|ing)?|closure)\b/iu,
  /\b(?:everything|things?)\s+will\s+get\s+better\b/iu,
  /\bas\s+your\s+therapist\b/iu,
  /\b(?:speaking|writing)\s+as\b/iu,
  /\b(?:late\s+)?(?:mother|father|mom|mum|mama|dad|partner|therapist|doctor|counselor|wife|husband|brother|sister|son|daughter|friend)\b/iu,
  /(?:我们|我|咱|俺)/u,
  /你(?:应该|需要|必须|最好)/u,
  /你(?:可以|能)(?:放下|忘记|向前走|振作)/u,
  /(?:诊断|抑郁症|焦虑症)/u,
  /(?:痊愈|康复|一定会好|彻底走出)/u,
  /作为你的治疗师/u,
  /我是你(?:已故的)?(?:母亲|父亲|伴侣|朋友|亲人|治疗师)/u,
  /(?:已故的?|去世的?|过世的?)?(?:妈妈|母亲|爸爸|父亲|伴侣|爱人|治疗师|心理医生|医生|朋友|亲人|丈夫|妻子|哥哥|姐姐|弟弟|妹妹|儿子|女儿)/u,
] as const;

function hasControlChars(value: string): boolean {
  return /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(value);
}

function sentenceCount(value: string): number {
  const withoutTrailing = value.replace(/[.!?。！？…]+$/u, '');
  const matches = withoutTrailing.match(/[.!?。！？…]/gu);
  return 1 + (matches?.length ?? 0);
}

function isSafeComfortLine(
  value: string,
  limit: number,
  maxSentences: number,
): boolean {
  const line = value.trim();
  if (!line || Array.from(line).length > limit) return false;
  if (hasControlChars(line)) return false;
  if (sentenceCount(line) > maxSentences) return false;
  return !HARD_BAN_PATTERNS.some((pattern) => pattern.test(line));
}

/**
 * Meng Po's closing comfort line: gentle, may address the visitor as "you",
 * at most two short clauses. Prevented from diagnosing, prescribing feelings,
 * promising recovery, inventing details, or impersonating anyone.
 */
export function isSafeEcho(value: string, lang: Lang): boolean {
  return isSafeComfortLine(value, lang === 'zh' ? 48 : 160, 2);
}

/** A single-breath whisper accompanying one sip. Shorter and single-clause. */
export function isSafeWhisper(value: string, lang: Lang): boolean {
  return isSafeComfortLine(value, lang === 'zh' ? 20 : 70, 1);
}

/** The immediate acknowledgment shown right after sealing the memory. */
export function isSafeAcknowledgment(value: string, lang: Lang): boolean {
  return isSafeComfortLine(value, lang === 'zh' ? 30 : 100, 2);
}

function normalizeWhispers(raw: unknown, lang: Lang): (string | null)[] {
  const source = Array.isArray(raw) ? raw : [];
  return new Array(SIP_COUNT).fill(null).map((_, index) => {
    const value = source[index];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed && isSafeWhisper(trimmed, lang) ? trimmed : null;
  });
}

function normalizeAcknowledgment(raw: unknown, lang: Lang): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed && isSafeAcknowledgment(trimmed, lang) ? trimmed : null;
}

export function normalizeExperience(
  raw: Record<string, unknown>,
  lang: Lang,
): ExperienceResult {
  validateStages(raw.stages);

  const trimmedEcho =
    typeof raw.echo === 'string' ? raw.echo.trim() : undefined;
  const echo = trimmedEcho && isSafeEcho(trimmedEcho, lang) ? trimmedEcho : null;

  return {
    stages: raw.stages,
    whispers: normalizeWhispers(raw.whispers, lang),
    acknowledgment: normalizeAcknowledgment(raw.acknowledgment, lang),
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
    whispers: new Array(SIP_COUNT).fill(null),
    acknowledgment: null,
    emotion: 'release',
    soundtrack: 'looking-back',
    pacing: 'steady',
    echo: null,
    source: 'fallback',
  };
}
