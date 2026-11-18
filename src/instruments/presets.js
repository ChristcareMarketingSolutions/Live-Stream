/**
 * Factory presets for the synthesised instruments (Phase 3, docs/05 §1).
 * Levels are calibrated so a C4 at velocity 100 peaks around -18 dBFS
 * (docs/04 §7); see tests/e2e/instruments.spec.js.
 */

/** Tonewheel drawbar footages as harmonic numbers of the 16' sub-fundamental. */
const DRAWBAR_HARMONICS = [1, 3, 2, 4, 6, 8, 10, 12, 16];

/**
 * "888000000" → PeriodicWave amplitudes (index = harmonic of 16' pitch).
 * Each drawbar step below 8 is -3 dB; 0 is off.
 * @param {string} registration nine digits 0-8
 */
export function drawbarHarmonics(registration) {
  const amps = new Array(17).fill(0);
  [...registration].slice(0, 9).forEach((ch, i) => {
    const n = Number(ch);
    if (n > 0) amps[DRAWBAR_HARMONICS[i]] += Math.pow(10, (-3 * (8 - n)) / 20);
  });
  return amps;
}

function tonewheel(registration, { perc = null, click = 0.06, fast = false } = {}) {
  const oscs = [{ harmonics: drawbarHarmonics(registration), ratio: 0.5, gain: 1 }];
  if (perc) {
    oscs.push({
      type: 'sine',
      ratio: perc.harmonic,
      gain: 0.45,
      env: { a: 0.001, d: perc.decay, s: 0 },
    });
  }
  if (click) oscs.push({ type: 'noise', gain: click, env: { a: 0.0005, d: 0.006, s: 0 } });
  return {
    oscillators: oscs,
    amp: { a: 0.004, d: 0.01, s: 1, r: 0.04 },
    gain: 0.32,
    velSens: 0, // organs are not velocity sensitive
    modWheel: 'rotary',
    effects: [{ type: 'rotary', startFast: fast }],
  };
}

/** Pipe organ stop combination as harmonics of the 16' pitch. */
function pipe(harmonics, { chiff = 0.08, release = 0.18 } = {}) {
  return {
    oscillators: [
      { harmonics, ratio: 0.5, gain: 1 },
      { harmonics, ratio: 0.5, detune: 3, gain: 0.5 }, // slight beating of real ranks
      { type: 'noise', gain: chiff, env: { a: 0.002, d: 0.05, s: 0 } },
    ],
    filter: { type: 'lowpass', freq: 6000, keyTrack: 0.3, velAmount: 0 },
    amp: { a: 0.045, d: 0.05, s: 1, r: release },
    gain: 0.3,
    velSens: 0,
    modWheel: 'none',
  };
}

const saw = (detune = 0, gain = 1, ratio = 1) => ({ type: 'sawtooth', detune, gain, ratio });

