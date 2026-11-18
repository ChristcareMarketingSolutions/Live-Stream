import { Instrument } from './instrument.js';
import { startAdsr, releaseParam, killParam, holdAt } from '../audio/envelope.js';
import { midiToFreq, velocityToGain, clamp } from '../core/math.js';
import { createEffectChain } from '../audio/effects.js';

/**
 * Preset-driven polyphonic synthesiser used by every synthesised instrument.
 *
 * Preset shape (all optional except oscillators/amp):
 * {
 *   oscillators: [{ type: 'sine'|'sawtooth'|'square'|'triangle'|'noise',
 *                   harmonics?: number[]   // custom PeriodicWave amplitudes (index 1 = fundamental)
 *                   ratio?: number, detune?: number, gain?: number,
 *                   env?: { a, d, s }       // own envelope (e.g. organ percussion)
 *                   fm?: { ratio, index, decay, sustain } }],
 *   filter?: { type, freq, q, envAmount, keyTrack, velAmount, env: {a,d,s,r} },
 *   formants?: [{ freq, q, gain }],         // parallel band-pass bank (choir)
 *   amp: { a, d, s, r }, gain, velSens,
 *   lfo?: { rate, depth (cents at full mod wheel), base (cents without wheel) },
 *   effects?: [{ type: 'tremolo'|'chorus'|'rotary', ...params }],
 *   modWheel?: 'vibrato'|'rotary'|'none'
 * }
 */
export class PolySynth extends Instrument {
  constructor(ctx, preset, opts) {
    super(ctx, opts);
    this.preset = preset;
    this.waves = new Map();
    this.voiceBus = ctx.createGain();
    this.chain = createEffectChain(ctx, preset.effects ?? []);
    this.voiceBus.connect(this.chain.input);
    this.chain.output.connect(this.output);

    // Shared vibrato LFO: feeds every oscillator's detune.
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = preset.lfo?.rate ?? 5.5;
    this.lfoDepth = ctx.createGain();
    this.lfoDepth.gain.value = preset.lfo?.base ?? 0;
    this.lfo.connect(this.lfoDepth);
    this.lfo.start();
  }

  onModWheel(value, time) {
    const mode = this.preset.modWheel ?? 'vibrato';
    if (mode === 'vibrato') {
      const base = this.preset.lfo?.base ?? 0;
      const depth = this.preset.lfo?.depth ?? 25;
      holdAt(this.lfoDepth.gain, time);
      this.lfoDepth.gain.setTargetAtTime(base + depth * value, time, 0.03);
    }
    this.chain.onModWheel(value, time);
  }

