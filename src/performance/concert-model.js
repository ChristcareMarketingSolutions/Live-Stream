import { clamp } from '../core/math.js';

/**
 * Concert document (docs/02 §9): pure functions only. Every edit returns a
 * new concert object (no mutation), so the store can detect changes.
 */

export const CONCERT_FORMAT = 'stagecraft-concert';
export const SCHEMA_VERSION = 1;
export const MAX_LAYERS = 8;

let idCounter = 0;
export const newId = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${(idCounter++).toString(36)}`}`;

const now = () => new Date().toISOString();

export function defaultLayer(overrides = {}) {
  return {
    id: newId('l'),
    name: 'Grand Piano',
    instrument: { id: 'grand-piano', presetId: 'concert' },
    zone: { low: 21, high: 108 },
    velocity: { low: 1, high: 127 },
    channel: 0,
    transpose: 0,
    octave: 0,
    volumeDb: 0,
    pan: 0,
    mute: false,
    solo: false,
    sends: { reverb: -14, delay: -60 },
    respond: { sustain: true, expression: true, modWheel: true, pitchBend: true, bendRange: 2 },
    ...overrides,
  };
}

export function defaultPatch(overrides = {}) {
  return {
    id: newId('p'),
    name: 'New Patch',
    programChange: null,
    tempo: null,
    notes: '',
    layers: [defaultLayer()],
    ...overrides,
  };
}

export function defaultSettings() {
  return {
    tempo: 72,
    reverb: { preset: 'hall', returnDb: -8 },
    delay: { sync: '1/4', feedback: 0.3, returnDb: -14 },
  };
}

export function emptyConcert(name = 'New Concert') {
  const patch = defaultPatch({ name: 'Grand Piano', programChange: 1 });
  return {
    format: CONCERT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    id: newId('c'),
    name,
    createdAt: now(),
    updatedAt: now(),
    settings: defaultSettings(),
    sets: [{ id: newId('s'), name: 'Set 1', patchIds: [patch.id] }],
    patches: { [patch.id]: patch },
  };
}

/** The scenario S1 template: "Sunday Worship", 3 sets, 8 patches. */
export function sundayWorshipTemplate() {
  const L = (name, id, presetId, extra = {}) =>
    defaultLayer({ name, instrument: { id, presetId }, ...extra });
  const P = (name, programChange, layers, extra = {}) =>
    defaultPatch({ name, programChange, layers, ...extra });

  const patches = [
    P('Grand Piano', 1, [L('Grand Piano', 'grand-piano', 'concert')]),
    P('Piano + Strings', 2, [
      L('Grand Piano', 'grand-piano', 'concert'),
      L('Strings', 'strings', 'warm', { volumeDb: -8, zone: { low: 36, high: 96 } }),
    ]),
    P('Warm Ambient Pad', 3, [
      L('Warm Pad', 'pads', 'warm', { sends: { reverb: -8, delay: -18 } }),
    ]),
    P('Worship Piano', 4, [
      L('Grand Piano', 'grand-piano', 'worship'),
      L('Worship Pad', 'pads', 'worship', { volumeDb: -9, zone: { low: 36, high: 96 } }),
    ]),
    P('Piano + Choir', 5, [
      L('Grand Piano', 'grand-piano', 'concert'),
      L('Choir', 'choir', 'aah', { volumeDb: -7, zone: { low: 48, high: 84 } }),
    ]),
    P('Church Organ', 6, [
      L('Pipe Organ', 'pipe-organ', 'principal', { sends: { reverb: -6, delay: -60 } }),
    ]),
    P('Soft Piano', 7, [L('Grand Piano', 'grand-piano', 'mellow', { volumeDb: -3 })]),
    P('Ambient Atmosphere', 8, [
      L('Shimmer Pad', 'pads', 'shimmer', { sends: { reverb: -6, delay: -12 } }),
      L('Air Pad', 'pads', 'air', { volumeDb: -6 }),
    ]),
  ];
  const c = emptyConcert('Sunday Worship');
  c.patches = Object.fromEntries(patches.map((p) => [p.id, p]));
  c.sets = [
    { id: newId('s'), name: 'Opening', patchIds: patches.slice(0, 3).map((p) => p.id) },
    { id: newId('s'), name: 'Worship', patchIds: patches.slice(3, 6).map((p) => p.id) },
    { id: newId('s'), name: 'Closing', patchIds: patches.slice(6).map((p) => p.id) },
  ];
  return c;
}

/** Scenario S2 template: bass split + piano + pad layer. */
export function splitGigTemplate() {
  const c = emptyConcert('Split Gig');
  const p = defaultPatch({
    name: 'Bass | Piano + Pad',
    programChange: 1,
    layers: [
      defaultLayer({
        name: 'Bass',
        instrument: { id: 'synth-bass', presetId: 'deep' },
        zone: { low: 24, high: 47 },
        sends: { reverb: -30, delay: -60 },
      }),
      defaultLayer({ name: 'Piano', zone: { low: 48, high: 108 } }),
      defaultLayer({
        name: 'Pad',
        instrument: { id: 'pads', presetId: 'warm' },
        zone: { low: 48, high: 108 },
        volumeDb: -10,
      }),
    ],
  });
  c.patches = { [p.id]: p };
  c.sets = [{ id: newId('s'), name: 'Set 1', patchIds: [p.id] }];
  return c;
}

