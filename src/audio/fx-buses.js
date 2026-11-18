import { dbToGain, clamp } from '../core/math.js';
import { smoothSet } from './envelope.js';

/** Reverb presets: algorithmic impulse responses, no licensed IR files needed (docs/05 §6). */
export const REVERB_PRESETS = {
  room: { label: 'Room', seconds: 0.8, damping: 6000, predelay: 0.005 },
  hall: { label: 'Hall', seconds: 2.2, damping: 4500, predelay: 0.02 },
  cathedral: { label: 'Cathedral', seconds: 4.5, damping: 3500, predelay: 0.035 },
  plate: { label: 'Plate', seconds: 1.6, damping: 9000, predelay: 0.0 },
};

export const DELAY_DIVISIONS = {
  '1/4': 1,
  '1/8': 0.5,
  '1/8d': 0.75,
  '1/4d': 1.5,
  '1/16': 0.25,
  '1/2': 2,
};

/**
 * Exponentially decaying, stereo-decorrelated noise with progressive high-frequency
 * damping. Deterministic (seeded) so renders are reproducible in tests.
 */
export function generateImpulse(ctx, { seconds, damping, predelay }) {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * (seconds + predelay)));
  const buffer = ctx.createBuffer(2, length, rate);
  const pre = Math.floor(predelay * rate);
  let seed = 22222;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 1073741823.5 - 1;
  };
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / rate;
      const env = Math.pow(1 - t / seconds, 2) * Math.exp((-6.9 * t) / seconds);
      // One-pole low-pass whose cutoff falls over time: darker tail.
      const cutoff = damping * Math.exp((-1.5 * t) / seconds) + 300;
      const k = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
      lp += k * (rand() - lp);
      data[i] = lp * env;
    }
  }
  // Normalise energy so presets sit at similar loudness.
  let energy = 0;
  for (let ch = 0; ch < 2; ch++) for (const s of buffer.getChannelData(ch)) energy += s * s;
  const norm = 1 / Math.sqrt(energy / 2 || 1);
  for (let ch = 0; ch < 2; ch++) {
    const d = buffer.getChannelData(ch);
    for (let i = 0; i < d.length; i++) d[i] *= norm * 0.5;
  }
  return buffer;
}

/** Shared reverb and tempo-synced delay buses (MIX-001). Layers send into `reverbIn` / `delayIn`. */
export function createFxBuses(ctx, destination) {
  const reverbIn = ctx.createGain();
  const convolver = ctx.createConvolver();
  const reverbReturn = ctx.createGain();
  reverbIn.connect(convolver).connect(reverbReturn).connect(destination);

  const delayIn = ctx.createGain();
  const delay = ctx.createDelay(4);
  const feedback = ctx.createGain();
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 5000;
  const delayReturn = ctx.createGain();
  delayIn.connect(delay);
  delay.connect(tone);
  tone.connect(feedback).connect(delay);
  tone.connect(delayReturn).connect(destination);
  // Delay echoes also go into the reverb a little, so they sit in the same space.
  const delayToReverb = ctx.createGain();
  delayToReverb.gain.value = 0.25;
  tone.connect(delayToReverb).connect(reverbIn);

  const irCache = new Map();
  let currentPreset = null;

  function apply(settings) {
    const rv = settings.reverb ?? {};
    const preset = REVERB_PRESETS[rv.preset] ? rv.preset : 'hall';
    if (preset !== currentPreset) {
      if (!irCache.has(preset)) irCache.set(preset, generateImpulse(ctx, REVERB_PRESETS[preset]));
      convolver.buffer = irCache.get(preset);
      currentPreset = preset;
    }
    smoothSet(reverbReturn.gain, dbToGain(rv.returnDb ?? -8), ctx);

    const dl = settings.delay ?? {};
    const tempo = clamp(settings.tempo ?? 72, 30, 300);
    const beats = DELAY_DIVISIONS[dl.sync] ?? 1;
    smoothSet(delay.delayTime, clamp((60 / tempo) * beats, 0.01, 3.9), ctx, 0.05);
    smoothSet(feedback.gain, clamp(dl.feedback ?? 0.3, 0, 0.95), ctx); // docs/04 §7: hard limit
    smoothSet(delayReturn.gain, dbToGain(dl.returnDb ?? -14), ctx);
  }

  apply({});
  return { reverbIn, delayIn, apply };
}
