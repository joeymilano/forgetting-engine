import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateExperience, parseExperiencePayload } from './llm';

const stages = [
  'A memory once carried a place, a promise, and the weight of an ending.',
  'A promise and its ending remained, but the place had faded.',
  'An ending remained after most details were gone.',
  'Only a faint ending seemed to remain.',
  'faint ending',
  '…',
];
const stageCaps = {
  zh: [85, 65, 45, 28, 12, 4],
  en: [240, 190, 135, 80, 28, 4],
} as const;

describe('parseExperiencePayload', () => {
  it('parses a complete six-sip experience object', () => {
    expect(
      parseExperiencePayload(
        JSON.stringify({
          stages,
          whispers: ['a', 'b', 'c', 'd', 'e', 'f'],
          acknowledgment: 'The weight of it is plain to see.',
          emotion: 'regret',
          soundtrack: 'rain-at-dusk',
          pacing: 'deep',
          echo: 'What happened no longer has to remain heavy.',
        }),
        'en',
      ),
    ).toEqual({
      stages,
      whispers: ['a', 'b', 'c', 'd', 'e', 'f'],
      acknowledgment: 'The weight of it is plain to see.',
      emotion: 'regret',
      soundtrack: 'rain-at-dusk',
      pacing: 'deep',
      echo: 'What happened no longer has to remain heavy.',
      source: 'ai',
    });
  });

  it('extracts the experience object from code fences and surrounding text', () => {
    const raw = `Model preface
\`\`\`json
${JSON.stringify({
  stages,
  emotion: 'warmth',
  soundtrack: 'far-shore',
  pacing: 'gentle',
  echo: null,
})}
\`\`\`
Model suffix`;

    expect(parseExperiencePayload(raw, 'en')).toMatchObject({
      stages,
      emotion: 'warmth',
      soundtrack: 'far-shore',
      pacing: 'gentle',
      echo: null,
    });
  });

  it.each([stages.slice(0, 5), [...stages, 'gone']])(
    'rejects a payload whose stages do not contain exactly six items',
    (invalidStages) => {
      expect(() =>
        parseExperiencePayload(
          JSON.stringify({ stages: invalidStages }),
          'en',
        ),
      ).toThrowError('INVALID_STAGES');
    },
  );

  it('falls back invalid optional metadata field by field', () => {
    expect(
      parseExperiencePayload(
        JSON.stringify({
          stages,
          emotion: 'rage',
          soundtrack: 'storm',
          pacing: 'rushed',
          echo: 'You should forget this now.',
        }),
        'en',
      ),
    ).toEqual({
      stages,
      whispers: [null, null, null, null, null, null],
      acknowledgment: null,
      emotion: 'release',
      soundtrack: 'looking-back',
      pacing: 'steady',
      echo: null,
      source: 'ai',
    });
  });

  it.each([
    {
      name: 'equal adjacent lengths',
      lang: 'en' as const,
      invalidStages: [
        'abcdefghij',
        'ABCDEFGHIJ',
        'abcdefgh',
        'abcdef',
        'abcd',
        '…',
      ],
    },
    {
      name: 'an overlong English final trace',
      lang: 'en' as const,
      invalidStages: [
        'a'.repeat(40),
        'b'.repeat(30),
        'c'.repeat(20),
        'd'.repeat(12),
        'e'.repeat(8),
        'f'.repeat(7),
      ],
    },
    {
      name: 'a Unicode stage-five ratio over half the first stage',
      lang: 'zh' as const,
      invalidStages: [
        '🌙'.repeat(10),
        '月'.repeat(9),
        '酸'.repeat(8),
        '苦'.repeat(7),
        '麻'.repeat(6),
        '。',
      ],
    },
    {
      name: 'nondecreasing adjacent Unicode traces',
      lang: 'zh' as const,
      invalidStages: [
        '🌙'.repeat(10),
        '月'.repeat(8),
        '酸'.repeat(6),
        '苦'.repeat(4),
        '麻麻',
        '清清',
      ],
    },
  ])('rejects $name', ({ invalidStages, lang }) => {
    expect(() =>
      parseExperiencePayload(JSON.stringify({ stages: invalidStages }), lang),
    ).toThrowError('INVALID_STAGES');
  });

  it.each(
    (['zh', 'en'] as const).flatMap((lang) =>
      stageCaps[lang].map((cap, index) => ({ lang, cap, index })),
    ),
  )(
    'rejects a $lang stage at index $index above its absolute cap',
    ({ lang, cap, index }) => {
      const character = lang === 'zh' ? '界' : 'x';
      const invalidStages = stageCaps[lang].map((limit, stageIndex) =>
        character.repeat(limit + (stageIndex === index ? 1 : 0)),
      );

      expect(() =>
        parseExperiencePayload(
          JSON.stringify({ stages: invalidStages }),
          lang,
        ),
      ).toThrowError('INVALID_STAGES');
      expect(Array.from(invalidStages[index])).toHaveLength(cap + 1);
    },
  );

  it.each([5, 6])(
    'rejects an English clear trace containing %s characters',
    (length) => {
      const invalidStages = stageCaps.en.map((limit, index) =>
        'x'.repeat(index === 5 ? length : limit),
      );

      expect(() =>
        parseExperiencePayload(
          JSON.stringify({ stages: invalidStages }),
          'en',
        ),
      ).toThrowError('INVALID_STAGES');
    },
  );

  it('rejects a huge but decreasing response', () => {
    const invalidStages = [1000, 999, 998, 997, 400, 4].map((length) =>
      'x'.repeat(length),
    );

    expect(() =>
      parseExperiencePayload(JSON.stringify({ stages: invalidStages }), 'en'),
    ).toThrowError('INVALID_STAGES');
  });

  it('accepts Unicode stages at the exact Chinese code-point caps', () => {
    const cappedUnicodeStages = stageCaps.zh.map((limit) => '🌙'.repeat(limit));

    expect(
      parseExperiencePayload(
        JSON.stringify({ stages: cappedUnicodeStages }),
        'zh',
      ).stages,
    ).toEqual(cappedUnicodeStages);
  });
});

