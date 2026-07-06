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

const UNSAFE_ECHO_PATTERNS = [
  /\b(?:i|me|my|mine|you|your|yours|we|our|ours|us)\b/iu,
  /\b(?:late\s+)?(?:mother|father|mom|mum|mama|dad|partner|therapist|doctor|counselor|wife|husband|brother|sister|son|daughter|friend)\b/iu,
  /\byou\s+(?:should|need\s+to|must|ought\s+to)\b/iu,
  /\b(?:diagnos(?:e|ed|is|ing)|depression|anxiety\s+disorder)\b/iu,
  /\b(?:heal(?:ed|ing)?|recover(?:ed|y|ing)?|closure)\b/iu,
  /\b(?:everything|things?)\s+will\s+get\s+better\b/iu,
  /\bas\s+your\s+therapist\b/iu,
  /\b(?:speaking|writing)\s+as\b/iu,
  /(?:我们|你们|我|你|您|咱|俺)/u,
  /(?:已故的?|去世的?|过世的?)?(?:妈妈|母亲|爸爸|父亲|伴侣|爱人|治疗师|心理医生|医生|朋友|亲人|丈夫|妻子|哥哥|姐姐|弟弟|妹妹|儿子|女儿)/u,
  /你(?:应该|需要|必须|最好)/u,
  /(?:诊断|抑郁症|焦虑症)/u,
  /(?:痊愈|康复|一定会好|彻底走出)/u,
  /作为你的治疗师/u,
  /我是你(?:已故的)?(?:母亲|父亲|伴侣|朋友|亲人|治疗师)/u,
] as const;

const NEUTRAL_ECHO_STARTERS: Record<Lang, RegExp> = {
  en: /^(?:What happened|The memory|That memory|That moment|The past|Some things)\b/iu,
  zh: /^(?:那段记忆|那件事|那个瞬间|曾经|前尘|有些事)/u,
};

/**
 * Deterministic client-side defense in depth for generated echoes.
 * Preventing invented people, events, motives, or details remains the
 * responsibility of the prompt and server because it requires memory context.
 */
export function isSafeEcho(value: string, lang: Lang): boolean {
  const echo = value.trim();
  const echoLimit = lang === 'zh' ? 42 : 140;

  if (!echo || Array.from(echo).length > echoLimit) return false;
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/u.test(echo)) return false;
  if (!NEUTRAL_ECHO_STARTERS[lang].test(echo)) return false;

  const withoutTerminalPunctuation = echo.replace(/[.!?。！？…]+$/u, '');
  if (/[.!?。！？…]/u.test(withoutTerminalPunctuation)) return false;

  return !UNSAFE_ECHO_PATTERNS.some((pattern) => pattern.test(echo));
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