// ---------------------------------------------------------------- queries

/** Patches in performance order (set by set). */
export function orderedPatches(concert) {
  return concert.sets.flatMap((s) =>
    s.patchIds.map((id) => ({ patch: concert.patches[id], set: s })).filter((x) => x.patch),
  );
}

export function neighbours(concert, patchId) {
  const list = orderedPatches(concert);
  const i = list.findIndex((x) => x.patch.id === patchId);
  return {
    index: i,
    total: list.length,
    prev: i > 0 ? list[i - 1] : null,
    current: i >= 0 ? list[i] : null,
    next: i >= 0 && i < list.length - 1 ? list[i + 1] : null,
  };
}

export const findByProgram = (concert, program) =>
  orderedPatches(concert).find((x) => x.patch.programChange === program)?.patch ?? null;

export const firstPatchId = (concert) => orderedPatches(concert)[0]?.patch.id ?? null;

// ---------------------------------------------------------------- edits

const touch = (c) => ({ ...c, updatedAt: now() });

export function updatePatch(concert, patchId, changes) {
  const p = concert.patches[patchId];
  if (!p) return concert;
  return touch({ ...concert, patches: { ...concert.patches, [patchId]: { ...p, ...changes } } });
}

export function updateLayer(concert, patchId, layerId, changes) {
  const p = concert.patches[patchId];
  if (!p) return concert;
  const layers = p.layers.map((l) => (l.id === layerId ? deepMerge(l, changes) : l));
  return updatePatch(concert, patchId, { layers });
}

export function addLayer(concert, patchId, layer = defaultLayer()) {
  const p = concert.patches[patchId];
  if (!p || p.layers.length >= MAX_LAYERS) return concert;
  return updatePatch(concert, patchId, { layers: [...p.layers, layer] });
}

export function removeLayer(concert, patchId, layerId) {
  const p = concert.patches[patchId];
  if (!p || p.layers.length <= 1) return concert;
  return updatePatch(concert, patchId, { layers: p.layers.filter((l) => l.id !== layerId) });
}

export function addPatch(concert, setId, patch = defaultPatch(), afterPatchId = null) {
  const sets = concert.sets.map((s) => {
    if (s.id !== setId) return s;
    const ids = [...s.patchIds];
    const at = afterPatchId ? ids.indexOf(afterPatchId) + 1 : ids.length;
    ids.splice(at > 0 ? at : ids.length, 0, patch.id);
    return { ...s, patchIds: ids };
  });
  return touch({ ...concert, sets, patches: { ...concert.patches, [patch.id]: patch } });
}

export function duplicatePatch(concert, patchId) {
  const p = concert.patches[patchId];
  const set = concert.sets.find((s) => s.patchIds.includes(patchId));
  if (!p || !set) return { concert, patchId: null };
  const copy = {
    ...structuredClone(p),
    id: newId('p'),
    name: `${p.name} copy`,
    programChange: null,
    layers: p.layers.map((l) => ({ ...structuredClone(l), id: newId('l') })),
  };
  return { concert: addPatch(concert, set.id, copy, patchId), patchId: copy.id };
}

export function removePatch(concert, patchId) {
  if (Object.keys(concert.patches).length <= 1) return concert;
  const patches = { ...concert.patches };
  delete patches[patchId];
  const sets = concert.sets.map((s) => ({
    ...s,
    patchIds: s.patchIds.filter((id) => id !== patchId),
  }));
  return touch({ ...concert, sets, patches });
}

/** Move a patch up/down within performance order, crossing set boundaries. */
export function movePatch(concert, patchId, delta) {
  const flat = concert.sets.flatMap((s) => s.patchIds.map((id) => ({ id, setId: s.id })));
  const i = flat.findIndex((x) => x.id === patchId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= flat.length) return concert;
  const target = flat[j];
  const sets = concert.sets.map((s) => ({ ...s, patchIds: [...s.patchIds] }));
  const from = sets.find((s) => s.id === flat[i].setId);
  const to = sets.find((s) => s.id === target.setId);
  from.patchIds.splice(from.patchIds.indexOf(patchId), 1);
  const ti = to.patchIds.indexOf(target.id);
  to.patchIds.splice(
    from === to ? (delta > 0 ? ti + 1 : ti) : delta > 0 ? 0 : to.patchIds.length,
    0,
    patchId,
  );
  return touch({ ...concert, sets });
}

export function addSet(concert, name = `Set ${concert.sets.length + 1}`) {
  const patch = defaultPatch();
  const set = { id: newId('s'), name, patchIds: [patch.id] };
  return touch({
    ...concert,
    sets: [...concert.sets, set],
    patches: { ...concert.patches, [patch.id]: patch },
  });
}