describe('generateExperience', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('makes one request with the echo preference and returns the normalized experience', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: JSON.stringify({
            stages,
            emotion: 'attachment',
            soundtrack: 'far-shore',
            pacing: 'gentle',
            echo: 'The memory can become quiet.',
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateExperience('A sufficiently long memory for the API request.', 'en', true),
    ).resolves.toMatchObject({
      stages,
      emotion: 'attachment',
      soundtrack: 'far-shore',
      pacing: 'gentle',
      echo: 'The memory can become quiet.',
      source: 'ai',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string),
    ).toEqual({
      memory: 'A sufficiently long memory for the API request.',
      lang: 'en',
      echoEnabled: true,
    });
  });

  it('suppresses an upstream echo when the preference is disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: JSON.stringify({
            stages,
            emotion: 'release',
            soundtrack: 'looking-back',
            pacing: 'steady',
            echo: 'The memory can become quiet.',
          }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateExperience('A sufficiently long memory for the API request.', 'en', false),
    ).resolves.toMatchObject({ echo: null });
    expect(
      JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string),
    ).toMatchObject({ echoEnabled: false });
  });

  it.each([401, 429])(
    'returns fallback after one attempt for fatal HTTP %s',
    async (status) => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response('', { status }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await generateExperience(
        'A sufficiently long memory that can be weathered into six stages.',
        'en',
        true,
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        emotion: 'release',
        soundtrack: 'looking-back',
        pacing: 'steady',
        echo: null,
        source: 'fallback',
      });
    },
  );

  it('retries a server failure once before returning fallback', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 502 }));
    vi.stubGlobal('fetch', fetchMock);

    await generateExperience(
      'A sufficiently long memory that can be weathered into six stages.',
      'en',
      true,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries malformed response JSON once before returning fallback', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('not json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateExperience(
      'A sufficiently long memory that can be weathered into six stages.',
      'en',
      true,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe('fallback');
    expect(result.stages).toHaveLength(6);
  });

  it('retries an invalid stage shape once before returning fallback', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const invalidStages = [
      'same length',
      'equal size!',
      'shorter',
      'short',
      'tiny',
      '…',
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          content: JSON.stringify({ stages: invalidStages }),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await generateExperience(
      'A sufficiently long memory that can be weathered into six stages.',
      'en',
      true,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.source).toBe('fallback');
  });
});
