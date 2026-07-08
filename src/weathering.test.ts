import { describe, expect, it } from 'vitest';
import { WEATHERING_EFFECT_PROFILE } from './weathering';

describe('weathering effect profile', () => {
  it('makes the final dispersal more visible than ordinary ash transitions', () => {
    const { ashTransition, finalDispersal } = WEATHERING_EFFECT_PROFILE;

    expect(finalDispersal.durationMultiplier).toBeGreaterThan(
      ashTransition.durationMultiplier,
    );
    expect(finalDispersal.delayMultiplier).toBeLessThan(
      ashTransition.delayMultiplier,
    );
    expect(finalDispersal.driftMultiplier).toBeGreaterThan(
      ashTransition.driftMultiplier,
    );
    expect(finalDispersal.alphaMultiplier).toBeGreaterThan(
      ashTransition.alphaMultiplier,
    );
    expect(finalDispersal.sizeMultiplier).toBeGreaterThan(
      ashTransition.sizeMultiplier,
    );
  });

  it('keeps late-stage ash readable without overwhelming the stage', () => {
    const { ambientAsh } = WEATHERING_EFFECT_PROFILE;

    expect(ambientAsh.minCount).toBeGreaterThanOrEqual(3);
    expect(ambientAsh.maxCount).toBeLessThanOrEqual(7);
    expect(ambientAsh.lifeDecay).toBeLessThan(0.0035);
    expect(ambientAsh.alphaMultiplier).toBeGreaterThan(0.7);
  });
});
