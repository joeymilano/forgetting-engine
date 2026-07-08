import { describe, expect, it } from 'vitest';
// @ts-expect-error prompt.js is the intentionally shared ESM runtime module.
import { echoEnabledFor, isRequestBody, promptFor, upstreamStatusFor, userPromptFor } from '../prompt.js';

describe('six-sip model prompts', () => {
  it.each(['zh', 'en'] as const)(
    'requires six taste stages and the exact experience metadata in %s',
    (lang) => {
      const prompt = promptFor(lang);

      for (const taste of ['sweet', 'hot', 'sour', 'bitter', 'numb', 'clear']) {
        expect(prompt.toLowerCase()).toContain(taste);
      }
      expect(prompt).toContain('"stages"');
      expect(prompt).toContain('"emotion"');
      expect(prompt).toContain('"soundtrack"');
      expect(prompt).toContain('"pacing"');
      expect(prompt).toContain('"echo"');
      expect(prompt).toContain('JSON');
    },
  );

  it('appends the enabled or disabled echo instruction after the memory', () => {
    expect(userPromptFor('memory text', true)).toBe(
      'memory text\n\nPersonalized final echo: enabled',
    );
    expect(userPromptFor('memory text', false)).toBe(
      'memory text\n\nPersonalized final echo: disabled; return null',
    );
  });

  it('defaults the echo on and disables it only for an explicit false value', () => {
    expect(echoEnabledFor({})).toBe(true);
    expect(echoEnabledFor({ echoEnabled: true })).toBe(true);
    expect(echoEnabledFor({ echoEnabled: 'false' })).toBe(true);
    expect(echoEnabledFor({ echoEnabled: false })).toBe(false);
  });

  it('explicitly forbids imitating named people from the memory in both languages', () => {
    expect(promptFor('en')).toContain(
      'Never imitate a therapist, a deceased person, or any named person from the memory.',
    );
    expect(promptFor('zh')).toContain(
      '不得模仿治疗师、已故人物或记忆中任何具名人物。',
    );
  });

  it('scopes the AI commentary safety rules to whispers/acknowledgment/echo while preserving stage voice', () => {
    expect(promptFor('en')).toContain('SAFETY BOUNDARIES FOR AI COMMENTARY');
    expect(promptFor('en')).toContain(
      "stages may and should preserve the memory's original narrative voice, including first person.",
    );
    expect(promptFor('zh')).toContain('AI 点评的安全边界');
    expect(promptFor('zh')).toContain(
      'stages 可以并应保留原记忆的叙述人称，包括第一人称。',
    );
  });

  it.each(['zh', 'en'] as const)(
    'requires whispers and acknowledgment fields alongside the six-sip contract in %s',
    (lang) => {
      const prompt = promptFor(lang);
      expect(prompt).toContain('"whispers"');
      expect(prompt).toContain('"acknowledgment"');
    },
  );

  it('passes actionable upstream statuses through and maps server errors to 502', () => {
    for (const status of [400, 401, 403, 404, 429]) {
      expect(upstreamStatusFor(status)).toBe(status);
    }
    expect(upstreamStatusFor(500)).toBe(502);
    expect(upstreamStatusFor(503)).toBe(502);
  });

  it('accepts only non-array objects as request bodies', () => {
    expect(isRequestBody({})).toBe(true);
    expect(isRequestBody({ memory: 'x' })).toBe(true);
    expect(isRequestBody(null)).toBe(false);
    expect(isRequestBody([])).toBe(false);
    expect(isRequestBody('memory')).toBe(false);
    expect(isRequestBody(42)).toBe(false);
  });
});
