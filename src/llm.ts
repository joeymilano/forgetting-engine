/* =====================================================================
   llm.ts — request and validate one complete six-sip AI experience.
   Each attempt makes one request. Transient failures retry once; fatal
   failures and exhausted retries return the deterministic local experience.
   ===================================================================== */

import {
  fallbackExperience,
  normalizeExperience,
  SIP_COUNT,
  type ExperienceResult,
} from './experience';
import { fallbackStages } from './fallback';
import type { Lang } from './i18n';

function objectCandidates(raw: string): string[] {
  const candidates: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      if (depth === 0) start = index;
      depth += 1;
    } else if (char === '}' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(raw.slice(start, index + 1));
        start = -1;
      }
    }
  }
  return candidates;
}

const STAGE_CODE_POINT_CAPS: Record<
  Lang,
  readonly [number, number, number, number, number, number]
> = {
  zh: [85, 65, 45, 28, 12, 4],
  en: [240, 190, 135, 80, 28, 4],
};

function validateStageShape(
  stages: unknown,
  lang: Lang,
): asserts stages is string[] {
  if (
    !Array.isArray(stages) ||
    stages.length !== SIP_COUNT ||
    !stages.every(
      (stage) => typeof stage === 'string' && stage.trim().length > 0,
    )
  ) {
    throw new Error('INVALID_STAGES');
  }

  const lengths = stages.map((stage) => Array.from(stage).length);
  const caps = STAGE_CODE_POINT_CAPS[lang];
  const strictlyDecreasing = lengths.every(
    (length, index) => index === 0 || length < lengths[index - 1],
  );
  const withinAbsoluteCaps = lengths.every(
    (length, index) => length <= caps[index],
  );
  if (
    !strictlyDecreasing ||
    !withinAbsoluteCaps ||
    lengths[4] > lengths[0] * 0.5 ||
    lengths[5] > lengths[0] * 0.2
  ) {
    throw new Error('INVALID_STAGES');
  }
}

export function parseExperiencePayload(
  raw: string,
  lang: Lang,
): ExperienceResult {
  const trimmed = raw.trim();
  const candidates = [trimmed, ...objectCandidates(trimmed)];
  let invalidStages: Error | undefined;

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        continue;
      }
      try {
        const record = parsed as Record<string, unknown>;
        validateStageShape(record.stages, lang);
        return normalizeExperience(record, lang);
      } catch (error) {
        if (error instanceof Error && error.message === 'INVALID_STAGES') {
          invalidStages = error;
        } else {
          throw error;
        }
      }
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }

  if (invalidStages) throw invalidStages;
  throw new Error('INVALID_RESPONSE');
}

async function callOnce(
  memory: string,
  lang: Lang,
  echoEnabled: boolean,
  signal: AbortSignal,
): Promise<ExperienceResult> {
  const response = await fetch('/api/forget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ memory, lang, echoEnabled }),
    signal,
  });

  if (response.status === 429) throw new Error('RATE_LIMITED');
  if (!response.ok) throw new Error(`API_ERROR_${response.status}`);

  const data: unknown = await response.json();
  const payload =
    data && typeof data === 'object'
      ? (data as { stages_raw?: unknown; content?: unknown })
      : {};
  const raw =
    typeof payload.stages_raw === 'string'
      ? payload.stages_raw
      : typeof payload.content === 'string'
        ? payload.content
        : '';
  if (!raw) throw new Error('EMPTY_RESPONSE');

  const experience = parseExperiencePayload(raw, lang);
  return echoEnabled ? experience : { ...experience, echo: null };
}

function isFatal(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.message === 'RATE_LIMITED' || error.name === 'AbortError') {
    return true;
  }
  const match = error.message.match(/^API_ERROR_(\d{3})$/);
  if (!match) return false;
  return [400, 401, 403, 404, 429].includes(Number(match[1]));
}

export async function generateExperience(
  memory: string,
  lang: Lang,
  echoEnabled: boolean,
): Promise<ExperienceResult> {
  const demoOn =
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).has('demo');
  if (demoOn) {
    const { pickDemo } = await import('./demo-data');
    const demo = pickDemo(lang);
    return {
      ...normalizeExperience(
        {
          stages: demo.stages,
          whispers: demo.whispers,
          acknowledgment: demo.acknowledgment,
          emotion: demo.emotion,
          soundtrack: demo.soundtrack,
          pacing: demo.pacing,
          echo: echoEnabled ? demo.echo : null,
        },
        lang,
      ),
      source: 'demo',
    };
  }

  const attempt = async (): Promise<ExperienceResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      return await callOnce(memory, lang, echoEnabled, controller.signal);
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await attempt();
  } catch (firstError) {
    if (isFatal(firstError)) {
      console.warn(
        '[Forgetting] fatal upstream error → local fallback.',
        firstError,
      );
      return fallbackExperience(fallbackStages(memory, lang));
    }
    try {
      return await attempt();
    } catch (secondError) {
      console.warn(
        '[Forgetting] both attempts failed → local fallback.',
        secondError,
      );
      return fallbackExperience(fallbackStages(memory, lang));
    }
  }
}

/** @deprecated Use generateExperience when the UI accepts presentation metadata. */
export async function generateStages(
  memory: string,
  lang: Lang,
): Promise<string[]> {
  return (await generateExperience(memory, lang, true)).stages;
}
