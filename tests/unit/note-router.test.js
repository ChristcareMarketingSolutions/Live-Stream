import { describe, it, expect } from 'vitest';
import { routeNoteOn } from '../../src/performance/note-router.js';
import { defaultLayer } from '../../src/performance/concert-model.js';

const ev = (note, velocity = 100, channel = 1) => ({ note, velocity, channel });

describe('note router [LIVE-010, LIVE-020, T-401]', () => {
  const bass = defaultLayer({ id: 'bass', zone: { low: 24, high: 47 } });
  const piano = defaultLayer({ id: 'piano', zone: { low: 48, high: 108 } });
  const pad = defaultLayer({ id: 'pad', zone: { low: 48, high: 108 } });

  it('splits: each note goes to the zone it falls in', () => {
    expect(routeNoteOn([bass, piano], ev(40)).map((r) => r.layer.id)).toEqual(['bass']);
    expect(routeNoteOn([bass, piano], ev(60)).map((r) => r.layer.id)).toEqual(['piano']);
    expect(routeNoteOn([bass, piano], ev(47)).map((r) => r.layer.id)).toEqual(['bass']);
    expect(routeNoteOn([bass, piano], ev(48)).map((r) => r.layer.id)).toEqual(['piano']);
    expect(routeNoteOn([bass, piano], ev(10))).toEqual([]);
  });

  it('layers: overlapping zones both play', () => {
    expect(routeNoteOn([piano, pad], ev(60)).map((r) => r.layer.id)).toEqual(['piano', 'pad']);
  });

  it('applies transpose and octave', () => {
    const l = defaultLayer({ transpose: 2, octave: -1 });
    expect(routeNoteOn([l], ev(60))[0].playedNote).toBe(50);
  });

  it('drops notes transposed out of MIDI range', () => {
    expect(
      routeNoteOn([defaultLayer({ zone: { low: 0, high: 127 }, octave: 3 })], ev(100)),
    ).toEqual([]);
  });

  it('filters by MIDI channel (0 = omni)', () => {
    const ch2 = defaultLayer({ channel: 2 });
    const omni = defaultLayer({ id: 'omni' });
    expect(routeNoteOn([ch2, omni], ev(60, 100, 1)).map((r) => r.layer.id)).toEqual(['omni']);
    expect(routeNoteOn([ch2, omni], ev(60, 100, 2))).toHaveLength(2);
  });

  it('filters by velocity range', () => {
    const soft = defaultLayer({ id: 'soft', velocity: { low: 1, high: 64 } });
    const hard = defaultLayer({ id: 'hard', velocity: { low: 65, high: 127 } });
    expect(routeNoteOn([soft, hard], ev(60, 30)).map((r) => r.layer.id)).toEqual(['soft']);
    expect(routeNoteOn([soft, hard], ev(60, 100)).map((r) => r.layer.id)).toEqual(['hard']);
  });

  it('honours mute and solo', () => {
    const a = defaultLayer({ id: 'a', mute: true });
    const b = defaultLayer({ id: 'b' });
    expect(routeNoteOn([a, b], ev(60)).map((r) => r.layer.id)).toEqual(['b']);
    const c = defaultLayer({ id: 'c', solo: true });
    expect(routeNoteOn([b, c], ev(60)).map((r) => r.layer.id)).toEqual(['c']);
  });
});
