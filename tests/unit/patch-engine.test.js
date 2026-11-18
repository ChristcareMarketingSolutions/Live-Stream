import { describe, it, expect, beforeEach } from 'vitest';
import { createPatchEngine } from '../../src/performance/patch-engine.js';
import { defaultLayer } from '../../src/performance/concert-model.js';
import { parseMidi, msg } from '../../src/midi/midi-parser.js';

/** Fake instrument that tracks voices exactly like the real base class contract. */
function fakeInstrument() {
  let id = 0;
  const inst = {
    voices: new Map(),
    started: [],
    bend: 0,
    mod: 0,
    noteOn(note, velocity) {
      const h = { id: ++id, note, velocity, state: 'held' };
      inst.voices.set(h.id, h);
      inst.started.push(h);
      return h;
    },
    noteOff(h) {
      if (!h || !inst.voices.has(h.id)) return;
      h.state = 'released';
      inst.voices.delete(h.id);
    },
    markSustained(h) {
      h.state = 'sustained';
    },
    allNotesOff() {
      inst.voices.clear();
    },
    setPitchBend(s) {
      inst.bend = s;
    },
    setModWheel(v) {
      inst.mod = v;
    },
    get activeVoiceCount() {
      return inst.voices.size;
    },
  };
  return inst;
}

function setup() {
  const chains = new Map();
  const programs = [];
  const getChain = (layer) => {
    if (!chains.has(layer.id)) {
      chains.set(layer.id, {
        instrument: fakeInstrument(),
        strip: {
          exp: 1,
          setExpression(v) {
            this.exp = v;
          },
        },
      });
    }
    return chains.get(layer.id);
  };
  const engine = createPatchEngine({
    getChain,
    allChains: () => chains.values(),
    onProgramChange: (p) => programs.push(p),
  });
  const send = (bytes, source = 'kbd') => engine.handle(parseMidi(bytes, source));
  const voices = () => [...chains.values()].reduce((n, c) => n + c.instrument.activeVoiceCount, 0);
  return { engine, chains, send, voices, programs, getChain };
}

