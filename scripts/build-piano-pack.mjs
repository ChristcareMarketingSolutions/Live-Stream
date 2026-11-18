#!/usr/bin/env node
/**
 * Builds public/packs/grand-piano from Salamander Grand Piano V3 (CC-BY 3.0).
 *
 * Usage:
 *   node scripts/build-piano-pack.mjs <dir-with-encoded-ogg>
 *
 * The encoded files are produced from the original FLAC samples
 * (https://github.com/sfzinstruments/SalamanderGrandPiano, Samples/<Note>v<5|10|15>.flac) with:
 *   ffmpeg -i in.flac -af "silenceremove=start_periods=1:start_threshold=-72dB:start_silence=0.002,
 *     atrim=0:LEN,afade=t=out:st=LEN-1.5:d=1.5" -ar 48000 -c:a libvorbis -q:a 4 out.ogg
 * where LEN is 9 s (octaves 0-2), 7 s (3-4), 5 s (5-6) and 3.5 s (7-8).
 * Output names replace "#" with "s" (D#4 -> Ds4) so URLs need no escaping.
 */
import { readdirSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) {
  console.error('Usage: node scripts/build-piano-pack.mjs <dir>');
  process.exit(1);
}
const out = new URL('../public/packs/grand-piano/', import.meta.url).pathname;
mkdirSync(join(out, 'samples'), { recursive: true });

const NOTE = { C: 0, Cs: 1, D: 2, Ds: 3, E: 4, F: 5, Fs: 6, G: 7, Gs: 8, A: 9, As: 10, B: 11 };
const LAYERS = { 5: [1, 55], 10: [56, 95], 15: [96, 127] };

const files = readdirSync(src).filter((f) => f.endsWith('.ogg'));
const parsed = files.map((file) => {
  const m = /^([A-G]s?)(\d)v(\d+)\.ogg$/.exec(file);
  if (!m) throw new Error(`Unexpected file name ${file}`);
  return { file, root: (Number(m[2]) + 1) * 12 + NOTE[m[1]], vel: Number(m[3]) };
});
const roots = [...new Set(parsed.map((p) => p.root))].sort((a, b) => a - b);

const regions = parsed
  .sort((a, b) => a.root - b.root || a.vel - b.vel)
  .map(({ file, root, vel }) => {
    const i = roots.indexOf(root);
    const lo = i === 0 ? 21 : Math.floor((roots[i - 1] + root) / 2) + 1;
    const hi = i === roots.length - 1 ? 108 : Math.floor((root + roots[i + 1]) / 2);
    copyFileSync(join(src, file), join(out, 'samples', file));
    return { file: `samples/${file}`, root, lo, hi, velLo: LAYERS[vel][0], velHi: LAYERS[vel][1] };
  });

const manifest = {
  format: 'stagecraft-pack',
  schemaVersion: 1,
  id: 'grand-piano',
  name: 'Grand Piano',
  version: '1.0.0',
  engine: 'sampler',
  license: {
    name: 'CC-BY-3.0',
    url: 'https://creativecommons.org/licenses/by/3.0/',
    attribution: 'Salamander Grand Piano V3 by Alexander Holm (SFZ mapping by kinwie)',
    source: 'https://github.com/sfzinstruments/SalamanderGrandPiano',
    modifications:
      '30 notes x 3 velocity layers (v5, v10, v15); leading silence trimmed; tails shortened with fade; encoded to Ogg Vorbis q4.',
  },
  sampleRate: 48000,
  channels: 2,
  envelope: { release: 0.35 },
  regions,
};
writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.info(`Wrote ${regions.length} regions to ${out}`);
