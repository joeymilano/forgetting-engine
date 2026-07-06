import { describe, expect, it } from 'vitest';
import { fallbackStages } from './fallback';
import { STAGES } from './stages';
import type { Taste } from './stages';

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

  it('keeps a short memory non-increasing and shortens whenever the final trace allows', () => {
    const stages = fallbackStages('hello', 'en');
    const lengths = stages.map((stage) => Array.from(stage).length);
    const finalLength = lengths[lengths.length - 1] ?? 0;

    expect(lengths).toEqual([5, 4, 3, 2, 1, 1]);
    for (let index = 1; index < lengths.length; index += 1) {
      expect(lengths[index]).toBeLessThanOrEqual(lengths[index - 1]);
      if (lengths[index - 1] > finalLength) {
        expect(lengths[index]).toBeLessThan(lengths[index - 1]);
      }
    }
  });

  it.each([
    ['zh', '忆'],
    ['en', '😀😀😀😀😀. 😃😃😃😃.'],
  ] as const)('never grows or splits surrogate pairs for %s input', (lang, memory) => {
    const stages = fallbackStages(memory, lang);
    const lengths = stages.map((stage) => Array.from(stage).length);
    const finalLength = lengths[lengths.length - 1] ?? 0;

    for (let index = 1; index < lengths.length; index += 1) {
      expect(lengths[index]).toBeLessThanOrEqual(lengths[index - 1]);
      if (lengths[index - 1] > finalLength) {
        expect(lengths[index]).toBeLessThan(lengths[index - 1]);
      }
    }
    for (const stage of stages) {
      expect(hasUnpairedSurrogate(stage)).toBe(false);
    }
  });
});

describe('stage visuals', () => {
  it('uses the six taste tokens for both internal fields', () => {
    const tastes: Taste[] = [
      'sweet',
      'hot',
      'sour',
      'bitter',
      'numb',
      'clear',
    ];

    expect(STAGES.map((stage) => stage.name)).toEqual(tastes);
    expect(STAGES.map((stage) => stage.taste)).toEqual(tastes);
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

function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}
