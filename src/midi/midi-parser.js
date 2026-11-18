/**
 * Raw MIDI bytes → normalised MidiEvent (MIDI-003). Pure.
 *
 * @typedef {{ type: 'noteon'|'noteoff'|'cc'|'pitchbend'|'program'|'aftertouch'|'polyaftertouch',
 *   channel: number, note?: number, velocity?: number, controller?: number, value?: number,
 *   program?: number, bend?: number, sourceId: string, timeStamp: number }} MidiEvent
 *
 * channel is 1-16. bend is -1..+1. Returns null for messages we ignore
 * (system real-time such as clock 0xF8 and active sensing 0xFE, SysEx).
 */
export function parseMidi(data, sourceId = 'unknown', timeStamp = 0) {
  if (!data || data.length === 0) return null;
  const status = data[0];
  if (status >= 0xf0 || status < 0x80) return null;
  const kind = status & 0xf0;
  const channel = (status & 0x0f) + 1;
  const d1 = (data[1] ?? 0) & 0x7f;
  const d2 = (data[2] ?? 0) & 0x7f;
  const base = { channel, sourceId, timeStamp };

  switch (kind) {
    case 0x90:
      // Note-on with velocity 0 is a note-off (MIDI-003).
      return d2 === 0
        ? { ...base, type: 'noteoff', note: d1, velocity: 64 }
        : { ...base, type: 'noteon', note: d1, velocity: d2 };
    case 0x80:
      return { ...base, type: 'noteoff', note: d1, velocity: d2 };
    case 0xb0:
      return { ...base, type: 'cc', controller: d1, value: d2 };
    case 0xc0:
      return { ...base, type: 'program', program: d1 };
    case 0xe0: {
      const raw = (d2 << 7) | d1; // 14-bit, centre 8192
      const bend = raw === 8192 ? 0 : raw > 8192 ? (raw - 8192) / 8191 : (raw - 8192) / 8192;
      return { ...base, type: 'pitchbend', value: raw, bend };
    }
    case 0xd0:
      return { ...base, type: 'aftertouch', value: d1 };
    case 0xa0:
      return { ...base, type: 'polyaftertouch', note: d1, value: d2 };
    default:
      return null;
  }
}

/** Helpers to build raw messages (tests, on-screen keyboard, debug hook). */
export const msg = {
  noteOn: (note, velocity = 100, channel = 1) => [0x90 | (channel - 1), note, velocity],
  noteOff: (note, channel = 1) => [0x80 | (channel - 1), note, 64],
  cc: (controller, value, channel = 1) => [0xb0 | (channel - 1), controller, value],
  program: (program, channel = 1) => [0xc0 | (channel - 1), program],
  bend: (value14, channel = 1) => [0xe0 | (channel - 1), value14 & 0x7f, (value14 >> 7) & 0x7f],
};

export const CC = {
  MOD: 1,
  VOLUME: 7,
  EXPRESSION: 11,
  SUSTAIN: 64,
  ALL_SOUND_OFF: 120,
  ALL_NOTES_OFF: 123,
};
