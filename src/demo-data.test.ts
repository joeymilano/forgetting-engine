import { describe, expect, it } from 'vitest';
import { DEMO_DATA_EN, DEMO_DATA_ZH } from './demo-data';
import { STAGES } from './stages';

describe('demo data', () => {
  it.each([
    ['zh', DEMO_DATA_ZH],
    ['en', DEMO_DATA_EN],
  ] as const)('keeps every %s demo at exactly six progressively lighter stages', (_lang, demos) => {
    for (const stages of demos) {
      expect(stages).toHaveLength(6);
      for (let index = 1; index < stages.length; index += 1) {
        expect(Array.from(stages[index]).length).toBeLessThan(Array.from(stages[index - 1]).length);
      }
    }
  });
});

describe('stage visuals', () => {
  it('defines the six tastes with their planned visual progression', () => {
    expect(STAGES).toEqual([
      {
        index: 1,
        name: '细节脱落',
        taste: 'sweet',
        letterSpacing: '0.02em',
        blur: '0px',
        opacity: 1,
        wordSpacing: 'normal',
        fontSizeScale: 1,
        lineHeight: 2.1,
      },
      {
        index: 2,
        name: '名字模糊',
        taste: 'hot',
        letterSpacing: '0.05em',
        blur: '0.2px',
        opacity: 0.92,
        wordSpacing: '0.1em',
        fontSizeScale: 1,
        lineHeight: 2.1,
      },
      {
        index: 3,
        name: '情绪褪色',
        taste: 'sour',
        letterSpacing: '0.09em',
        blur: '0.4px',
        opacity: 0.82,
        wordSpacing: '0.2em',
        fontSizeScale: 1,
        lineHeight: 2.1,
      },
      {
        index: 4,
        name: '语序松动',
        taste: 'bitter',
        letterSpacing: '0.14em',
        blur: '0.7px',
        opacity: 0.68,
        wordSpacing: '0.4em',
        fontSizeScale: 1,
        lineHeight: 2.2,
      },
      {
        index: 5,
        name: '只剩碎片',
        taste: 'numb',
        letterSpacing: '0.22em',
        blur: '1px',
        opacity: 0.5,
        wordSpacing: '1.1em',
        fontSizeScale: 1.1,
        lineHeight: 2.4,
      },
      {
        index: 6,
        name: '最后的痕迹',
        taste: 'clear',
        letterSpacing: '0.46em',
        blur: '1.5px',
        opacity: 0.28,
        wordSpacing: 'normal',
        fontSizeScale: 1.8,
        lineHeight: 2.5,
      },
    ]);
  });
});
