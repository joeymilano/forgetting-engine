import { describe, expect, it } from 'vitest';
import {
  AMBIENT_MODES,
  MIST_HOLD_THRESHOLD_MS,
  directionFromDelta,
  getModeBehavior,
  isMistReady,
  mistHoldProgress,
  nextAmbientMode,
  normalizeAmbientMode,
} from './modes';

describe('ambient mode behavior model', () => {
  it('keeps the existing persisted theme order', () => {
    expect(AMBIENT_MODES).toEqual(['stardust', 'mist', 'aurora']);
    expect(nextAmbientMode('stardust')).toBe('mist');
    expect(nextAmbientMode('mist')).toBe('aurora');
    expect(nextAmbientMode('aurora')).toBe('stardust');
  });

  it('exposes only the three existing persisted mode names', () => {
    expect([...AMBIENT_MODES]).toEqual(['stardust', 'mist', 'aurora']);
  });

  it('falls back unknown stored values to stardust', () => {
    expect(normalizeAmbientMode('mist')).toBe('mist');
    expect(normalizeAmbientMode('aurora')).toBe('aurora');
    expect(normalizeAmbientMode('old-theme')).toBe('stardust');
    expect(normalizeAmbientMode(null)).toBe('stardust');
  });

  it('defines distinct behavior tokens for each mode', () => {
    expect(getModeBehavior('stardust')).toMatchObject({
      advanceKind: 'click',
      transitionKind: 'ash',
      progressKind: 'dots',
      particleField: 'embers',
    });
    expect(getModeBehavior('mist')).toMatchObject({
      advanceKind: 'hold',
      transitionKind: 'fog',
      progressKind: 'rail',
      particleField: 'fog',
    });
    expect(getModeBehavior('aurora')).toMatchObject({
      advanceKind: 'directional',
      transitionKind: 'ribbon',
      progressKind: 'bars',
      particleField: 'streams',
    });
  });

  it('requires the full Mist hold threshold before release can advance', () => {
    expect(MIST_HOLD_THRESHOLD_MS).toBe(1100);
    expect(isMistReady(0)).toBe(false);
    expect(isMistReady(1099)).toBe(false);
    expect(isMistReady(1100)).toBe(true);
    expect(isMistReady(1400)).toBe(true);
  });

  it('clamps Mist hold progress between zero and one', () => {
    expect(mistHoldProgress(-50)).toBe(0);
    expect(mistHoldProgress(550)).toBe(0.5);
    expect(mistHoldProgress(1100)).toBe(1);
    expect(mistHoldProgress(1600)).toBe(1);
  });

  it('normalizes Aurora pointer movement into four readable directions', () => {
    expect(directionFromDelta(80, 10)).toBe('right');
    expect(directionFromDelta(-80, 10)).toBe('left');
    expect(directionFromDelta(10, -80)).toBe('up');
    expect(directionFromDelta(10, 80)).toBe('down');
    expect(directionFromDelta(3, 4)).toBe('none');
  });
});
