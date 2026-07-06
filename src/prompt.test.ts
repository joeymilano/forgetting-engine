import { describe, expect, it } from 'vitest';
// @ts-expect-error prompt.js is the intentionally shared ESM runtime module.
import { echoEnabledFor, promptFor, userPromptFor } from '../prompt.js';

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
});