  #wave(harmonics) {
    const key = harmonics.join(',');
    if (!this.waves.has(key)) {
      const real = new Float32Array(harmonics.length);
      const imag = Float32Array.from(harmonics);
      this.waves.set(key, this.ctx.createPeriodicWave(real, imag));
    }
    return this.waves.get(key);
  }

  createVoice(note, velocity, t) {
    const ctx = this.ctx;
    const p = this.preset;
    const f0 = midiToFreq(note);
    const sources = [];
    const detuneParams = [];
    const mix = ctx.createGain();
    const oscs = p.oscillators;
    const totalGain = oscs.reduce((s, o) => s + (o.gain ?? 1), 0) || 1;
    mix.gain.value = 1 / totalGain;

    for (const spec of oscs) {
      const g = ctx.createGain();
      g.gain.value = spec.gain ?? 1;
      let src;
      if (spec.type === 'noise') {
        src = ctx.createBufferSource();
        src.buffer = noiseBuffer(ctx);
        src.loop = true;
      } else {
        src = ctx.createOscillator();
        if (spec.harmonics) src.setPeriodicWave(this.#wave(spec.harmonics));
        else src.type = spec.type ?? 'sawtooth';
        src.frequency.value = f0 * (spec.ratio ?? 1);
        src.detune.value = spec.detune ?? 0;
        this.lfoDepth.connect(src.detune);
        detuneParams.push({ param: src.detune, offset: spec.detune ?? 0 });

        if (spec.fm) {
          const mod = ctx.createOscillator();
          mod.frequency.value = f0 * spec.fm.ratio;
          const modGain = ctx.createGain();
          const depth = spec.fm.index * f0 * (0.4 + 0.6 * (velocity / 127));
          modGain.gain.setValueAtTime(depth, t);
          modGain.gain.setTargetAtTime(depth * (spec.fm.sustain ?? 0), t, spec.fm.decay / 4);
          mod.connect(modGain).connect(src.frequency);
          detuneParams.push({ param: mod.detune, offset: 0 });
          sources.push(mod);
        }
      }
      if (spec.env) startAdsr(g.gain, t, spec.env, spec.gain ?? 1);
      src.connect(g).connect(mix);
      sources.push(src);
    }

    let last = mix;
    let filter = null;
    if (p.formants) {
      const sum = ctx.createGain();
      for (const fm of p.formants) {
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = fm.freq;
        bp.Q.value = fm.q;
        const fg = ctx.createGain();
        fg.gain.value = fm.gain;
        mix.connect(bp).connect(fg).connect(sum);
      }
      last = sum;
    }
    if (p.filter) {
      const fp = p.filter;
      filter = ctx.createBiquadFilter();
      filter.type = fp.type ?? 'lowpass';
      filter.Q.value = fp.q ?? 0.7;
      const keyFactor = Math.pow(f0 / 261.63, fp.keyTrack ?? 0.5);
      const velFactor = 1 + (fp.velAmount ?? 0.5) * (velocity / 127 - 0.6);
      const base = clamp(fp.freq * keyFactor * velFactor, 40, 18000);
      if (fp.env && fp.envAmount) {
        const peak = clamp(base * (1 + fp.envAmount), 40, 18000);
        filter.frequency.setValueAtTime(base, t);
        filter.frequency.exponentialRampToValueAtTime(peak, t + Math.max(0.003, fp.env.a));
        filter.frequency.setTargetAtTime(
          base + (peak - base) * (fp.env.s ?? 0),
          t + Math.max(0.003, fp.env.a),
          Math.max(0.005, fp.env.d / 4),
        );
      } else {
        filter.frequency.value = base;
      }
      filter.userData = { base, release: fp.env?.r ?? p.amp.r };
      last.connect(filter);
      last = filter;
    }

    const amp = ctx.createGain();
    const peak = velocityToGain(velocity, p.velSens ?? 0.7) * (p.gain ?? 0.3);
    startAdsr(amp.gain, t, p.amp, peak);
    last.connect(amp).connect(this.voiceBus);
    for (const s of sources) s.start(t);

    const lfoDepth = this.lfoDepth;
    let endedFn = null;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      for (const d of detuneParams) {
        try {
          lfoDepth.disconnect(d.param);
        } catch {
          /* not connected (FM modulator) */
        }
      }
      amp.disconnect();
      endedFn?.();
    };
    sources[0].onended = cleanup;
    const stopAll = (when) => {
      for (const s of sources) {
        try {
          s.stop(when);
        } catch {
          /* already stopped */
        }
      }
    };

    return {
      release(time) {
        const end = releaseParam(amp.gain, time, p.amp.r);
        if (filter) {
          holdAt(filter.frequency, time);
          filter.frequency.setTargetAtTime(
            filter.userData.base,
            time,
            Math.max(0.01, filter.userData.release / 5),
          );
        }
        stopAll(end);
        return end;
      },
      kill(time) {
        stopAll(killParam(amp.gain, time));
      },
      setDetune(cents, time) {
        for (const d of detuneParams) {
          holdAt(d.param, time);
          d.param.setTargetAtTime(cents + d.offset, time, 0.005);
        }
      },
      onEnded(fn) {
        endedFn = fn;
      },
    };
  }

  dispose() {
    super.dispose();
    setTimeout(() => {
      this.lfo.stop();
      this.chain.dispose();
    }, 60);
  }
}

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  if (!noiseCache.has(ctx)) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 16807) % 2147483647;
      d[i] = seed / 1073741823.5 - 1;
    }
    noiseCache.set(ctx, buf);
  }
  return noiseCache.get(ctx);
}
