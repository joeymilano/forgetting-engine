import { describe, expect, it } from 'vitest';
import { DEMO_DATA_EN, DEMO_DATA_ZH } from './demo-data';

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
