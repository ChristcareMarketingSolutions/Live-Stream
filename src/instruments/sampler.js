import { Instrument } from './instrument.js';
import { startAdsr, releaseParam, killParam, holdAt } from '../audio/envelope.js';
import { clamp } from '../core/math.js';

/**
 * Pure: pick the region for a note/velocity (nearest root within the velocity
 * layer, so missing keys borrow from neighbours).
 * @param {Array<{root:number, lo:number, hi:number, velLo:number, velHi:number}>} regions
 */
export function findRegion(regions, note, velocity) {
  let best = null;
  let bestDist = Infinity;
  for (const r of regions) {
    if (velocity < r.velLo || velocity > r.velHi) continue;
    if (note >= r.lo && note <= r.hi) return r;
    const d = Math.abs(note - r.root);
    if (d < bestDist) {
      best = r;
      bestDist = d;
    }
  }
  return best;
}

/** Playback rate to shift a sample from its root note to `note`. */
export const playbackRateFor = (note, root, tuneCents = 0) =>
  Math.pow(2, (note - root + tuneCents / 100) / 12);

/**
 * Multisample instrument (INS-002). Buffers come from the pack store and are
 * shared by every layer that uses the same pack.
 */
export class Sampler extends Instrument {
  /**
   * @param {BaseAudioContext} ctx
   * @param {{ pack: { manifest: any, buffers: Map<string, AudioBuffer>, loaded: boolean }, preset: any }} opts
   */
  constructor(ctx, { pack, preset, maxVoices = 64 }) {
    super(ctx, { maxVoices });
    this.pack = pack;
    this.preset = preset;
    this.voiceBus = ctx.createGain();
    this.voiceBus.connect(this.output);
  }

  get isLoaded() {
    return !!this.pack?.loaded;
  }

  get memoryBytes() {
    return this.pack?.memoryBytes ?? 0;
  }

  createVoice(note, velocity, t) {
    const { manifest, buffers } = this.pack;
    const region = findRegion(manifest.regions, note, velocity);
    const buffer = region && buffers.get(region.file);
    if (!buffer) return null;
    const ctx = this.ctx;
    const p = this.preset;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = playbackRateFor(note, region.root, region.tune ?? 0);

    // Within a velocity layer, scale level smoothly between the layer's edges.
    const span = Math.max(1, region.velHi - region.velLo);
    const pos = (velocity - region.velLo) / span; // 0..1
    const layerGain = Math.pow(10, (-(1 - pos) * (p.layerRangeDb ?? 6)) / 20);

    // Velocity-dependent brightness; key-tracked so high notes are not dulled.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.value = 0.5;
    const bright = p.brightness ?? 0.5;
    filter.frequency.value = clamp(
      (1500 + 12000 * bright * (0.3 + 0.7 * (velocity / 127))) * Math.pow(2, (note - 60) / 36),
      400,
      20000,
    );

    const amp = ctx.createGain();
    const peak = layerGain * (p.gain ?? 1);
    startAdsr(amp.gain, t, { a: 0.0015, d: 0, s: 1 }, peak);
    src.connect(filter).connect(amp).connect(this.voiceBus);
    src.start(t);

    let endedFn = null;
    src.onended = () => {
      amp.disconnect();
      endedFn?.();
    };
    const release = p.release ?? manifest.envelope?.release ?? 0.35;

    return {
      release(time) {
        // Notes above the damper range (F6 up on a real piano) ring on.
        const r = note >= 90 ? Math.max(release, 1.5) : release;
        const end = releaseParam(amp.gain, time, r);
        try {
          src.stop(end);
        } catch {
          /* already ended */
        }
        return end;
      },
      kill(time) {
        try {
          src.stop(killParam(amp.gain, time));
        } catch {
          /* already ended */
        }
      },
      setDetune(cents, time) {
        holdAt(src.detune, time);
        src.detune.setTargetAtTime(cents, time, 0.005);
      },
      onEnded(fn) {
        endedFn = fn;
      },
    };
  }
}
