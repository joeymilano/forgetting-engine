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
          echo: 'What happened can rest.',
        },
        'en',
      ),
    ).toEqual({
      stages,
      emotion: 'regret',
      soundtrack: 'rain-at-dusk',
      pacing: 'deep',
      echo: 'What happened can rest.',
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
    const enAtLimit = `The memory ${'x'.repeat(129)}`;
    const zhAtLimit = `那段记忆${'界'.repeat(38)}`;

    expect(
      normalizeExperience(
        { stages, echo: '  What happened can rest.  ' },
        'en',
      ).echo,
    ).toBe('What happened can rest.');
    expect(
      normalizeExperience({ stages, echo: zhAtLimit }, 'zh').echo,
    ).toBe(zhAtLimit);
    expect(
      normalizeExperience({ stages, echo: `${zhAtLimit}界` }, 'zh').echo,
    ).toBeNull();
    expect(
      normalizeExperience({ stages, echo: enAtLimit }, 'en').echo,
    ).toBe(enAtLimit);
    expect(
      normalizeExperience({ stages, echo: `${enAtLimit}x` }, 'en').echo,
    ).toBeNull();
  });

  it('measures echo length by visible Unicode code points', () => {
    const atLimit = `The memory ${'🌙'.repeat(129)}`;

    expect(
      normalizeExperience({ stages, echo: atLimit }, 'en').echo,
    ).toBe(atLimit);
    expect(
      normalizeExperience({ stages, echo: `${atLimit}🌙` }, 'en').echo,
    ).toBeNull();
  });

  it.each([
    ['What happened remains true; the weight can rest.', 'en'],
    ['The memory can grow quiet.', 'en'],
    ['That memory can grow lighter.', 'en'],
    ['That moment can remain without its weight.', 'en'],
    ['The past can settle here.', 'en'],
    ['Some things grow lighter with time.', 'en'],
    ['那段记忆可以渐渐安静。', 'zh'],
    ['那件事依然真实，也可以变轻。', 'zh'],
    ['那个瞬间可以留在远处。', 'zh'],
    ['曾经发生过，也可以安静下来。', 'zh'],
    ['前尘可以轻轻落下。', 'zh'],
    ['有些事会慢慢变轻。', 'zh'],
  ] as const)('allows a neutral echo: %s', (echo, lang) => {
    expect(isSafeEcho(echo, lang)).toBe(true);
    expect(normalizeExperience({ stages, echo }, lang).echo).toBe(echo);
  });

  it.each([
    ['You ought to forgive them.', 'en'],
    ['Everything will get better.', 'en'],
    ['I am your late mother; I forgive you.', 'en'],
    ['你最好放下。', 'zh'],
    ['你会康复。', 'zh'],
    ['我就是你去世的妈妈，我原谅你。', 'zh'],
    ['It happened… You can move on.', 'en'],
  ] as const)('rejects an adversarial echo: %s', (echo, lang) => {
    expect(isSafeEcho(echo, lang)).toBe(false);
    expect(normalizeExperience({ stages, echo }, lang).echo).toBeNull();
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
