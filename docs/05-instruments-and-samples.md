# 05 — Instruments, Sample Packs & Licensing

## 1. Build approach per instrument

| Instrument | Engine | Source material | Notes |
|---|---|---|---|
| Grand Piano | Sampler | Salamander Grand Piano (Yamaha C5) — CC-BY 3.0 *(verify current licence text)* | Use every minor 3rd (≈ 30 notes) × 4 velocity layers for V1; trim tails to ≤ 8 s with fade; attribution required. |
| Electric Piano | Sampler (or FM model fallback) | Search CC0/CC-BY tine EP sets; if none of acceptable quality, build an FM/modal EP synth | Tremolo + optional chorus. |
| Tonewheel organ | **Additive synthesis** | None needed | 9 drawbars (16', 5⅓', 8', 4', 2⅔', 2', 1⅗', 1⅓', 1'), percussion 2nd/3rd, key click, rotary (AM + modulated delay, crossover ~800 Hz), slow/fast with ramp. No samples → no licence risk, tiny download. |
| Pipe organ | Sampler or additive | VCSL (Versilian Community Sample Library, CC0) organ samples if suitable; else additive pipe model (principal/flute spectra + chiff) | Stops as presets. |
| Strings | Sampler | VSCO 2 Community Edition (CC0) or VCSL | Sustain loops; slow/fast attack presets; legato not in V1. |
| Choir | Sampler or synthesis | Licensed choir samples are scarce — check VCSL and other CC0 sources; fallback: formant-filtered pad ("aah/ooh") | Document which was chosen in ASSET-LICENSES. |
| Pads | Synth | None | Detuned saws/supersaw, slow attack, LPF with slow LFO, shimmer via delay+reverb. 6 presets: Warm, Worship, Shimmer, Air, Dark, Swell. |
| Synth bass | Synth | None | Sub + saw, filter env. |
| Drums (V3) | Sampler | CC0 drum kits | One acoustic kit + one electronic kit. |

**Rule:** before any file is committed or uploaded, add a row to `ASSET-LICENSES.md`:
`asset | source URL | author | licence | licence URL | attribution text | modifications | date checked`.
If the licence is unclear (e.g. "free for personal use", Creative Commons *Sampling Plus*, NC licences, extracted from a commercial product) — **do not use it**.
Show required attributions on an "About / Credits" screen.

## 2. Pack format

```
packs/grand-piano/
  manifest.json
  samples/
    A0_v1.ogg ... C8_v4.ogg
```

```json
{
  "format": "stagecraft-pack", "schemaVersion": 1,
  "id": "grand-piano", "name": "Grand Piano", "version": "1.0.0",
  "engine": "sampler",
  "license": { "name": "CC-BY-3.0", "attribution": "Salamander Grand Piano by Alexander Holm" },
  "sampleRate": 48000, "channels": 2,
  "estimatedDecodedBytes": 412000000,
  "envelope": { "attack": 0.002, "release": 0.6 },
  "regions": [
    { "file": "samples/C4_v3.ogg", "root": 60, "lo": 59, "hi": 61, "velLo": 81, "velHi": 105, "gainDb": 0, "loop": null, "tune": 0 }
  ],
  "releaseSamples": [],
  "presets": [ { "id": "concert", "name": "Concert", "params": { "brightness": 0.5, "release": 0.6 } } ]
}
```

## 3. Audio file format

- **OGG Vorbis q6–q7** (or **FLAC** where quality matters most). Chrome/Edge/Firefox decode both.
- **Avoid MP3** for samples: encoder padding adds silence at the start (attack timing/loop issues).
- Normalise to consistent loudness per velocity layer; trim leading silence to < 2 ms; fade tails.
- 48 kHz, stereo for piano/strings/choir; mono acceptable for organ pipes and EP.
- `scripts/build-pack.mjs` (Node) does: read source WAVs + mapping CSV → trim/fade/normalise (via ffmpeg CLI if available, documented) → encode → write manifest with computed decoded size.

## 4. Size & memory budgets (V1)

| Pack | Download target | Decoded RAM target |
|---|---|---|
| Grand Piano | ≤ 45 MB | ≤ 400 MB |
| Electric Piano | ≤ 20 MB | ≤ 150 MB |
| Pipe organ (if sampled) | ≤ 15 MB | ≤ 100 MB |
| Strings | ≤ 20 MB | ≤ 150 MB |
| Choir | ≤ 15 MB | ≤ 100 MB |
| Organ, pads, bass (synth) | < 50 KB code | negligible |

A "Lite" piano variant (2 velocity layers, ≤ 4 s tails, ≈ 15 MB / 130 MB) should be offered for low-RAM laptops.

## 5. Hosting the packs

- GitHub Pages limits: published site ≤ 1 GB, files ≤ 100 MB, soft bandwidth ~100 GB/month. V1 total packs should stay under ~150 MB.
- Option A (V1 default): packs inside the repo under `public/packs/`, deployed with the site. Keep sample sources (WAV) **out of git**; only encoded files are committed.
- Option B (if size grows): a separate CORS-enabled static host for packs (GitHub Release asset downloads do not send CORS headers, so the browser cannot fetch them directly). Decide by ADR before exceeding ~300 MB.
- Git LFS is **not** served by GitHub Pages — do not use LFS for deployed assets.

## 6. Reverb impulse responses

Generate algorithmically (exponentially decaying filtered noise, stereo-decorrelated) at startup — zero licence risk and no download.
Presets: Room (0.8 s), Hall (2.2 s), Cathedral (4.5 s), Plate-like (1.6 s, brighter).
