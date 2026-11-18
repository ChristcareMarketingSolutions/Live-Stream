/** Pure audio/music maths helpers. */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** -Infinity dB (or <= -100) maps to 0 gain. */
export const dbToGain = (db) => (db <= -100 ? 0 : Math.pow(10, db / 20));

export const gainToDb = (gain) => (gain <= 0 ? -Infinity : 20 * Math.log10(gain));

export const midiToFreq = (note) => 440 * Math.pow(2, (note - 69) / 12);

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 60 -> "C4" (Yamaha/Scientific convention: middle C = C4). */
export const noteName = (note) => `${NAMES[((note % 12) + 12) % 12]}${Math.floor(note / 12) - 1}`;

/** "C4" / "c#4" / "Db3" -> MIDI number, or null if not parseable. */
export function parseNoteName(text) {
  const m = /^\s*([a-gA-G])([#b]?)(-?\d)\s*$/.exec(text ?? '');
  if (!m) return null;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1].toLowerCase()];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  const n = (Number(m[3]) + 1) * 12 + base + acc;
  return n >= 0 && n <= 127 ? n : null;
}

export const isBlackKey = (note) => [1, 3, 6, 8, 10].includes(((note % 12) + 12) % 12);

export const VELOCITY_CURVES = ['linear', 'soft', 'hard', 'fixed'];

/**
 * Map MIDI velocity (1-127) to 1-127 through a global curve (MIDI-008).
 * soft = easier to play loud, hard = needs more force, fixed = always 100.
 */
export function applyVelocityCurve(velocity, curve = 'linear') {
  const v = clamp(velocity, 1, 127);
  const x = v / 127;
  switch (curve) {
    case 'soft':
      return clamp(Math.round(Math.pow(x, 0.6) * 127), 1, 127);
    case 'hard':
      return clamp(Math.round(Math.pow(x, 1.6) * 127), 1, 127);
    case 'fixed':
      return 100;
    default:
      return v;
  }
}

/** Velocity 1-127 to amplitude 0..1 using a perceptual (squared) response with a floor. */
export const velocityToGain = (velocity, sensitivity = 1) => {
  const x = clamp(velocity, 0, 127) / 127;
  const shaped = x * x;
  return 1 - sensitivity + sensitivity * shaped;
};
