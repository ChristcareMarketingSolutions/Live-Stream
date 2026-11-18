import { PolySynth } from './poly-synth.js';
import { Sampler } from './sampler.js';
import { PRESETS } from './presets.js';
import { LEVEL_TRIM_DB } from './levels.js';

/**
 * Instrument catalogue (INS-002..009). `engine: 'sampler'` instruments need
 * their pack loaded; synths are ready immediately.
 */
const SAMPLER_PRESETS = {
  'grand-piano': {
    concert: { name: 'Concert Grand', brightness: 0.55, release: 0.35, gain: 0.9 },
    bright: { name: 'Bright Grand', brightness: 0.95, release: 0.3, gain: 0.85 },
    mellow: { name: 'Mellow Grand', brightness: 0.2, release: 0.45, gain: 1.0 },
    worship: { name: 'Soft Worship Grand', brightness: 0.35, release: 0.6, gain: 1.0 },
  },
};

export const INSTRUMENTS = [
  {
    id: 'grand-piano',
    name: 'Grand Piano',
    category: 'Keys',
    engine: 'sampler',
    pack: 'grand-piano',
    sizeMb: 7,
  },
  { id: 'electric-piano', name: 'Electric Piano', category: 'Keys', engine: 'synth' },
  { id: 'tonewheel', name: 'Tonewheel Organ', category: 'Organ', engine: 'synth' },
  { id: 'pipe-organ', name: 'Pipe Organ', category: 'Organ', engine: 'synth' },
  { id: 'strings', name: 'Strings', category: 'Orchestral', engine: 'synth' },
  { id: 'choir', name: 'Choir', category: 'Orchestral', engine: 'synth' },
  { id: 'pads', name: 'Ambient Pads', category: 'Pads', engine: 'synth' },
  { id: 'synth-bass', name: 'Synth Bass', category: 'Bass', engine: 'synth' },
  { id: 'analog-synth', name: 'Analog Synth', category: 'Synth', engine: 'synth' },
];

export const getInstrument = (id) => INSTRUMENTS.find((i) => i.id === id) ?? null;

/** @returns {{ id: string, name: string }[]} */
export function presetsFor(instrumentId) {
  const table = SAMPLER_PRESETS[instrumentId] ?? PRESETS[instrumentId] ?? {};
  return Object.entries(table).map(([id, p]) => ({ id, name: p.name }));
}

export function defaultPreset(instrumentId) {
  return presetsFor(instrumentId)[0]?.id ?? null;
}

function presetData(instrumentId, presetId) {
  const table = SAMPLER_PRESETS[instrumentId] ?? PRESETS[instrumentId];
  if (!table) return null;
  const id = table[presetId] ? presetId : Object.keys(table)[0];
  const trim = Math.pow(10, (LEVEL_TRIM_DB[instrumentId]?.[id] ?? 0) / 20);
  return { ...table[id], gain: (table[id].gain ?? 1) * trim };
}

/**
 * Create an instrument instance.
 * @param {BaseAudioContext} ctx
 * @param {string} instrumentId
 * @param {string} presetId
 * @param {{ packStore?: ReturnType<import('../packs/pack-store.js').createPackStore> }} deps
 */
export function createInstrument(ctx, instrumentId, presetId, { packStore } = {}) {
  const meta = getInstrument(instrumentId);
  const preset = presetData(instrumentId, presetId);
  if (!meta || !preset) throw new Error(`Unknown instrument "${instrumentId}"`);
  if (meta.engine === 'sampler') {
    if (!packStore) throw new Error('Sampler instruments need a pack store');
    return new Sampler(ctx, { pack: packStore.get(meta.pack), preset });
  }
  return new PolySynth(ctx, preset);
}
