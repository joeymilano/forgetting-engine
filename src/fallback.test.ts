import { describe, expect, it } from 'vitest';
import { fallbackStages } from './fallback';
import { STAGES } from './stages';

const memories = {
  zh: '那年秋天，我们在车站告别。后来我删掉照片，只留下那张卡片。再后来，连声音也记不清了。',
  en: 'That autumn, we said goodbye at the station. Later I deleted the photos and kept only the card. Eventually, even the voice faded.',
} as const;

describe('fallbackStages', () => {
  it.each(['zh', 'en'] as const)('returns exactly six progressively lighter stages in %s', (lang) => {
    const stages = fallbackStages(memories[lang], lang);

    expect(stages).toHaveLength(6);
    expect(Array.from(stages[5].replace(/\s/gu, '')).length).toBeLessThanOrEqual(4);
    expect(Array.from(stages[0]).length).toBeGreaterThan(Array.from(stages[4]).length);
  });
});

describe('stage visuals', () => {
  it('uses the six taste tokens as internal stage names', () => {
    expect(STAGES.map((stage) => stage.name)).toEqual([
      'sweet',
      'hot',
      'sour',
      'bitter',
      'numb',
      'clear',
    ]);
  });

  it('defines the planned visual progression', () => {
    expect(
      STAGES.map(
        ({
          letterSpacing,
          blur,
          opacity,
          wordSpacing,
          fontSizeScale,
          lineHeight,
        }) => [letterSpacing, blur, opacity, wordSpacing, fontSizeScale, lineHeight],
      ),
    ).toEqual([
      ['0.02em', '0px', 1, 'normal', 1, 2.1],
      ['0.05em', '0.2px', 0.92, '0.1em', 1, 2.1],
      ['0.09em', '0.4px', 0.82, '0.2em', 1, 2.1],
      ['0.14em', '0.7px', 0.68, '0.4em', 1, 2.2],
      ['0.22em', '1px', 0.5, '1.1em', 1.1, 2.4],
      ['0.46em', '1.5px', 0.28, 'normal', 1.8, 2.5],
    ]);
  });
});
