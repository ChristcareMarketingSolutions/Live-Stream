import { clamp } from '../core/math.js';

/**
 * Pure: which layers of the active patch play a note-on, and at which pitch
 * (LIVE-010, LIVE-020). Channel 0 on a layer = omni.
 *
 * @param {Array<any>} layers
 * @param {{ note: number, velocity: number, channel: number }} ev
 * @returns {Array<{ layer: any, playedNote: number }>}
 */
export function routeNoteOn(layers, ev) {
  const anySolo = layers.some((l) => l.solo);
  const out = [];
  for (const layer of layers) {
    if (layer.mute || (anySolo && !layer.solo)) continue;
    if (!acceptsChannel(layer, ev.channel)) continue;
    const zone = layer.zone ?? { low: 0, high: 127 };
    if (ev.note < zone.low || ev.note > zone.high) continue;
    const vel = layer.velocity ?? { low: 1, high: 127 };
    if (ev.velocity < vel.low || ev.velocity > vel.high) continue;
    const played = ev.note + (layer.transpose ?? 0) + 12 * (layer.octave ?? 0);
    if (played < 0 || played > 127) continue;
    out.push({ layer, playedNote: clamp(played, 0, 127) });
  }
  return out;
}

export const acceptsChannel = (layer, channel) => !layer.channel || layer.channel === channel;

/** Key for the held-note table (docs/02 §5). */
export const heldKey = (sourceId, channel, note) => `${sourceId}:${channel}:${note}`;
