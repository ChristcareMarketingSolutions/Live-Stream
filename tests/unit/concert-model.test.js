import { describe, it, expect } from 'vitest';
import * as M from '../../src/performance/concert-model.js';

describe('concert model [LIVE-001..003, STO-003, STO-004]', () => {
  it('the Sunday Worship template has 3 sets and 8 patches in order', () => {
    const c = M.sundayWorshipTemplate();
    expect(c.sets.map((s) => s.name)).toEqual(['Opening', 'Worship', 'Closing']);
    const names = M.orderedPatches(c).map((x) => x.patch.name);
    expect(names).toHaveLength(8);
    expect(names[0]).toBe('Grand Piano');
    expect(names.at(-1)).toBe('Ambient Atmosphere');
    expect(M.validateConcert(c).ok).toBe(true);
  });

  it('finds neighbours across set boundaries and by program change', () => {
    const c = M.sundayWorshipTemplate();
    const list = M.orderedPatches(c);
    const n = M.neighbours(c, list[2].patch.id);
    expect(n.prev.patch.name).toBe('Piano + Strings');
    expect(n.next.patch.name).toBe('Worship Piano');
    expect(n.next.set.name).toBe('Worship');
    expect(M.findByProgram(c, 6).name).toBe('Church Organ');
    expect(M.findByProgram(c, 99)).toBeNull();
  });

  it('edits do not mutate the original', () => {
    const c = M.emptyConcert();
    const pid = M.firstPatchId(c);
    const lid = c.patches[pid].layers[0].id;
    const c2 = M.updateLayer(c, pid, lid, { volumeDb: -6, sends: { reverb: -3 } });
    expect(c.patches[pid].layers[0].volumeDb).toBe(0);
    expect(c2.patches[pid].layers[0].volumeDb).toBe(-6);
    expect(c2.patches[pid].layers[0].sends).toEqual({ reverb: -3, delay: -60 });
  });

  it('adds and removes layers within 1..8', () => {
    let c = M.emptyConcert();
    const pid = M.firstPatchId(c);
    for (let i = 0; i < 10; i++) c = M.addLayer(c, pid);
    expect(c.patches[pid].layers).toHaveLength(M.MAX_LAYERS);
    for (const l of [...c.patches[pid].layers]) c = M.removeLayer(c, pid, l.id);
    expect(c.patches[pid].layers).toHaveLength(1);
  });

  it('duplicates, moves and removes patches', () => {
    let c = M.sundayWorshipTemplate();
    const first = M.firstPatchId(c);
    const dup = M.duplicatePatch(c, first);
    c = dup.concert;
    expect(M.orderedPatches(c)[1].patch.id).toBe(dup.patchId);
    expect(c.patches[dup.patchId].layers[0].id).not.toBe(c.patches[first].layers[0].id);
    c = M.movePatch(c, first, 1);
    expect(M.orderedPatches(c)[1].patch.id).toBe(first);
    c = M.movePatch(c, first, -5);
    expect(c).toBeTruthy();
    c = M.removePatch(c, dup.patchId);
    expect(c.patches[dup.patchId]).toBeUndefined();
    expect(M.validateConcert(c).ok).toBe(true);
  });

  it('moves a patch across a set boundary', () => {
    let c = M.sundayWorshipTemplate();
    const lastOfOpening = c.sets[0].patchIds.at(-1);
    c = M.movePatch(c, lastOfOpening, 1);
    expect(c.sets[0].patchIds).not.toContain(lastOfOpening);
    expect(c.sets[1].patchIds[0]).toBe(lastOfOpening);
    c = M.movePatch(c, lastOfOpening, -1);
    expect(c.sets[0].patchIds.at(-1)).toBe(lastOfOpening);
  });

  it('manages sets', () => {
    let c = M.emptyConcert();
    c = M.addSet(c, 'Encore');
    expect(c.sets).toHaveLength(2);
    c = M.renameSet(c, c.sets[1].id, 'Finale');
    c = M.moveSet(c, c.sets[1].id, -1);
    expect(c.sets[0].name).toBe('Finale');
    c = M.removeSet(c, c.sets[0].id);
    expect(c.sets).toHaveLength(1);
    expect(M.removeSet(c, c.sets[0].id).sets).toHaveLength(1);
  });

  it('T-406 export → import round trip is identical', () => {
    const c = M.sundayWorshipTemplate();
    const back = M.validateConcert(JSON.parse(JSON.stringify(c)));
    expect(back.ok).toBe(true);
    expect(back.concert).toEqual(c);
  });

  it('T-407 rejects invalid files with readable messages', () => {
    expect(M.validateConcert(null).ok).toBe(false);
    expect(M.validateConcert({ hello: 1 }).errors[0]).toMatch(/not a STAGECRAFT concert/);
    const newer = { ...M.emptyConcert(), schemaVersion: 99 };
    expect(M.validateConcert(newer).errors[0]).toMatch(/newer version/);
    const c = M.emptyConcert();
    const pid = M.firstPatchId(c);
    c.patches[pid].layers[0].zone = { low: 90, high: 20 };
    expect(M.validateConcert(c).errors[0]).toMatch(/invalid key zone/);
    const c2 = M.emptyConcert();
    c2.sets[0].patchIds.push('ghost');
    expect(M.validateConcert(c2).errors[0]).toMatch(/missing patch/);
  });

  it('fills defaults for older files missing optional fields', () => {
    const c = M.emptyConcert();
    const pid = M.firstPatchId(c);
    delete c.patches[pid].layers[0].respond;
    delete c.settings.delay;
    const r = M.validateConcert(c);
    expect(r.ok).toBe(true);
    expect(r.concert.patches[pid].layers[0].respond.sustain).toBe(true);
    expect(r.concert.settings.delay.sync).toBe('1/4');
  });
});
