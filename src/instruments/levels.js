/**
 * Level trims in dB, measured with an offline render of C4 (C2 for bass) at
 * velocity 100 so every preset peaks near -12 dBFS (docs/04 §7). Re-measure
 * with tests/e2e/instruments.spec.js after changing a preset.
 */
export const LEVEL_TRIM_DB = {
  'grand-piano': { concert: -4.9, bright: -4.3, mellow: -6.0, worship: -5.9 },
  'electric-piano': { classic: -2.6, tremolo: -1.9, bell: -0.8 },
  tonewheel: { gospel: -2.5, ballad: 1.8, jazz: 1.6, full: -3.1, soft: -6.7 },
  'pipe-organ': { principal: -1.1, flutes: -0.9, full: 1.4 },
  strings: { warm: 1.3, fast: 2.4, swell: -1.0 },
  choir: { aah: -2.1, ooh: 0.0 },
  pads: { warm: -2.4, worship: 1.2, shimmer: 1.6, air: -1.2, dark: -3.3, swell: 1.4 },
  'synth-bass': { deep: -2.3, round: -5.3, punchy: -5.7 },
  'analog-synth': { lead: -1.1, softsaw: 0.0, bell: -1.9 },
};
