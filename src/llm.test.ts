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

describe('parseExperiencePayload', () => {
  it('parses a complete six-sip experience object', () => {
    expect(
      parseExperiencePayload(
        JSON.stringify({
          stages,
          emotion: 'regret',
          soundtrack: 'rain-at-dusk',
          pacing: 'deep',
          echo: 'What happened no longer has to remain heavy.',
        }),
        'en',
      ),
    ).toEqual({
      stages,
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
      emotion: 'release',
      soundtrack: 'looking-back',
      pacing: 'steady',
      echo: null,
      source: 'ai',
    });
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
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
      ),
    );

    await expect(
      generateExperience('A sufficiently long memory for the API request.', 'en', false),
    ).resolves.toMatchObject({ echo: null });
  });

  it('returns the complete fallback experience after a fatal request failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
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
    expect(result.stages).toHaveLength(6);
  });
});
