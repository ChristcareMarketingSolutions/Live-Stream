import { dbToGain, clamp } from '../core/math.js';
import { smoothSet } from './envelope.js';

/**
 * Per-layer channel strip (LIVE-010, LIVE-011, MIX-005):
 *   input → expression → volume (mute) → pan → destination
 *                                       └→ reverb send / delay send (post-fader)
 */
export function createChannelStrip(ctx, { destination, reverbIn, delayIn }) {
  const input = ctx.createGain();
  const expression = ctx.createGain();
  const volume = ctx.createGain();
  const pan = ctx.createStereoPanner();
  const reverbSend = ctx.createGain();
  const delaySend = ctx.createGain();
  reverbSend.gain.value = 0;
  delaySend.gain.value = 0;

  input.connect(expression).connect(volume).connect(pan);
  pan.connect(reverbSend);
  pan.connect(delaySend);

  let connected = false;
  function connect() {
    if (connected) return;
    pan.connect(destination);
    reverbSend.connect(reverbIn);
    delaySend.connect(delayIn);
    connected = true;
  }
  function disconnect() {
    if (!connected) return;
    pan.disconnect(destination);
    reverbSend.disconnect();
    delaySend.disconnect();
    connected = false;
  }

  return {
    input,
    connect,
    disconnect,
    get connected() {
      return connected;
    },
    /** @param {{ volumeDb: number, pan: number, mute: boolean, sends: {reverb: number, delay: number} }} layer */
    apply(layer) {
      smoothSet(volume.gain, layer.mute ? 0 : dbToGain(layer.volumeDb ?? 0), ctx);
      smoothSet(pan.pan, clamp(layer.pan ?? 0, -1, 1), ctx);
      smoothSet(reverbSend.gain, dbToGain(layer.sends?.reverb ?? -60), ctx);
      smoothSet(delaySend.gain, dbToGain(layer.sends?.delay ?? -60), ctx);
    },
    /** Expression pedal / CC11, 0..1 (smoothed 10 ms, docs/04 §6). */
    setExpression(value01) {
      smoothSet(expression.gain, clamp(value01, 0, 1), ctx, 0.01);
    },
    dispose() {
      disconnect();
      input.disconnect();
    },
  };
}
