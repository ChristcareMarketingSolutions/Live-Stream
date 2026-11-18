import { describe, it, expect } from 'vitest';
import {
  dbToGain,
  gainToDb,
  midiToFreq,
  noteName,
  parseNoteName,
  applyVelocityCurve,
  velocityToGain,
  isBlackKey,
} from '../../src/core/math.js';

describe('math', () => {
  it('converts dB and gain', () => {
    expect(dbToGain(0)).toBe(1);
    expect(dbToGain(-6)).toBeCloseTo(0.501, 3);
    expect(dbToGain(-120)).toBe(0);
    expect(gainToDb(0.5)).toBeCloseTo(-6.02, 2);
    expect(gainToDb(0)).toBe(-Infinity);
  });

  it('converts MIDI to frequency', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(60)).toBeCloseTo(261.63, 2);
  });

  it('names notes and parses names', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(21)).toBe('A0');
    expect(noteName(61)).toBe('C#4');
    expect(parseNoteName('C4')).toBe(60);
    expect(parseNoteName('db4')).toBe(61);
    expect(parseNoteName('A0')).toBe(21);
    expect(parseNoteName('H9')).toBeNull();
    for (let n = 0; n < 128; n++) expect(parseNoteName(noteName(n))).toBe(n);
  });

  it('identifies black keys', () => {
    expect([60, 61, 62, 63, 64].map(isBlackKey)).toEqual([false, true, false, true, false]);
  });

  it('applies velocity curves monotonically within 1-127 [MIDI-008]', () => {
    for (const curve of ['linear', 'soft', 'hard']) {
      let prev = 0;
      for (let v = 1; v <= 127; v++) {
        const out = applyVelocityCurve(v, curve);
        expect(out).toBeGreaterThanOrEqual(1);
        expect(out).toBeLessThanOrEqual(127);
        expect(out).toBeGreaterThanOrEqual(prev);
        prev = out;
      }
    }
    expect(applyVelocityCurve(64, 'soft')).toBeGreaterThan(64);
    expect(applyVelocityCurve(64, 'hard')).toBeLessThan(64);
    expect(applyVelocityCurve(5, 'fixed')).toBe(100);
  });

  it('maps velocity to gain with a floor set by sensitivity', () => {
    expect(velocityToGain(127, 1)).toBeCloseTo(1);
    expect(velocityToGain(0, 0.7)).toBeCloseTo(0.3);
    expect(velocityToGain(64, 0)).toBe(1);
  });
});
