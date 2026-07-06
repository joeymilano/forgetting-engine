import { describe, expect, it } from 'vitest';
// @ts-expect-error prompt.js is the intentionally shared ESM runtime module.
import { echoEnabledFor, promptFor, upstreamStatusFor, userPromptFor } from '../prompt.js';

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

  it('scopes the impersonal safety rules to echo while preserving stage voice', () => {
    expect(promptFor('en')).toContain('[ECHO-ONLY SAFETY BOUNDARIES]');
    expect(promptFor('en')).toContain(
      "stages may and should preserve the memory's original narrative voice, including first person.",
    );
    expect(promptFor('zh')).toContain('【仅适用于 echo 的安全边界】');
    expect(promptFor('zh')).toContain(
      'stages 可以并应保留原记忆的叙述人称，包括第一人称。',
    );
  });

  it('passes actionable upstream statuses through and maps server errors to 502', () => {
    for (const status of [400, 401, 403, 404, 429]) {
      expect(upstreamStatusFor(status)).toBe(status);
    }
    expect(upstreamStatusFor(500)).toBe(502);
    expect(upstreamStatusFor(503)).toBe(502);
  });
});
