import { describe, expect, it } from 'vitest';
import { DEMO_DATA_EN, DEMO_DATA_ZH, pickDemo } from './demo-data';

describe('demo data', () => {
  it.each([
    ['zh', DEMO_DATA_ZH],
    ['en', DEMO_DATA_EN],
  ] as const)('keeps every %s demo at exactly six progressively lighter stages', (_lang, demos) => {
    for (const demo of demos) {
      expect(demo.stages).toHaveLength(6);
      for (let index = 1; index < demo.stages.length; index += 1) {
        expect(Array.from(demo.stages[index]).length).toBeLessThan(
          Array.from(demo.stages[index - 1]).length,
        );
      }
      expect(demo.whispers).toHaveLength(6);
      expect(demo.acknowledgment.length).toBeGreaterThan(0);
      expect(demo.echo.length).toBeGreaterThan(0);
    }
  });

  it.each(['zh', 'en'] as const)('returns a complete demo experience for %s', (lang) => {
    const demo = pickDemo(lang);
    expect(demo.stages).toHaveLength(6);
    expect(demo.whispers).toHaveLength(6);
    expect(typeof demo.acknowledgment).toBe('string');
    expect(typeof demo.echo).toBe('string');
  });
});