describe('patch engine [LIVE-031, MIDI-002, MIDI-004, T-202, T-203, T-402, T-403]', () => {
  let t;
  const piano = defaultLayer({ id: 'piano' });
  const pad = defaultLayer({ id: 'pad' });
  const organ = defaultLayer({ id: 'organ' });

  beforeEach(() => {
    t = setup();
    t.engine.setLayers([piano, pad]);
  });

  it('plays all layers and releases them on note-off', () => {
    t.send(msg.noteOn(60));
    expect(t.voices()).toBe(2);
    t.send(msg.noteOff(60));
    expect(t.voices()).toBe(0);
  });

  it('note held through a patch switch is released on the old patch', () => {
    t.send(msg.noteOn(60));
    t.engine.setLayers([organ]);
    t.send(msg.noteOn(64));
    expect(t.chains.get('organ').instrument.activeVoiceCount).toBe(1);
    t.send(msg.noteOff(60));
    expect(t.chains.get('piano').instrument.activeVoiceCount).toBe(0);
    expect(t.chains.get('pad').instrument.activeVoiceCount).toBe(0);
    expect(t.chains.get('organ').instrument.activeVoiceCount).toBe(1);
    t.send(msg.noteOff(64));
    expect(t.voices()).toBe(0);
  });

  it('note held through a transpose change releases the originally played pitch', () => {
    const l = defaultLayer({ id: 'tp', transpose: 0 });
    t.engine.setLayers([l]);
    t.send(msg.noteOn(60));
    t.engine.setLayers([{ ...l, transpose: 5 }]);
    t.send(msg.noteOff(60));
    expect(t.voices()).toBe(0);
  });

  it('sustain pedal holds notes until pedal up', () => {
    t.send(msg.cc(64, 127));
    t.send(msg.noteOn(60));
    t.send(msg.noteOff(60));
    expect(t.voices()).toBe(2);
    expect(t.engine.sustainedCount).toBe(2);
    t.send(msg.cc(64, 0));
    expect(t.voices()).toBe(0);
  });

  it('switching patch with the pedal down keeps old notes sustained until pedal up', () => {
    t.send(msg.cc(64, 127));
    t.send(msg.noteOn(60));
    t.send(msg.noteOff(60));
    t.engine.setLayers([organ]);
    expect(t.voices()).toBe(2);
    t.send(msg.cc(64, 0));
    expect(t.voices()).toBe(0);
  });

  it('layers that ignore sustain release immediately', () => {
    t.engine.setLayers([piano, defaultLayer({ id: 'nosus', respond: { sustain: false } })]);
    t.send(msg.cc(64, 127));
    t.send(msg.noteOn(60));
    t.send(msg.noteOff(60));
    expect(t.chains.get('nosus').instrument.activeVoiceCount).toBe(0);
    expect(t.chains.get('piano').instrument.activeVoiceCount).toBe(1);
  });

  it('re-striking a sustained note releases the previous voice', () => {
    t.engine.setLayers([piano]);
    t.send(msg.cc(64, 127));
    t.send(msg.noteOn(60));
    t.send(msg.noteOff(60));
    t.send(msg.noteOn(60));
    expect(t.chains.get('piano').instrument.activeVoiceCount).toBe(1);
  });

  it('note-on twice without note-off does not orphan a voice', () => {
    t.engine.setLayers([piano]);
    t.send(msg.noteOn(60));
    t.send(msg.noteOn(60));
    t.send(msg.noteOff(60));
    expect(t.voices()).toBe(0);
  });

  it('two sources playing the same note are independent', () => {
    t.engine.setLayers([piano]);
    t.send(msg.noteOn(60), 'a');
    t.send(msg.noteOn(60), 'b');
    t.send(msg.noteOff(60), 'a');
    expect(t.voices()).toBe(1);
    t.send(msg.noteOff(60), 'b');
    expect(t.voices()).toBe(0);
  });

  it('device disconnect releases its notes and its pedal', () => {
    t.send(msg.cc(64, 127), 'a');
    t.send(msg.noteOn(60), 'a');
    t.send(msg.noteOn(62), 'a');
    t.send(msg.noteOff(62), 'a'); // sustained
    t.send(msg.noteOn(70), 'b');
    t.engine.releaseSource('a');
    expect(t.chains.get('piano').instrument.activeVoiceCount).toBe(1); // only b's note
    expect(t.engine.activeNotes().has(60)).toBe(false);
    expect(t.engine.activeNotes().get(70)).toBe(1);
  });

  it('pedal held by one source keeps notes until every source releases it', () => {
    t.engine.setLayers([piano]);
    t.send(msg.cc(64, 127), 'a');
    t.send(msg.cc(64, 127), 'b');
    t.send(msg.noteOn(60), 'a');
    t.send(msg.noteOff(60), 'a');
    t.send(msg.cc(64, 0), 'a');
    expect(t.voices()).toBe(1);
    t.send(msg.cc(64, 0), 'b');
    expect(t.voices()).toBe(0);
  });

  it('panic silences everything and clears state', () => {
    t.send(msg.cc(64, 127));
    t.send(msg.noteOn(60));
    t.send(msg.noteOn(64));
    t.engine.panic();
    expect(t.voices()).toBe(0);
    expect(t.engine.heldCount).toBe(0);
    expect(t.engine.activeNotes().size).toBe(0);
    t.send(msg.noteOn(60));
    t.send(msg.noteOff(60));
    expect(t.voices()).toBe(0); // pedal state was cleared too
  });

  it('applies pitch bend with the layer bend range, and mod wheel', () => {
    t.engine.setLayers([defaultLayer({ id: 'b', respond: { bendRange: 12 } })]);
    t.send(msg.bend(16383));
    expect(t.chains.get('b').instrument.bend).toBe(12);
    t.send(msg.cc(1, 127));
    expect(t.chains.get('b').instrument.mod).toBe(1);
  });

  it('carries controller positions to a newly activated patch', () => {
    t.send(msg.cc(1, 127));
    t.engine.setLayers([organ]);
    expect(t.chains.get('organ').instrument.mod).toBe(1);
  });

  it('expression and volume multiply into the strip expression', () => {
    t.send(msg.cc(11, 64));
    expect(t.chains.get('piano').strip.exp).toBeCloseTo(64 / 127);
    t.send(msg.cc(7, 0));
    expect(t.chains.get('piano').strip.exp).toBe(0);
  });

  it('forwards program changes as 1-128', () => {
    t.send(msg.program(0));
    t.send(msg.program(127));
    expect(t.programs).toEqual([1, 128]);
  });

  it('T-207 fuzz: 10 000 random events leave no voices after all-off', () => {
    let seed = 42;
    const rnd = (n) => {
      seed = (seed * 16807) % 2147483647;
      return seed % n;
    };
    const patches = [
      [piano, pad],
      [organ],
      [defaultLayer({ id: 'x', transpose: 7, zone: { low: 40, high: 80 } })],
    ];
    const sources = ['a', 'b', 'qwerty'];
    for (let i = 0; i < 10000; i++) {
      const r = rnd(100);
      const src = sources[rnd(3)];
      const note = 30 + rnd(60);
      if (r < 40) t.send(msg.noteOn(note, 1 + rnd(127)), src);
      else if (r < 80) t.send(msg.noteOff(note), src);
      else if (r < 88) t.send(msg.cc(64, rnd(2) ? 127 : 0), src);
      else if (r < 93) t.engine.setLayers(patches[rnd(3)]);
      else if (r < 95) t.engine.releaseSource(src);
      else t.send(msg.bend(rnd(16384)), src);
    }
    // Release everything properly: every key off from every source, pedals up.
    for (const src of sources) {
      for (let n = 0; n < 128; n++) t.send(msg.noteOff(n), src);
      t.send(msg.cc(64, 0), src);
    }
    expect(t.engine.heldCount).toBe(0);
    expect(t.engine.sustainedCount).toBe(0);
    expect(t.voices()).toBe(0);
    expect(t.engine.activeNotes().size).toBe(0);
  });
});