export const PRESETS = {
  'electric-piano': {
    classic: {
      name: 'Classic Tine',
      oscillators: [
        { type: 'sine', gain: 1, fm: { ratio: 1, index: 1.4, decay: 1.2, sustain: 0.08 } },
        { type: 'sine', ratio: 1, gain: 0.25, fm: { ratio: 14, index: 0.7, decay: 0.04 } },
      ],
      amp: { a: 0.002, d: 4.5, s: 0, r: 0.28 },
      gain: 0.5,
      velSens: 0.85,
      lfo: { rate: 5.5, depth: 15 },
      effects: [{ type: 'chorus', rate: 0.4, depth: 0.0015, mix: 0.3 }],
    },
    tremolo: {
      name: 'Stage Tremolo',
      oscillators: [
        { type: 'sine', gain: 1, fm: { ratio: 1, index: 1.8, decay: 1.0, sustain: 0.1 } },
        { type: 'sine', ratio: 1, gain: 0.25, fm: { ratio: 14, index: 0.9, decay: 0.035 } },
      ],
      amp: { a: 0.002, d: 4.5, s: 0, r: 0.28 },
      gain: 0.5,
      velSens: 0.85,
      lfo: { rate: 5.5, depth: 15 },
      effects: [{ type: 'tremolo', rate: 4.2, depth: 0.55, stereo: true }],
    },
    bell: {
      name: 'Bell EP',
      oscillators: [
        { type: 'sine', gain: 1, fm: { ratio: 1, index: 1.1, decay: 1.5, sustain: 0.05 } },
        { type: 'sine', ratio: 1, gain: 0.5, fm: { ratio: 3.5, index: 1.5, decay: 0.6 } },
      ],
      amp: { a: 0.002, d: 5, s: 0, r: 0.3 },
      gain: 0.42,
      velSens: 0.85,
      lfo: { rate: 5.5, depth: 15 },
      effects: [{ type: 'chorus', rate: 0.5, depth: 0.002, mix: 0.45 }],
    },
  },
  tonewheel: {
    gospel: { name: 'Gospel Full (888 800 000)', ...tonewheel('888800000', { fast: true }) },
    ballad: {
      name: 'Ballad (838 000 000)',
      ...tonewheel('838000000', { perc: { harmonic: 3, decay: 0.3 } }),
    },
    jazz: {
      name: 'Jazz Perc (888 000 000)',
      ...tonewheel('888000000', { perc: { harmonic: 2, decay: 0.2 } }),
    },
    full: { name: 'Full Organ (888 888 888)', ...tonewheel('888888888'), gain: 0.22 },
    soft: { name: 'Soft Worship (008 080 800)', ...tonewheel('008080800', { click: 0.02 }) },
  },
  'pipe-organ': {
    principal: {
      name: "Principal 8'",
      ...pipe([0, 0, 1, 0, 0.35, 0, 0.2, 0, 0.1, 0, 0.05]),
    },
    flutes: {
      name: "Flutes 8' + 4'",
      ...pipe([0, 0, 1, 0, 0.6, 0, 0.05, 0, 0.02], { chiff: 0.12 }),
    },
    full: {
      name: 'Full Organ',
      ...pipe(
        [
          0, 0.8, 1, 0.3, 0.8, 0.2, 0.55, 0, 0.5, 0, 0.25, 0, 0.35, 0, 0, 0, 0.25, 0, 0, 0, 0, 0, 0,
          0, 0.15,
        ],
        { chiff: 0.05, release: 0.35 },
      ),
      gain: 0.22,
    },
  },
  strings: {
    warm: {
      name: 'Warm Strings',
      oscillators: [saw(-9), saw(0), saw(9), saw(4, 0.3, 0.5)],
      filter: { type: 'lowpass', freq: 2200, q: 0.5, keyTrack: 0.4, velAmount: 0.6 },
      amp: { a: 0.28, d: 1, s: 0.9, r: 0.8 },
      gain: 0.36,
      velSens: 0.5,
      lfo: { rate: 5.2, base: 4, depth: 20 },
      effects: [{ type: 'chorus', rate: 0.35, depth: 0.003, mix: 0.6 }],
    },
    fast: {
      name: 'Fast Strings',
      oscillators: [saw(-8), saw(0), saw(8)],
      filter: { type: 'lowpass', freq: 3000, q: 0.5, keyTrack: 0.4, velAmount: 0.8 },
      amp: { a: 0.06, d: 0.6, s: 0.85, r: 0.45 },
      gain: 0.34,
      velSens: 0.6,
      lfo: { rate: 5.2, base: 4, depth: 20 },
      effects: [{ type: 'chorus', rate: 0.35, depth: 0.003, mix: 0.6 }],
    },
    swell: {
      name: 'Cinematic Swell',
      oscillators: [saw(-12), saw(0), saw(12), saw(0, 0.4, 0.5)],
      filter: {
        type: 'lowpass',
        freq: 700,
        q: 0.8,
        keyTrack: 0.3,
        velAmount: 0.3,
        envAmount: 3,
        env: { a: 1.6, d: 2, s: 0.6, r: 1.2 },
      },
      amp: { a: 1.2, d: 2, s: 0.9, r: 1.4 },
      gain: 0.4,
      velSens: 0.4,
      lfo: { rate: 5, base: 3, depth: 20 },
      effects: [{ type: 'chorus', rate: 0.25, depth: 0.004, mix: 0.7 }],
    },
  },
  choir: {
    aah: {
      name: 'Choir Aah',
      oscillators: [saw(-7), saw(7), { type: 'triangle', gain: 0.5 }],
      formants: [
        { freq: 800, q: 5, gain: 1 },
        { freq: 1150, q: 6, gain: 0.6 },
        { freq: 2900, q: 8, gain: 0.25 },
      ],
      filter: { type: 'lowpass', freq: 4500, keyTrack: 0, velAmount: 0.2 },
      amp: { a: 0.35, d: 1, s: 0.9, r: 0.9 },
      gain: 1.3,
      velSens: 0.4,
      lfo: { rate: 5, base: 7, depth: 20 },
      effects: [{ type: 'chorus', rate: 0.3, depth: 0.004, mix: 0.7 }],
    },
    ooh: {
      name: 'Choir Ooh',
      oscillators: [saw(-6), saw(6), { type: 'triangle', gain: 0.8 }],
      formants: [
        { freq: 330, q: 5, gain: 1 },
        { freq: 750, q: 6, gain: 0.45 },
        { freq: 2400, q: 8, gain: 0.12 },
      ],
      filter: { type: 'lowpass', freq: 3000, keyTrack: 0, velAmount: 0.2 },
      amp: { a: 0.4, d: 1, s: 0.9, r: 1.0 },
      gain: 1.4,
      velSens: 0.4,
      lfo: { rate: 5, base: 7, depth: 20 },
      effects: [{ type: 'chorus', rate: 0.3, depth: 0.004, mix: 0.7 }],
    },
  },
  pads: {
    warm: {
      name: 'Warm Pad',
      oscillators: [saw(-7), saw(7), { type: 'sine', ratio: 0.5, gain: 0.6 }],
      filter: { type: 'lowpass', freq: 900, q: 0.9, keyTrack: 0.3, velAmount: 0.3 },
      amp: { a: 0.8, d: 1.5, s: 0.9, r: 1.8 },
      gain: 0.42,
      velSens: 0.3,
      lfo: { rate: 4.5, base: 2, depth: 15 },
      effects: [{ type: 'chorus', rate: 0.25, depth: 0.004, mix: 0.7 }],
    },
    worship: {
      name: 'Worship Pad',
      oscillators: [saw(-10), saw(0), saw(10), { type: 'triangle', ratio: 2, gain: 0.3 }],
      filter: { type: 'lowpass', freq: 1400, q: 1, keyTrack: 0.3, velAmount: 0.3 },
      amp: { a: 1.2, d: 2, s: 0.9, r: 2.5 },
      gain: 0.4,
      velSens: 0.3,
      lfo: { rate: 4.5, base: 2, depth: 15 },
      effects: [{ type: 'chorus', rate: 0.2, depth: 0.005, mix: 0.8 }],
    },
    shimmer: {
      name: 'Shimmer Pad',
      oscillators: [
        saw(-6, 0.7),
        saw(6, 0.7),
        { type: 'sine', ratio: 2, gain: 0.5 },
        { type: 'sine', ratio: 4, gain: 0.25, detune: 4 },
      ],
      filter: { type: 'lowpass', freq: 3200, q: 0.7, keyTrack: 0.2, velAmount: 0.2 },
      amp: { a: 1.0, d: 2, s: 0.85, r: 3 },
      gain: 0.4,
      velSens: 0.3,
      lfo: { rate: 4.5, base: 3, depth: 15 },
      effects: [{ type: 'chorus', rate: 0.3, depth: 0.004, mix: 0.8 }],
    },
    air: {
      name: 'Air Pad',
      oscillators: [
        { type: 'noise', gain: 0.25 },
        { type: 'sine', gain: 1 },
        { type: 'triangle', ratio: 2, gain: 0.35 },
      ],
      filter: { type: 'lowpass', freq: 2500, q: 0.5, keyTrack: 0.5, velAmount: 0.2 },
      amp: { a: 1.5, d: 2, s: 0.9, r: 2.5 },
      gain: 0.42,
      velSens: 0.3,
      effects: [{ type: 'chorus', rate: 0.2, depth: 0.005, mix: 0.8 }],
    },
    dark: {
      name: 'Dark Pad',
      oscillators: [saw(-5), saw(5), { type: 'sine', ratio: 0.5, gain: 0.8 }],
      filter: { type: 'lowpass', freq: 520, q: 2, keyTrack: 0.3, velAmount: 0.2 },
      amp: { a: 1.0, d: 2, s: 0.9, r: 2.2 },
      gain: 0.55,
      velSens: 0.3,
      effects: [{ type: 'chorus', rate: 0.2, depth: 0.004, mix: 0.6 }],
    },
    swell: {
      name: 'Swell Pad',
      oscillators: [saw(-8), saw(8), { type: 'sine', ratio: 0.5, gain: 0.5 }],
      filter: {
        type: 'lowpass',
        freq: 400,
        q: 1.2,
        keyTrack: 0.3,
        velAmount: 0.2,
        envAmount: 4,
        env: { a: 3, d: 3, s: 0.7, r: 2 },
      },
      amp: { a: 3, d: 2, s: 0.95, r: 2.5 },
      gain: 0.48,
      velSens: 0.2,
      effects: [{ type: 'chorus', rate: 0.2, depth: 0.005, mix: 0.7 }],
    },
  },
  'synth-bass': {
    deep: {
      name: 'Deep Bass',
      oscillators: [saw(0, 0.7), { type: 'sine', gain: 1 }],
      filter: {
        type: 'lowpass',
        freq: 380,
        q: 1,
        keyTrack: 0.6,
        velAmount: 0.5,
        envAmount: 3,
        env: { a: 0.003, d: 0.25, s: 0.2, r: 0.1 },
      },
      amp: { a: 0.003, d: 0.6, s: 0.8, r: 0.12 },
      gain: 0.55,
      velSens: 0.6,
      modWheel: 'none',
    },
    round: {
      name: 'Round Bass',
      oscillators: [{ type: 'triangle' }, { type: 'sine', gain: 0.8 }],
      filter: { type: 'lowpass', freq: 900, q: 0.7, keyTrack: 0.5, velAmount: 0.4 },
      amp: { a: 0.004, d: 0.8, s: 0.7, r: 0.15 },
      gain: 0.6,
      velSens: 0.6,
      modWheel: 'none',
    },
    punchy: {
      name: 'Punchy Bass',
      oscillators: [{ type: 'square', gain: 0.6 }, saw(5, 0.7)],
      filter: {
        type: 'lowpass',
        freq: 500,
        q: 3,
        keyTrack: 0.6,
        velAmount: 0.7,
        envAmount: 5,
        env: { a: 0.002, d: 0.18, s: 0.15, r: 0.08 },
      },
      amp: { a: 0.002, d: 0.4, s: 0.75, r: 0.1 },
      gain: 0.5,
      velSens: 0.7,
      modWheel: 'none',
    },
  },
  'analog-synth': {
    lead: {
      name: 'Analog Lead',
      oscillators: [saw(-6), { type: 'square', detune: 6, gain: 0.7 }],
      filter: {
        type: 'lowpass',
        freq: 1600,
        q: 2,
        keyTrack: 0.5,
        velAmount: 0.6,
        envAmount: 2,
        env: { a: 0.005, d: 0.4, s: 0.4, r: 0.2 },
      },
      amp: { a: 0.005, d: 0.3, s: 0.8, r: 0.18 },
      gain: 0.3,
      velSens: 0.5,
      lfo: { rate: 5.8, depth: 30 },
    },
    softsaw: {
      name: 'Soft Saw',
      oscillators: [saw(-4), saw(4)],
      filter: { type: 'lowpass', freq: 1200, q: 0.7, keyTrack: 0.5, velAmount: 0.6 },
      amp: { a: 0.02, d: 0.5, s: 0.8, r: 0.35 },
      gain: 0.32,
      velSens: 0.6,
      lfo: { rate: 5.5, depth: 25 },
    },
    bell: {
      name: 'Bell Synth',
      oscillators: [{ type: 'sine', fm: { ratio: 3.5, index: 2.2, decay: 1.2, sustain: 0.05 } }],
      amp: { a: 0.002, d: 3, s: 0, r: 0.8 },
      gain: 0.42,
      velSens: 0.7,
      effects: [{ type: 'chorus', rate: 0.4, depth: 0.002, mix: 0.4 }],
    },
  },
};
