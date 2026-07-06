import { describe, expect, it } from 'vitest';
import { fallbackStages } from './fallback';

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
