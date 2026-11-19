import meterUrl from './worklets/meter-processor.js?url';
import { dbToGain } from '../core/math.js';
import { smoothSet } from './envelope.js';

/**
 * Master output (AUD-003, AUD-004):
 *   input → master gain → limiter → safety clipper → meter (worklet) → destination
 * The limiter is a fast DynamicsCompressorNode. It is not instantaneous, so a
 * soft clipper after it guarantees the output never exceeds -0.2 dBFS (ADR-0007).
 * If AudioWorklet is unavailable the meter falls back to an AnalyserNode
 * polled on animation frames.
 *
 * @param {BaseAudioContext} ctx
 * @param {{ volumeDb?: number, limiter?: boolean, onPeaks?: (peaks: number[]) => void }} opts
 */
export async function createMasterBus(ctx, { volumeDb = -6, limiter = true, onPeaks } = {}) {
  const input = ctx.createGain();
  const gain = ctx.createGain();
  gain.gain.value = dbToGain(volumeDb);

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -2;
  comp.knee.value = 0;
  comp.ratio.value = 20;
  comp.attack.value = 0.002;
  comp.release.value = 0.08;

  const clipper = ctx.createWaveShaper();
  clipper.curve = softClipCurve();
  clipper.oversample = 'none'; // oversampling filters can overshoot the ceiling

  let meter;
  let analysers = null;
  try {
    await ctx.audioWorklet.addModule(meterUrl);
    meter = new AudioWorkletNode(ctx, 'stagecraft-meter', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [2],
    });
    if (onPeaks) meter.port.onmessage = (e) => onPeaks(e.data);
  } catch (err) {
    console.warn('Meter worklet unavailable, using analyser fallback', err);
    meter = ctx.createGain();
    analysers = createAnalyserMeter(ctx, meter);
  }

  input.connect(gain);
  let limiterOn = limiter;
  wire();
  meter.connect(ctx.destination);

  function wire() {
    gain.disconnect();
    comp.disconnect();
    clipper.disconnect();
    if (limiterOn) {
      gain.connect(comp);
      comp.connect(clipper);
      clipper.connect(meter);
    } else {
      gain.connect(meter);
    }
  }

  return {
    input,
    setVolumeDb(db) {
      smoothSet(gain.gain, dbToGain(db), ctx);
    },
    setLimiter(on) {
      if (on === limiterOn) return;
      limiterOn = on;
      wire();
    },
    /** For the analyser fallback only: read peaks (call from rAF). */
    readPeaks: analysers ? analysers.read : null,
    get limiterReduction() {
      return comp.reduction;
    },
  };
}

function createAnalyserMeter(ctx, node) {
  const splitter = ctx.createChannelSplitter(2);
  const a = [ctx.createAnalyser(), ctx.createAnalyser()];
  node.connect(splitter);
  const bufs = a.map((an, i) => {
    an.fftSize = 1024;
    splitter.connect(an, i);
    return new Float32Array(an.fftSize);
  });
  return {
    read() {
      return a.map((an, i) => {
        an.getFloatTimeDomainData(bufs[i]);
        let p = 0;
        for (const s of bufs[i]) p = Math.max(p, Math.abs(s));
        return p;
      });
    },
  };
}

/**
 * Transfer curve: linear up to `knee`, then a tanh shoulder that approaches
 * `ceiling`. Inputs beyond ±1 are clamped by the WaveShaper to the curve ends,
 * so the output is bounded by `ceiling` whatever comes in.
 */
export function softClipCurve(size = 4096, knee = 0.8, ceiling = 0.977) {
  const curve = new Float32Array(size);
  const range = ceiling - knee;
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + range * Math.tanh((a - knee) / range);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}
