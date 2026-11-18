import { clamp } from '../core/math.js';
import { holdAt } from './envelope.js';

/**
 * Instrument-level effects (tremolo for electric piano, chorus for strings and
 * pads, rotary speaker for the tonewheel organ). Each effect is
 * { input, output, onModWheel(v, t), set(params), dispose() }.
 */
export function createEffectChain(ctx, specs) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const effects = specs.map((spec) => FACTORIES[spec.type](ctx, spec));
  let node = input;
  for (const fx of effects) {
    node.connect(fx.input);
    node = fx.output;
  }
  node.connect(output);
  return {
    input,
    output,
    effects,
    onModWheel(value, time) {
      for (const fx of effects) fx.onModWheel?.(value, time);
    },
    dispose() {
      for (const fx of effects) fx.dispose();
      input.disconnect();
      output.disconnect();
    },
  };
}

function lfo(ctx, rate, type = 'sine') {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = rate;
  osc.start();
  return osc;
}

/** Amplitude tremolo, optionally stereo auto-pan (classic electric piano). */
function tremolo(ctx, { rate = 4.5, depth = 0.3, stereo = true }) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const osc = lfo(ctx, rate);
  if (stereo) {
    const panner = ctx.createStereoPanner();
    const amount = ctx.createGain();
    amount.gain.value = clamp(depth, 0, 1);
    osc.connect(amount).connect(panner.pan);
    input.connect(panner).connect(output);
  } else {
    const amp = ctx.createGain();
    amp.gain.value = 1 - depth / 2;
    const amount = ctx.createGain();
    amount.gain.value = depth / 2;
    osc.connect(amount).connect(amp.gain);
    input.connect(amp).connect(output);
  }
  return {
    input,
    output,
    dispose() {
      osc.stop();
      input.disconnect();
    },
  };
}

/** Stereo chorus: two modulated delays panned left/right plus the dry signal. */
function chorus(ctx, { rate = 0.6, depth = 0.003, delay = 0.015, mix = 0.5 }) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 1 - mix / 2;
  input.connect(dry).connect(output);
  const oscs = [];
  [-1, 1].forEach((side, i) => {
    const d = ctx.createDelay(0.1);
    d.delayTime.value = delay;
    const osc = lfo(ctx, rate * (i ? 1.13 : 1));
    const amt = ctx.createGain();
    amt.gain.value = depth;
    osc.connect(amt).connect(d.delayTime);
    const pan = ctx.createStereoPanner();
    pan.pan.value = side * 0.8;
    const wet = ctx.createGain();
    wet.gain.value = mix / 2;
    input.connect(d).connect(wet).connect(pan).connect(output);
    oscs.push(osc);
  });
  return {
    input,
    output,
    dispose() {
      oscs.forEach((o) => o.stop());
      input.disconnect();
    },
  };
}

/**
 * Simplified rotary speaker: treble horn and bass drum rotate at different
 * speeds (amplitude + Doppler via modulated delay, stereo spread). Mod wheel
 * above half switches slow ↔ fast with realistic spin-up/down (INS-004).
 */
function rotary(ctx, { slow = 0.8, fast = 6.7, mix = 1, startFast = false }) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 1 - mix;
  input.connect(dry).connect(output);

  const lowXo = ctx.createBiquadFilter();
  lowXo.type = 'lowpass';
  lowXo.frequency.value = 800;
  const highXo = ctx.createBiquadFilter();
  highXo.type = 'highpass';
  highXo.frequency.value = 800;
  input.connect(lowXo);
  input.connect(highXo);

  const rotors = [
    { src: highXo, ratio: 1, ampDepth: 0.35, dopplerDepth: 0.0006 }, // horn
    { src: lowXo, ratio: 0.85, ampDepth: 0.15, dopplerDepth: 0.0002 }, // drum, slower
  ].map(({ src, ratio, ampDepth, dopplerDepth }) => {
    const osc = lfo(ctx, (startFast ? fast : slow) * ratio);
    const delay = ctx.createDelay(0.05);
    delay.delayTime.value = 0.004;
    const dAmt = ctx.createGain();
    dAmt.gain.value = dopplerDepth;
    osc.connect(dAmt).connect(delay.delayTime);
    const amp = ctx.createGain();
    amp.gain.value = 1 - ampDepth;
    const aAmt = ctx.createGain();
    aAmt.gain.value = ampDepth;
    osc.connect(aAmt).connect(amp.gain);
    const pan = ctx.createStereoPanner();
    const pAmt = ctx.createGain();
    pAmt.gain.value = 0.6;
    osc.connect(pAmt).connect(pan.pan);
    const wet = ctx.createGain();
    wet.gain.value = mix;
    src.connect(delay).connect(amp).connect(pan).connect(wet).connect(output);
    return { osc, ratio };
  });

  let isFast = startFast;
  function setSpeed(goFast, time) {
    if (goFast === isFast) return;
    isFast = goFast;
    for (const r of rotors) {
      holdAt(r.osc.frequency, time);
      // Horn spins up faster than the drum (time constants ~0.7 s vs 1.4 s).
      r.osc.frequency.setTargetAtTime(
        (goFast ? fast : slow) * r.ratio,
        time,
        r.ratio === 1 ? 0.7 : 1.4,
      );
    }
  }

  return {
    input,
    output,
    onModWheel(value, time) {
      setSpeed(value >= 0.5, time);
    },
    dispose() {
      rotors.forEach((r) => r.osc.stop());
      input.disconnect();
    },
  };
}

const FACTORIES = { tremolo, chorus, rotary };
