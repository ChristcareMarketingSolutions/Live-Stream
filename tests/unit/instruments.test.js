import { describe, it, expect } from 'vitest';
import { drawbarHarmonics, PRESETS } from '../../src/instruments/presets.js';
import { findRegion, playbackRateFor } from '../../src/instruments/sampler.js';
import { validateManifest } from '../../src/packs/pack-manifest.js';
import { INSTRUMENTS, presetsFor, defaultPreset } from '../../src/instruments/registry.js';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(
  readFileSync(new URL('../../public/packs/grand-piano/manifest.json', import.meta.url), 'utf8'),
);

describe('instruments [INS-001..010, T-301, T-302]', () => {
  it('drawbars map to the right harmonics of the 16 foot pitch', () => {
    const h = drawbarHarmonics('888000000');
    expect(h[1]).toBe(1); // 16'
    expect(h[3]).toBe(1); // 5 1/3'
    expect(h[2]).toBe(1); // 8'
    expect(h[4]).toBe(0);
    expect(drawbarHarmonics('000000008')[16]).toBe(1); // 1'
    expect(drawbarHarmonics('070000000')[3]).toBeCloseTo(Math.pow(10, -3 / 20));
  });

  it('every catalogue instrument has at least one preset', () => {
    for (const inst of INSTRUMENTS) {
      expect(presetsFor(inst.id).length, inst.id).toBeGreaterThan(0);
      expect(defaultPreset(inst.id)).toBeTruthy();
    }
    expect(Object.keys(PRESETS.pads)).toHaveLength(6);
  });

  it('the shipped piano manifest is valid and covers the full keyboard at every velocity', () => {
    expect(validateManifest(manifest).ok).toBe(true);
    expect(manifest.license.name).toBe('CC-BY-3.0');
    for (let note = 21; note <= 108; note++) {
      for (const vel of [1, 40, 55, 56, 95, 96, 127]) {
        const r = findRegion(manifest.regions, note, vel);
        expect(r, `${note}/${vel}`).toBeTruthy();
        expect(note >= r.lo && note <= r.hi).toBe(true);
        expect(Math.abs(note - r.root)).toBeLessThanOrEqual(2);
      }
    }
  });

  it('picks velocity layers by range', () => {
    expect(findRegion(manifest.regions, 60, 30).file).toBe('samples/C4v5.ogg');
    expect(findRegion(manifest.regions, 60, 80).file).toBe('samples/C4v10.ogg');
    expect(findRegion(manifest.regions, 60, 120).file).toBe('samples/C4v15.ogg');
  });

  it('computes playback rates', () => {
    expect(playbackRateFor(60, 60)).toBe(1);
    expect(playbackRateFor(72, 60)).toBe(2);
    expect(playbackRateFor(61, 60)).toBeCloseTo(1.05946, 4);
  });

  it('rejects unsafe or malformed manifests', () => {
    const bad = structuredClone(manifest);
    bad.regions[0].file = '../../etc/passwd';
    expect(validateManifest(bad).ok).toBe(false);
    expect(validateManifest({}).ok).toBe(false);
    const bad2 = structuredClone(manifest);
    bad2.regions[0].lo = 200;
    expect(validateManifest(bad2).errors.join()).toMatch(/0-127/);
  });
});
