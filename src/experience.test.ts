import { describe, expect, it } from 'vitest';
import {
  fallbackExperience,
  normalizeExperience,
  SIP_COUNT,
} from './experience';

const stages = ['one', 'two', 'three', 'four', 'five', '…'];
const invalidStageSets: string[][] = [
  [],
  ['one', 'two', 'three', 'four', 'five'],
  [...stages, 'seven'],
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
        ['unused'],
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
        normalizeExperience({ stages: invalidStages }, 'en', stages),
      ).toThrowError('INVALID_STAGES');
    },
  );

  it('keeps valid stages while invalid optional metadata falls back field by field', () => {
    expect(
      normalizeExperience(
        {
          stages,
          emotion: 'hope',
          soundtrack: 'thunder',
          pacing: 'rushed',
          echo: 'x'.repeat(300),
        },
        'en',
        ['unused'],
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

  it('applies the language-specific echo limits', () => {
    expect(
      normalizeExperience({ stages, echo: '  It can rest.  ' }, 'en', stages)
        .echo,
    ).toBe('It can rest.');
    expect(
      normalizeExperience({ stages, echo: '界'.repeat(42) }, 'zh', stages).echo,
    ).toBe('界'.repeat(42));
    expect(
      normalizeExperience({ stages, echo: '界'.repeat(43) }, 'zh', stages).echo,
    ).toBeNull();
    expect(
      normalizeExperience({ stages, echo: 'x'.repeat(140) }, 'en', stages).echo,
    ).toBe('x'.repeat(140));
    expect(
      normalizeExperience({ stages, echo: 'x'.repeat(141) }, 'en', stages).echo,
    ).toBeNull();
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