export function renameSet(concert, setId, name) {
  return touch({
    ...concert,
    sets: concert.sets.map((s) => (s.id === setId ? { ...s, name } : s)),
  });
}

export function removeSet(concert, setId) {
  if (concert.sets.length <= 1) return concert;
  const set = concert.sets.find((s) => s.id === setId);
  if (!set) return concert;
  const patches = { ...concert.patches };
  for (const id of set.patchIds) delete patches[id];
  return touch({ ...concert, sets: concert.sets.filter((s) => s.id !== setId), patches });
}

export function moveSet(concert, setId, delta) {
  const sets = [...concert.sets];
  const i = sets.findIndex((s) => s.id === setId);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= sets.length) return concert;
  [sets[i], sets[j]] = [sets[j], sets[i]];
  return touch({ ...concert, sets });
}

export function updateSettings(concert, changes) {
  return touch({ ...concert, settings: deepMerge(concert.settings, changes) });
}

export function duplicateConcert(concert) {
  const copy = structuredClone(concert);
  copy.id = newId('c');
  copy.name = `${concert.name} copy`;
  copy.createdAt = copy.updatedAt = now();
  return copy;
}

function deepMerge(base, changes) {
  const out = { ...base };
  for (const [k, v] of Object.entries(changes)) {
    out[k] =
      v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object'
        ? deepMerge(base[k], v)
        : v;
  }
  return out;
}

// ---------------------------------------------------------------- validation

/**
 * Validate and normalise an imported concert (STO-003/004). Older schema
 * versions are migrated. Never throws.
 * @returns {{ ok: true, concert: any } | { ok: false, errors: string[] }}
 */
export function validateConcert(input) {
  const errors = [];
  if (!input || typeof input !== 'object')
    return { ok: false, errors: ['The file is not a STAGECRAFT concert.'] };
  if (input.format !== CONCERT_FORMAT) {
    return {
      ok: false,
      errors: ['The file is not a STAGECRAFT concert (missing "stagecraft-concert" format).'],
    };
  }
  const migrated = migrate(input, errors);
  if (!migrated) return { ok: false, errors };
  const c = migrated;
  if (typeof c.name !== 'string' || !c.name.trim()) errors.push('Concert name is missing.');
  if (!Array.isArray(c.sets) || c.sets.length === 0) errors.push('Concert has no sets.');
  if (!c.patches || typeof c.patches !== 'object') errors.push('Concert has no patches.');
  if (errors.length) return { ok: false, errors };

  for (const s of c.sets) {
    if (!Array.isArray(s.patchIds)) errors.push(`Set "${s.name}" has no patch list.`);
    for (const id of s.patchIds ?? [])
      if (!c.patches[id]) errors.push(`Set "${s.name}" refers to a missing patch.`);
  }
  for (const p of Object.values(c.patches)) {
    if (!Array.isArray(p.layers) || p.layers.length === 0) {
      errors.push(`Patch "${p.name}" has no layers.`);
      continue;
    }
    if (p.layers.length > MAX_LAYERS)
      errors.push(`Patch "${p.name}" has more than ${MAX_LAYERS} layers.`);
    if (p.programChange !== null && p.programChange !== undefined) {
      if (!Number.isInteger(p.programChange) || p.programChange < 1 || p.programChange > 128) {
        errors.push(`Patch "${p.name}": program change must be 1-128.`);
      }
    }
    p.layers.forEach((l, i) => {
      const where = `Patch "${p.name}", layer ${i + 1}`;
      if (!l.instrument?.id) errors.push(`${where}: no instrument.`);
      const z = l.zone ?? {};
      if (!(z.low >= 0 && z.high <= 127 && z.low <= z.high))
        errors.push(`${where}: invalid key zone.`);
    });
  }
  if (errors.length) return { ok: false, errors };

  // Normalise: fill defaults for missing optional fields, clamp ranges.
  const patches = {};
  for (const [id, p] of Object.entries(c.patches)) {
    patches[id] = {
      ...defaultPatch({ id }),
      ...p,
      layers: p.layers.map((l) => {
        const d = defaultLayer();
        const merged = deepMerge(d, l);
        merged.id = l.id ?? d.id;
        merged.transpose = clamp(merged.transpose, -24, 24);
        merged.octave = clamp(merged.octave, -3, 3);
        merged.channel = clamp(merged.channel, 0, 16);
        return merged;
      }),
    };
  }
  return {
    ok: true,
    concert: { ...c, settings: deepMerge(defaultSettings(), c.settings ?? {}), patches },
  };
}

/** Schema migrations. v1 is the first version; future versions add steps here. */
function migrate(input, errors) {
  const v = input.schemaVersion;
  if (!Number.isInteger(v) || v < 1) {
    errors.push('Unknown concert file version.');
    return null;
  }
  if (v > SCHEMA_VERSION) {
    errors.push(
      `This concert was saved by a newer version of STAGECRAFT (file version ${v}). Update the app to open it.`,
    );
    return null;
  }
  const c = structuredClone(input);
  // if (c.schemaVersion === 1) { ...migrate to 2...; c.schemaVersion = 2; }
  return c;
}
