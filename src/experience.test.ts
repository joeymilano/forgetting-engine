import { describe, expect, it } from 'vitest';
import {
  fallbackExperience,
  isSafeAcknowledgment,
  isSafeEcho,
  isSafeWhisper,
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
          whispers: ['a', 'b', 'c', 'd', 'e', 'f'],
          acknowledgment: 'The weight of it is plain to see.',
          emotion: 'regret',
          soundtrack: 'rain-at-dusk',
          pacing: 'deep',
          echo: 'What happened can rest, and you may walk on.',
        },
        'en',
      ),
    ).toEqual({
      stages,
      whispers: ['a', 'b', 'c', 'd', 'e', 'f'],
      acknowledgment: 'The weight of it is plain to see.',
      emotion: 'regret',
      soundtrack: 'rain-at-dusk',
      pacing: 'deep',
      echo: 'What happened can rest, and you may walk on.',
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

  it('defaults whispers to all null when the field is missing or malformed', () => {
    expect(normalizeExperience({ stages }, 'en').whispers).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(
      normalizeExperience({ stages, whispers: 'not-an-array' }, 'en').whispers,
    ).toEqual([null, null, null, null, null, null]);
  });

  it('normalizes whispers per slot, dropping only the unsafe entries', () => {
    const result = normalizeExperience(
      {
        stages,
        whispers: ['fine.', 'You must forget this now.', '', 42, 'also fine.'],
      },
      'en',
    );
    expect(result.whispers).toEqual([
      'fine.',
      null,
      null,
      null,
      'also fine.',
      null,
    ]);
  });

  it('defaults acknowledgment to null when missing or unsafe', () => {
    expect(normalizeExperience({ stages }, 'en').acknowledgment).toBeNull();
    expect(
      normalizeExperience(
        { stages, acknowledgment: 'You must let this go now.' },
        'en',
      ).acknowledgment,
    ).toBeNull();
    expect(
      normalizeExperience(
        { stages, acknowledgment: 'The weight of it is plain to see.' },
        'en',
      ).acknowledgment,
    ).toBe('The weight of it is plain to see.');
  });

  it('applies the language-specific echo limits', () => {
    const enAtLimit = `The memory ${'x'.repeat(149)}`;
    const zhAtLimit = `那段记忆${'界'.repeat(44)}`;

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
    const atLimit = `The memory ${'🌙'.repeat(149)}`;

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
    ['This bowl held more sweetness than bitterness. Walk on.', 'en'],
    ['You carried it a long way. It is lighter now.', 'en'],
    ['那段记忆可以渐渐安静。', 'zh'],
    ['那件事依然真实，也可以变轻。', 'zh'],
    ['这碗汤里，甜比苦多。往前走吧，桥那头有光。', 'zh'],
    ['你带着它走了很远。现在轻一些了。', 'zh'],
  ] as const)('allows a Meng Po-voiced echo: %s', (echo, lang) => {
    expect(isSafeEcho(echo, lang)).toBe(true);
    expect(normalizeExperience({ stages, echo }, lang).echo).toBe(echo);
  });

  it.each([
    ['You ought to forgive them.', 'en'],
    ['You should let it go.', 'en'],
    ['You need to forgive.', 'en'],
    ['You must move on.', 'en'],
    ['Everything will get better.', 'en'],
    ['I am your late mother; I forgive you.', 'en'],
    ['As your therapist, I know best.', 'en'],
    ['Speaking as your mother, I forgive you.', 'en'],
    ['You are diagnosed with depression.', 'en'],
    ['You are healed and recovered with closure.', 'en'],
    ['你应该放下。', 'zh'],
    ['你需要原谅。', 'zh'],
    ['你必须向前走。', 'zh'],
    ['你会康复。', 'zh'],
    ['我就是你去世的妈妈，我原谅你。', 'zh'],
    ['作为你的治疗师，我知道答案。', 'zh'],
    ['你已经痊愈，一定会好，彻底走出。', 'zh'],
    ['It happened. It can rest. You may finally move on.', 'en'],
  ] as const)('rejects an unsafe generated echo: %s', (echo, lang) => {
    expect(isSafeEcho(echo, lang)).toBe(false);
    expect(normalizeExperience({ stages, echo }, lang).echo).toBeNull();
  });

  it('rejects an echo with more than two sentences', () => {
    const echo = 'It happened. It can rest. Now walk on.';
    expect(isSafeEcho(echo, 'en')).toBe(false);
    expect(normalizeExperience({ stages, echo }, 'en').echo).toBeNull();
  });

  it('rejects a whisper or acknowledgment that exceeds their tighter limits', () => {
    expect(isSafeWhisper('fine, and gentle enough to pass.', 'en')).toBe(true);
    expect(
      isSafeWhisper('a'.repeat(71), 'en'),
    ).toBe(false);
    expect(
      isSafeAcknowledgment('a'.repeat(101), 'en'),
    ).toBe(false);
  });

  it('builds a complete fallback experience and rejects incomplete stages', () => {
    expect(fallbackExperience(stages)).toEqual({
      stages,
      whispers: [null, null, null, null, null, null],
      acknowledgment: null,
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
