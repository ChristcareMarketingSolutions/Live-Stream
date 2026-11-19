import { describe, it, expect } from 'vitest';
import { softClipCurve } from '../../src/audio/master-bus.js';

describe('safety clipper curve [AUD-004]', () => {
  const curve = softClipCurve();
  it('is transparent below the knee', () => {
    const mid = (curve.length - 1) / 2;
    const at = (x) => curve[Math.round(mid + x * mid)];
    expect(at(0.5)).toBeCloseTo(0.5, 2);
    expect(at(-0.7)).toBeCloseTo(-0.7, 2);
  });
  it('never exceeds the ceiling and is monotonic', () => {
    let prev = -Infinity;
    for (const y of curve) {
      expect(Math.abs(y)).toBeLessThanOrEqual(0.977);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});
