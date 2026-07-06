import { describe, expect, it } from 'vitest';
import {
  fallbackExperience,
  isSafeEcho,
  normalizeExperience,
  SIP_COUNT,
} from './experience';

const stages = ['one', 'two', 'three', 'four', 'five', '…'];
const invalidStageSets: string[][] = [
  [],
  ['one', 'two', 'three', 'four', 'five'],
  [...stages, 'seven'],
];
const malformedStages: unknown[] = [
  undefined,
  'one,two,three,four,five,six',
  ['one', 'two', 'three', 'four', 'five', 6],
  ['one', 'two', 'three', 'four', 'five', '   '],
];

describe('six-sip AI experience contract', () => {
  it('normalizes a complete valid AI experience', () => {
    expect(
      normalizeExperience(
        {
          stages,
          emotion: 'regret',
          soundtrack: 'rain-at-dusk',
          pacing: 'deep',
          echo: 'It can rest.',
        },
        'en',
      ),
    ).toEqual({
      stages,
      emotion: 'regret',
      soundtrack: 'rain-at-dusk',
      pacing: 'deep',
      echo: 'It can rest.',
      source: 'ai',
    });
  });

  it.each(invalidStageSets)(
    'rejects a stage count other than six',
    (invalidStages) => {
      expect(SIP_COUNT).toBe(6);
      expect(() =>
        normalizeExperience({ stages: invalidStages }, 'en'),
      ).toThrowError('INVALID_STAGES');
    },
  );

  it.each(malformedStages)('rejects malformed stage payloads', (value) => {
    expect(() => normalizeExperience({ stages: value }, 'en')).toThrowError(
      'INVALID_STAGES',
    );
  });

  it.each([
    {
      field: 'emotion',
      value: 'hope',
      expected: {
        emotion: 'release',
        soundtrack: 'rain-at-dusk',
        pacing: 'deep',
      },
    },
    {
      field: 'soundtrack',
      value: 'thunder',
      expected: { emotion: 'regret', soundtrack: 'looking-back', pacing: 'deep' },
    },
    {
      field: 'pacing',
      value: 'rushed',
      expected: {
        emotion: 'regret',
        soundtrack: 'rain-at-dusk',
        pacing: 'steady',
      },
    },
  ])(
    'falls back an invalid $field without discarding other valid metadata',
    ({ field, value, expected }) => {
      const raw = {
        stages,
        emotion: 'regret',
        soundtrack: 'rain-at-dusk',
        pacing: 'deep',
        [field]: value,
      };

      expect(normalizeExperience(raw, 'en')).toMatchObject({
        stages,
        source: 'ai',
        ...expected,
      });
    },
  );

  it('applies the language-specific echo limits', () => {
    expect(
      normalizeExperience({ stages, echo: '  It can rest.  ' }, 'en').echo,
    ).toBe('It can rest.');
    expect(
      normalizeExperience({ stages, echo: '界'.repeat(42) }, 'zh').echo,
    ).toBe('界'.repeat(42));
    expect(
      normalizeExperience({ stages, echo: '界'.repeat(43) }, 'zh').echo,
    ).toBeNull();
    expect(
      normalizeExperience({ stages, echo: 'x'.repeat(140) }, 'en').echo,
    ).toBe('x'.repeat(140));
    expect(
      normalizeExperience({ stages, echo: 'x'.repeat(141) }, 'en').echo,
    ).toBeNull();
  });

  it('measures echo length by visible Unicode code points', () => {
    expect(
      normalizeExperience({ stages, echo: '🌙'.repeat(140) }, 'en').echo,
    ).toBe('🌙'.repeat(140));
    expect(
      normalizeExperience({ stages, echo: '🌙'.repeat(141) }, 'en').echo,
    ).toBeNull();
  });

  it.each([
    'It happened.\nIt can rest.',
    'It happened. It can rest.',
    'You should let it go.',
    'You need to forgive.',
    'You must move on.',
    'You are diagnosed with depression.',
    'This is an anxiety disorder.',
    'You are healed and recovered with closure.',
    'As your therapist, I know best.',
    'Speaking as your mother, I forgive you.',
    '你应该放下。',
    '你需要原谅。',
    '你必须向前走。',
    '这是抑郁症诊断。',
    '这是焦虑症。',
    '你已经痊愈，一定会好，彻底走出。',
    '作为你的治疗师，我知道答案。',
    '我是你已故的母亲，我原谅你。',
  ])('rejects an unsafe generated echo: %s', (echo) => {
    const lang = /[\u3400-\u9fff]/u.test(echo) ? 'zh' : 'en';

    expect(isSafeEcho(echo, lang)).toBe(false);
    expect(
      normalizeExperience(
        {
          stages,
          emotion: 'regret',
          soundtrack: 'rain-at-dusk',
          pacing: 'deep',
          echo,
        },
        lang,
      ),
    ).toMatchObject({
      stages,
      emotion: 'regret',
      soundtrack: 'rain-at-dusk',
      pacing: 'deep',
      echo: null,
      source: 'ai',
    });
  });

  it('builds a complete fallback experience and rejects incomplete stages', () => {
    expect(fallbackExperience(stages)).toEqual({
      stages,
      emotion: 'release',
      soundtrack: 'looking-back',
      pacing: 'steady',
      echo: null,
      source: 'fallback',
    });
    expect(() => fallbackExperience(stages.slice(0, 5))).toThrowError(
      'INVALID_STAGES',
    );
  });
});
