import { describe, it, expect } from 'vitest';
import { parseMidi, msg } from '../../src/midi/midi-parser.js';

describe('MIDI parser [MIDI-003, T-201]', () => {
  it('parses note on/off with channels 1-16', () => {
    expect(parseMidi([0x90, 60, 100], 'kbd', 5)).toEqual({
      type: 'noteon',
      note: 60,
      velocity: 100,
      channel: 1,
      sourceId: 'kbd',
      timeStamp: 5,
    });
    expect(parseMidi([0x8f, 61, 10])).toMatchObject({ type: 'noteoff', note: 61, channel: 16 });
  });

  it('treats note-on velocity 0 as note-off', () => {
    expect(parseMidi([0x90, 60, 0])).toMatchObject({ type: 'noteoff', note: 60 });
  });

  it('parses control change, program change and aftertouch', () => {
    expect(parseMidi([0xb0, 64, 127])).toMatchObject({ type: 'cc', controller: 64, value: 127 });
    expect(parseMidi([0xc2, 5])).toMatchObject({ type: 'program', program: 5, channel: 3 });
    expect(parseMidi([0xd0, 40])).toMatchObject({ type: 'aftertouch', value: 40 });
  });

  it('parses 14-bit pitch bend to -1..+1', () => {
    expect(parseMidi(msg.bend(8192)).bend).toBe(0);
    expect(parseMidi(msg.bend(16383)).bend).toBe(1);
    expect(parseMidi(msg.bend(0)).bend).toBe(-1);
    expect(parseMidi(msg.bend(12288)).bend).toBeCloseTo(0.5, 3);
  });

  it('ignores clock, active sensing, sysex and garbage', () => {
    for (const m of [[0xf8], [0xfe], [0xf0, 1, 2, 0xf7], [0x40, 1], [], null]) {
      expect(parseMidi(m)).toBeNull();
    }
  });

  it('builds messages that round-trip', () => {
    expect(parseMidi(msg.noteOn(64, 90, 2))).toMatchObject({
      type: 'noteon',
      note: 64,
      velocity: 90,
      channel: 2,
    });
    expect(parseMidi(msg.cc(1, 33))).toMatchObject({ controller: 1, value: 33 });
    expect(parseMidi(msg.program(7))).toMatchObject({ program: 7 });
  });
});
