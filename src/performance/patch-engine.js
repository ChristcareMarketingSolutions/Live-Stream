import { routeNoteOn, acceptsChannel, heldKey } from './note-router.js';
import { CC } from '../midi/midi-parser.js';

/**
 * Turns MIDI events into instrument voices for the active patch
 * (LIVE-030/031, MIDI-004/005, ADR-0004).
 *
 * Every sounding voice is recorded in the held-note table, keyed by
 * source:channel:note, so note-offs, pedal-ups, disconnects and panic release
 * exactly the voices that were started, whatever the current patch, zones or
 * transpose are by then. No audio or DOM code here: chains are injected.
 *
 * @typedef {{ instrument: any, strip: any }} Chain
 * @param {{
 *   getChain: (layer: any) => Chain | null,
 *   allChains: () => Iterable<Chain>,
 *   onProgramChange?: (program1to128: number) => void,
 *   onActiveNotesChanged?: (notes: Map<number, number>) => void,
 *   onPanic?: () => void,
 * }} deps
 */
export function createPatchEngine(deps) {
  /** @type {any[]} */
  let layers = [];
  /** key → [{ chain, handle, layer, playedNote }] */
  const held = new Map();
  /** chain → Set<{ handle, channel, playedNote }> */
  const sustained = new Map();
  /** channel → Set<sourceId> currently holding the pedal down */
  const pedal = new Map();
  /** per-channel controller state */
  const ctl = new Map();
  /** input note → number of sources holding it (for the keyboard display) */
  const activeNotes = new Map();

  const ctlFor = (ch) => {
    if (!ctl.has(ch)) ctl.set(ch, { bend: 0, mod: 0, volume: 1, expression: 1 });
    return ctl.get(ch);
  };
  const pedalDown = (ch) => (pedal.get(ch)?.size ?? 0) > 0;

  function notesChanged() {
    deps.onActiveNotesChanged?.(activeNotes);
  }

  function bumpActive(note, delta) {
    const n = (activeNotes.get(note) ?? 0) + delta;
    if (n <= 0) activeNotes.delete(note);
    else activeNotes.set(note, n);
  }

  function releaseEntry(entry) {
    entry.chain.instrument.noteOff(entry.handle);
  }

  function releaseSustained(filter) {
    for (const [chain, set] of sustained) {
      for (const s of [...set]) {
        if (filter(s)) {
          chain.instrument.noteOff(s.handle);
          set.delete(s);
        }
      }
      if (set.size === 0) sustained.delete(chain);
    }
  }

  function noteOn(ev) {
    const key = heldKey(ev.sourceId, ev.channel, ev.note);
    if (held.has(key)) noteOff({ ...ev, type: 'noteoff' }, true); // retrigger without note-off

    const entries = [];
    for (const { layer, playedNote } of routeNoteOn(layers, ev)) {
      const chain = deps.getChain(layer);
      if (!chain) continue;
      // Re-striking a sustained note releases the old voice (piano behaviour).
      const set = sustained.get(chain);
      if (set) {
        for (const s of [...set]) {
          if (s.playedNote === playedNote) {
            chain.instrument.noteOff(s.handle);
            set.delete(s);
          }
        }
      }
      const handle = chain.instrument.noteOn(playedNote, ev.velocity);
      if (handle) entries.push({ chain, handle, layer, playedNote });
    }
    held.set(key, entries);
    bumpActive(ev.note, 1);
    notesChanged();
  }

  function noteOff(ev, silent = false) {
    const key = heldKey(ev.sourceId, ev.channel, ev.note);
    const entries = held.get(key);
    if (!entries) return;
    held.delete(key);
    for (const e of entries) {
      const usesPedal = e.layer.respond?.sustain !== false && acceptsChannel(e.layer, ev.channel);
      if (usesPedal && pedalDown(ev.channel)) {
        e.chain.instrument.markSustained(e.handle);
        if (!sustained.has(e.chain)) sustained.set(e.chain, new Set());
        sustained
          .get(e.chain)
          .add({ handle: e.handle, channel: ev.channel, playedNote: e.playedNote });
      } else {
        releaseEntry(e);
      }
    }
    bumpActive(ev.note, -1);
    if (!silent) notesChanged();
  }

  function setPedal(ev, down) {
    if (!pedal.has(ev.channel)) pedal.set(ev.channel, new Set());
    const set = pedal.get(ev.channel);
    if (down) set.add(ev.sourceId);
    else set.delete(ev.sourceId);
    if (set.size === 0) releaseSustained((s) => s.channel === ev.channel);
  }

  /** Chains that should follow live controllers: active layers plus anything still sounding. */
  function liveChains(channel) {
    const out = new Map();
    for (const layer of layers) {
      if (!acceptsChannel(layer, channel)) continue;
      const chain = deps.getChain(layer);
      if (chain) out.set(chain, layer);
    }
    for (const entries of held.values()) {
      for (const e of entries) if (!out.has(e.chain)) out.set(e.chain, e.layer);
    }
    for (const chain of sustained.keys()) if (!out.has(chain)) out.set(chain, null);
    return out;
  }

  function applyControllers(channel) {
    const c = ctlFor(channel);
    for (const [chain, layer] of liveChains(channel)) {
      const r = layer?.respond ?? {};
      if (r.pitchBend !== false) chain.instrument.setPitchBend(c.bend * (r.bendRange ?? 2));
      if (r.modWheel !== false) chain.instrument.setModWheel(c.mod);
      if (r.expression !== false) chain.strip?.setExpression(c.volume * c.expression);
    }
  }

  function cc(ev) {
    const c = ctlFor(ev.channel);
    switch (ev.controller) {
      case CC.SUSTAIN:
        setPedal(ev, ev.value >= 64);
        return;
      case CC.MOD:
        c.mod = ev.value / 127;
        break;
      case CC.VOLUME:
        c.volume = ev.value / 127;
        break;
      case CC.EXPRESSION:
        c.expression = ev.value / 127;
        break;
      case CC.ALL_SOUND_OFF:
      case CC.ALL_NOTES_OFF:
        releaseSource(ev.sourceId);
        return;
      default:
        return;
    }
    applyControllers(ev.channel);
  }

  /** Release every note and pedal held by one source (device unplugged, MIDI-002). */
  function releaseSource(sourceId) {
    const prefix = `${sourceId}:`;
    for (const [key, entries] of [...held]) {
      if (!key.startsWith(prefix)) continue;
      held.delete(key);
      entries.forEach(releaseEntry);
      bumpActive(Number(key.split(':').pop()), -1);
    }
    for (const [ch, set] of pedal) {
      if (set.delete(sourceId) && set.size === 0) releaseSustained((s) => s.channel === ch);
    }
    notesChanged();
  }

  /** Stop everything immediately (AUD-006). */
  function panic() {
    held.clear();
    sustained.clear();
    pedal.clear();
    activeNotes.clear();
    for (const chain of deps.allChains()) chain.instrument.allNotesOff(undefined, true);
    for (const ch of ctl.keys()) ctl.set(ch, { bend: 0, mod: 0, volume: 1, expression: 1 });
    deps.onPanic?.();
    notesChanged();
  }

  return {
    /** @param {import('../midi/midi-parser.js').MidiEvent} ev */
    handle(ev) {
      switch (ev.type) {
        case 'noteon':
          return noteOn(ev);
        case 'noteoff':
          return noteOff(ev);
        case 'cc':
          return cc(ev);
        case 'pitchbend':
          ctlFor(ev.channel).bend = ev.bend;
          return applyControllers(ev.channel);
        case 'program':
          return deps.onProgramChange?.(ev.program + 1);
        default:
          return undefined;
      }
    },
    /**
     * Make `nextLayers` receive new notes. Sounding notes stay with the
     * voices that started them (LIVE-031). Current controller positions are
     * applied to the new layers so a held mod wheel or expression carries over.
     */
    setLayers(nextLayers) {
      layers = nextLayers ?? [];
      for (const ch of ctl.keys()) applyControllers(ch);
    },
    releaseSource,
    panic,
    get layers() {
      return layers;
    },
    get heldCount() {
      return held.size;
    },
    get sustainedCount() {
      let n = 0;
      for (const s of sustained.values()) n += s.size;
      return n;
    },
    /** Chains still producing sound from earlier note-ons (for idle teardown). */
    chainsInUse() {
      const used = new Set(sustained.keys());
      for (const entries of held.values()) for (const e of entries) used.add(e.chain);
      return used;
    },
    activeNotes: () => new Map(activeNotes),
  };
}
