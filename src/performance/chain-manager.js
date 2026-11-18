import { createInstrument } from '../instruments/registry.js';
import { createChannelStrip } from '../audio/channel-strip.js';

/**
 * Builds and caches one audio chain (instrument → channel strip) per layer
 * (docs/02 §6). Chains for the active patch are connected; chains of other
 * patches are disconnected once they fall silent, but kept so switching
 * back is instant. Sample data is shared through the pack store, so a chain
 * is cheap: a handful of nodes.
 */
export function createChainManager({ engine, packStore, onNeedsPack }) {
  /** layerId → { chain, signature } */
  const chains = new Map();
  let activeIds = new Set();

  const signature = (layer) => `${layer.instrument.id}|${layer.instrument.presetId}`;

  function build(layer) {
    const ctx = engine.ctx;
    const instrument = createInstrument(ctx, layer.instrument.id, layer.instrument.presetId, {
      packStore,
    });
    const strip = createChannelStrip(ctx, {
      destination: engine.master.input,
      reverbIn: engine.fx.reverbIn,
      delayIn: engine.fx.delayIn,
    });
    instrument.output.connect(strip.input);
    strip.apply(layer);
    if (!instrument.isLoaded) onNeedsPack?.(layer.instrument.id);
    return { instrument, strip, layerId: layer.id };
  }

  /** Chain for a layer, creating or rebuilding it if the instrument/preset changed. */
  function get(layer) {
    // The context exists a moment before the master bus is built; wait for both.
    if (!engine.ctx || !engine.master || !engine.fx) return null;
    const sig = signature(layer);
    let rec = chains.get(layer.id);
    if (rec && rec.signature !== sig) {
      // Instrument changed: let the old chain ring out, then dispose it.
      const old = rec.chain;
      old.instrument.allNotesOff();
      setTimeout(() => {
        old.instrument.dispose();
        old.strip.dispose();
      }, 3000);
      rec = null;
    }
    if (!rec) {
      rec = { chain: build(layer), signature: sig };
      chains.set(layer.id, rec);
    }
    return rec.chain;
  }

  /** Activate a patch's layers: connect their strips and apply parameters. */
  function activate(layers) {
    activeIds = new Set(layers.map((l) => l.id));
    for (const layer of layers) {
      const chain = get(layer);
      if (!chain) continue;
      chain.strip.apply(layer);
      chain.strip.connect();
    }
  }

  /** Disconnect inactive chains that are silent (call periodically). */
  function sweep(inUse) {
    for (const [id, { chain }] of chains) {
      if (activeIds.has(id) || inUse.has(chain)) continue;
      if (chain.instrument.activeVoiceCount === 0) chain.strip.disconnect();
    }
  }

  /** Remove chains for layers that no longer exist in the concert. */
  function prune(existingLayerIds) {
    for (const [id, { chain }] of chains) {
      if (existingLayerIds.has(id)) continue;
      chain.instrument.dispose();
      chain.strip.dispose();
      chains.delete(id);
    }
  }

  return {
    get,
    activate,
    sweep,
    prune,
    /** Update live parameters (volume, pan, sends, mute) without rebuilding. */
    applyParams(layer) {
      const rec = chains.get(layer.id);
      if (rec && rec.signature === signature(layer)) rec.chain.strip.apply(layer);
    },
    all: () => [...chains.values()].map((r) => r.chain),
    voiceCount: () =>
      [...chains.values()].reduce((n, r) => n + r.chain.instrument.activeVoiceCount, 0),
  };
}
