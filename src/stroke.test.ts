import { describe, expect, it } from 'vitest';
import { directionFromDelta } from './modes';
import {
  appendPoint,
  AURORA_COMMIT_LENGTH_PX,
  AURORA_COMMIT_LENGTH_PX_MOBILE,
  isStrokeCommitted,
  pointAtArc,
  resampleStroke,
  strokeLength,
  strokeNetDirection,
  syntheticPathFor,
  type StrokePoint,
} from './stroke';

function pt(x: number, y: number, t = 0): StrokePoint {
  return { x, y, t };
}

describe('appendPoint', () => {
  it('drops points that are too close to the last recorded point', () => {
    let path: StrokePoint[] = [];
    path = appendPoint(path, pt(0, 0));
    path = appendPoint(path, pt(1, 1)); // ~1.4px, below the 4px gap
    expect(path).toHaveLength(1);
    path = appendPoint(path, pt(10, 0));
    expect(path).toHaveLength(2);
  });

  it('caps the path length by dropping the oldest points', () => {
    let path: StrokePoint[] = [];
    for (let i = 0; i < 300; i += 1) {
      path = appendPoint(path, pt(i * 10, 0));
    }
    expect(path.length).toBeLessThanOrEqual(256);
    expect(path[path.length - 1].x).toBe(299 * 10);
  });
});

describe('strokeLength', () => {
  it('sums euclidean segment lengths', () => {
    const path = [pt(0, 0), pt(10, 0), pt(10, 10)];
    expect(strokeLength(path)).toBeCloseTo(20);
  });

  it('is zero for a single point or empty path', () => {
    expect(strokeLength([])).toBe(0);
    expect(strokeLength([pt(5, 5)])).toBe(0);
  });
});

describe('isStrokeCommitted', () => {
  it('requires the desktop threshold by default', () => {
    const short = [pt(0, 0), pt(AURORA_COMMIT_LENGTH_PX - 10, 0)];
    const long = [pt(0, 0), pt(AURORA_COMMIT_LENGTH_PX + 10, 0)];
    expect(isStrokeCommitted(short)).toBe(false);
    expect(isStrokeCommitted(long)).toBe(true);
  });

  it('uses a lower threshold on mobile', () => {
    const path = [pt(0, 0), pt(AURORA_COMMIT_LENGTH_PX_MOBILE + 5, 0)];
    expect(isStrokeCommitted(path, false)).toBe(false);
    expect(isStrokeCommitted(path, true)).toBe(true);
  });
});

describe('strokeNetDirection', () => {
  it('reports the direction from stroke start to end, not the full path', () => {
    const path = [pt(0, 0), pt(200, 0), pt(180, 0)]; // wiggled back slightly
    expect(strokeNetDirection(path, directionFromDelta)).toBe('right');
  });

  it('returns none for paths shorter than two points', () => {
    expect(strokeNetDirection([], directionFromDelta)).toBe('none');
    expect(strokeNetDirection([pt(0, 0)], directionFromDelta)).toBe('none');
  });
});

describe('resampleStroke', () => {
  it('returns an empty array for degenerate paths', () => {
    expect(resampleStroke([])).toEqual([]);
    expect(resampleStroke([pt(0, 0)])).toEqual([]);
    expect(resampleStroke([pt(5, 5), pt(5, 5)])).toEqual([]);
  });

  it('produces 64 evenly arc-spaced samples along a straight line', () => {
    const path = [pt(0, 0), pt(100, 0)];
    const samples = resampleStroke(path);
    expect(samples).toHaveLength(64);
    expect(samples[0].x).toBeCloseTo(0);
    expect(samples[samples.length - 1].x).toBeCloseTo(100);
    expect(samples[0].arc).toBe(0);
    expect(samples[samples.length - 1].arc).toBe(1);
    for (const s of samples) {
      expect(s.tangentX).toBeCloseTo(1);
      expect(s.tangentY).toBeCloseTo(0);
    }
  });

  it('follows a bent path through its corner', () => {
    const path = [pt(0, 0), pt(100, 0), pt(100, 100)];
    const samples = resampleStroke(path);
    const mid = samples[Math.floor(samples.length / 2)];
    // Corner sits at arc length 100 of 200 total => roughly the midpoint.
    expect(mid.x).toBeGreaterThan(90);
    expect(mid.y).toBeLessThan(20);
  });
});

describe('syntheticPathFor', () => {
  it('builds a straight synthetic path along each cardinal direction', () => {
    const right = syntheticPathFor('right');
    expect(right[right.length - 1].x).toBeGreaterThan(0);
    expect(right[right.length - 1].y).toBeCloseTo(0);

    const down = syntheticPathFor('down');
    expect(down[down.length - 1].y).toBeGreaterThan(0);
    expect(down[down.length - 1].x).toBeCloseTo(0);
  });

  it('degrades to a stationary path for "none"', () => {
    const none = syntheticPathFor('none');
    expect(none[none.length - 1].x).toBeCloseTo(none[0].x);
    expect(none[none.length - 1].y).toBeCloseTo(none[0].y);
  });
});

describe('pointAtArc', () => {
  it('clamps out-of-range arc positions to the path endpoints', () => {
    const samples = resampleStroke([pt(0, 0), pt(100, 0)]);
    expect(pointAtArc(samples, -1).x).toBeCloseTo(0);
    expect(pointAtArc(samples, 2).x).toBeCloseTo(100);
  });

  it('interpolates between the nearest samples', () => {
    const samples = resampleStroke([pt(0, 0), pt(100, 0)]);
    const midpoint = pointAtArc(samples, 0.5);
    expect(midpoint.x).toBeCloseTo(50, 0);
  });
});
