# 03 — Roadmap & Work Programme (STAGECRAFT)

Each phase is a milestone with tasks, deliverables, acceptance tests and an **Exit Gate**.
A phase is closed only when the product owner signs the Phase Completion Certificate
(`docs/templates/phase-certificate.md`) and records it in the table below.

| Phase | Title                      | Release | Status                                                      | Signed off                          |
| ----- | -------------------------- | ------- | ----------------------------------------------------------- | ----------------------------------- |
| 0     | Foundation                 | —       | Done                                                        | 2026-11-18 (product owner, in chat) |
| 1     | Audio engine & first synth | —       | Delivered 2026-11-19, awaiting hardware checks M-101..103   |                                     |
| 2     | Keyboard & MIDI            | —       | Delivered 2026-11-19, awaiting hardware checks M-201..205   |                                     |
| 3     | Instrument library         | —       | Delivered 2026-11-19, awaiting sound review M-301..302      |                                     |
| 4     | Live performance engine    | —       | Delivered 2026-11-19, awaiting scenarios S1, S2 on hardware |                                     |
| 5     | V1 hardening & release     | **V1**  | Not started                                                 |                                     |
| 6     | Mixer & effects            | V2      | Not started                                                 |                                     |
| 7     | Synth designer & presets   | **V2**  | Not started                                                 |                                     |
| 8     | MIDI DAW                   | **V3**  | Not started                                                 |                                     |
| 9     | Audio DAW & export         | **V4**  | Not started                                                 |                                     |

Test IDs (T-xxx) are defined in `06-testing-qa.md`. Requirement IDs are in `01-product-spec.md`.

---

## Phase 0 — Foundation

**Objective:** a running, deployable, empty shell with tooling, tests and CI in place.

Tasks

1. `npm init`; add Vite, Vitest, Playwright, ESLint, Prettier with **exact pinned versions** (check latest stable at the time).
2. `vite.config.js` with `base` from `BASE_PATH` env; `npm run dev/build/preview/test/test:e2e/lint` scripts.
3. App shell: top bar (name, audio status placeholder disabled, panic disabled), sidebar with
   workspaces (Live, Edit, Mixer, Library, Synth, DAW, Settings — all but Live and Settings disabled
   with "Coming in Phase N"), main area, status bar. Hash router (`#/live`, `#/settings`).
4. Design tokens (`styles/tokens.css`): dark palette, spacing, type scale, focus ring. Self-hosted font or system UI stack.
5. `core/event-bus.js`, `core/store.js` with unit tests.
6. GitHub Actions: `ci.yml` (lint, unit, build, e2e smoke on PRs and pushes) and `deploy.yml`
   (build with `BASE_PATH=/<repo-name>/`, deploy to GitHub Pages on push to `main`).
7. ADRs 0001–0006 (see architecture §12). `docs/dev-log.md` started. `README.md` (what it is, how to run, how to deploy).
8. `ASSET-LICENSES.md` created (empty table) and `LICENSE` (choose: MIT recommended — product owner confirms).
9. Playwright smoke test: app loads, no console errors, router switches Live ↔ Settings, refresh on `#/settings` works.

Deliverables: repo skeleton, CI green, live GitHub Pages URL showing the shell.

Acceptance: T-001 (loads, no errors), T-002 (routing + refresh), T-003 (Pages URL with subpath assets), unit tests for store/bus.

**Exit Gate 0:** CI green on main; Pages URL opens; product owner has reviewed folder structure and ADRs.

---

## Phase 1 — Audio engine & first synth

**Objective:** real sound from a simple built-in synth with correct note lifecycle and safe output.

Tasks

1. `audio/audio-context.js`: single context, `latencyHint` from settings, resume on gesture,
   `audio:state` events; UI "Click to start audio" overlay when suspended. [AUD-001, AUD-002]
2. `audio/master-bus.js`: master gain (dB), limiter AudioWorklet (or DynamicsCompressor fallback, ADR),
   meter AudioWorklet posting peak/RMS ≤ 30 Hz, canvas meter component with clip hold. [AUD-003, AUD-004]
3. `audio/envelope.js`: ADSR on AudioParams using `cancelAndHoldAtTime`/`setTargetAtTime`; tests via OfflineAudioContext.
4. `audio/voice-pool.js`: pure allocation/stealing logic with unit tests + node wrapper. [AUD-005]
5. `instruments/instrument.js` interface + `instruments/synth/basic-synth.js` (2 osc, LP filter, ADSR) with 3 presets.
6. Temporary dev test panel (`#/settings` → "Audio test"): play C4, chord, 64-note cluster, release all.
7. Panic (Esc + button). [AUD-006]
8. Settings: latency hint, show sample rate/base latency/output latency.

Acceptance: T-101 note on/off, T-102 64 voices without NaN/clipping (offline render), T-103 voice stealing order,
T-104 panic silences within 50 ms, T-105 envelope release reaches −80 dB, T-106 no clicks (no sample-to-sample jump > threshold at note start/stop in offline render).
Manual: M-101 hear clean tone; M-102 meter moves; M-103 no crackle while UI is idle and while resizing window.

**Exit Gate 1:** all T-1xx pass; product owner confirms M-101..103 on their laptop.

---

## Phase 2 — Keyboard & MIDI

**Objective:** play the synth from a real MIDI keyboard, the on-screen keyboard and the computer keyboard.

Tasks

1. `midi/midi-parser.js` (pure, full unit tests incl. running status not needed — Web MIDI delivers full messages; note-on vel 0). [MIDI-003]
2. `midi/midi-access.js`: permissions, device list, hot-plug, "All inputs" option; error/unsupported states with instructions. [MIDI-001, MIDI-002, MIDI-012]
3. `midi/input-router.js`: merge sources, global velocity curve, emit `midi:event`. [MIDI-008]
4. `performance/held-notes.js` + `performance/sustain.js` (pure, unit-tested, see 04 §4–5). [MIDI-004]
5. Pitch bend, mod wheel, expression, CC7 wiring to the synth. [MIDI-005]
6. On-screen 88-key keyboard component (canvas or SVG, single element, not 88 DOM listeners), scroll/zoom, velocity by click height, highlights from `notes:active` batched by rAF. [MIDI-010]
7. Computer keyboard mapping with octave/velocity keys; ignores input when focus is in a text field. [MIDI-011]
8. Settings → MIDI: device list with activity LEDs, message monitor (last 50 messages). [MIDI-007]
9. Debug hook `window.__stagecraft.debug.injectMidi(bytes)` (dev and test builds only) for e2e tests.

Acceptance: T-201 parser, T-202 held-note table incl. disconnect release, T-203 sustain state machine, T-204 velocity curves,
T-205 e2e inject MIDI → active voice count matches, T-206 computer keyboard plays and not while typing, T-207 stress: 10 000 random note on/off/sustain events → 0 active voices at end.
Manual: M-201 connect keyboard, play; M-202 unplug while holding notes → silence; M-203 sustain pedal; M-204 pitch bend/mod; M-205 measure added latency readout (NFR-01).

**Exit Gate 2:** all T-2xx pass; M-201..205 confirmed with product owner's keyboard.

---

## Phase 3 — Instrument library

**Objective:** realistic core instruments, loaded on demand, cached for offline.

Tasks

1. Pack manifest schema + validator; pack loader with progress, decode, Cache API storage, delete. [INS-010] (see 05)
2. Generic sampler engine: key/velocity mapping, nearest-sample pitch shift (`playbackRate`), velocity crossfade optional, release samples optional, loop points, per-voice filter for velocity brightness.
3. Source, trim, normalise and encode packs per `05-instruments-and-samples.md`; log every asset in `ASSET-LICENSES.md` **before** commit.
   Build a reproducible `scripts/build-pack.mjs` (input folder + mapping → manifest + encoded files).
4. Instruments: Grand Piano [INS-002], Electric Piano [INS-003], Tonewheel organ (additive, no samples) [INS-004],
   Pipe organ [INS-005], Strings [INS-006], Choir [INS-007], Pads ×6 [INS-008], Synth bass [INS-009].
5. Instrument pool with ref-counting and memory accounting (`memoryBytes`). (architecture §6)
6. Library view: list instruments, size to download, installed state, install/remove, storage usage. [STO-005]
7. Simple instrument picker in Live view (single layer only for now) to audition.

Acceptance: T-301 manifest validation, T-302 sampler mapping (note→sample, rate), T-303 pack install/remove/cache offline (Playwright offline mode),
T-304 memory accounting within 10 % of estimate, T-305 each instrument renders non-silent, non-clipping C2/C4/C6 at vel 30/100 (offline).
Manual: M-301 sound quality review of each instrument (product owner rates 1–5; ≥ 3 required, piano ≥ 4); M-302 64-voice sustained piano no dropouts (NFR-03).

**Exit Gate 3:** T-3xx pass; M-301/302 accepted; ASSET-LICENSES complete and reviewed.

---

## Phase 4 — Live performance engine

**Objective:** concerts, sets, patches, layers, splits, switching — the MainStage-style core.

Tasks

1. Concert model + validation + defaults (pure). Example concert "Sunday Worship" (scenario S1) shipped as a template.
2. Storage: IndexedDB `db.js`, concert repo, autosave, Ctrl+S, restore last concert; import/export with validation errors shown clearly. [STO-001..004]
3. Note router (pure): channel/zone/velocity matching, transpose/octave. [LIVE-010, LIVE-020]
4. Patch engine: build/reuse layer chains, switching semantics (held notes stay on old patch), preload next/prev, idle teardown. [LIVE-030..033]
5. Channel strip (V1 basic): volume, pan, mute, sends; shared reverb (convolver with generated or licensed IR) + tempo-synced delay bus. [LIVE-011, MIX-001, MIX-005]
6. Edit view: concert tree (sets → patches, drag reorder), patch inspector, layer cards, zone map over keyboard with drag handles, learn zone. [LIVE-001..003, LIVE-020, LIVE-021]
7. Live view (performance): big patch name, prev/next, set, meters, status, panic; keyboard shortcuts; program change. [LIVE-040, MIDI-006]
8. Per-patch tempo, cue text; performance lock. [LIVE-041, LIVE-042]

Acceptance: T-401 router matrix tests, T-402 switch while holding → old notes release correctly, T-403 switch with sustain down,
T-404 switch time ≤ 50 ms (instrumented), T-405 save/reload/restore, T-406 export→import round trip identical, T-407 invalid file rejected with message,
T-408 shared instrument not reloaded across patches, T-409 e2e scenario S2 by injected MIDI.
Manual: M-401 scenario S1 full run with product owner's keyboard; M-402 scenario S2.

**Exit Gate 4:** T-4xx pass; S1 and S2 performed successfully on hardware.

---

## Phase 5 — V1 hardening & release

**Objective:** make V1 reliable enough for a real Sunday service.

Tasks

1. PWA: manifest, icons, service worker (app shell precache), packs cached; update-available prompt, never auto-reload. [APP-004, APP-005]
2. Error handling sweep: every async path surfaces a user-readable message; global error toast; audio context interruption (device change, sleep) recovery.
3. Performance: profile note path (NFR-01), long-task check during play, memory soak (NFR-07), bundle size (NFR-05).
4. Accessibility pass (APP-002, NFR-09). Keyboard-only walkthrough.
5. Browser matrix: Chrome, Edge (Win/macOS) full; Firefox best effort; Safari → no-MIDI notice.
6. User guide `docs/user-guide.md`: first run, connecting MIDI, building a patch, splits, sets, backup/export, troubleshooting latency/crackle.
7. Tag `v1.0.0`, release notes, Pages deployment verified.

Acceptance: T-501 offline load (S3), T-502 update prompt, T-503 soak (3 h, scripted), T-504 no console errors across all views, T-505 bundle budget.
Manual: M-501 real service rehearsal (S1) with full setlist, M-502 offline test at venue or with Wi-Fi off, M-503 latency measurement recorded (NFR-02).

**Exit Gate 5 = V1 acceptance:** all M requirements for V1 met; product owner signs V1.

---

## Phase 6 — Mixer & effects (V2)

Tasks: Mixer view [MIX-002]; insert chains with EQ3, compressor, chorus, tremolo, filter, rotary, delay [MIX-003]; master EQ + limiter UI [MIX-004];
effect presets; MIDI-learn [MIDI-009]; CPU/headroom indicator (render-quantum timing from worklet).
Acceptance: T-601 each effect renders and bypass is bit-transparent, T-602 feedback limits (delay ≤ 0.95), T-603 MIDI-learn persistence. Manual: M-601 tone review.

## Phase 7 — Synth designer & presets (V2)

Tasks: full subtractive synth [SYN-001..004] (AudioWorklet only if native nodes can't meet a requirement — ADR), synth view with knobs/envelopes visualised,
preset browser with categories/tags/favourites, import/export [SYN-005], 20+ factory presets (worship pads, strings, leads, bass, bells).
Acceptance: T-701 preset round trip, T-702 modulation routing tests (offline render), T-703 CPU budget 32 voices. **Exit = V2 release.**

## Phase 8 — MIDI DAW (V3)

Tasks: transport + lookahead scheduler (Tone.Transport or own 25 ms lookahead scheduler — ADR) [DAW-001]; metronome & count-in;
MIDI tracks using patches; recording with timestamps aligned to transport (`event.timeStamp` → context time mapping) [DAW-002];
arrangement view (canvas); piano roll with undo/redo, quantise, velocity lane [DAW-003]; .mid import/export with @tonejs/midi [DAW-004]; drum kit [INS-012].
Acceptance: T-801 scheduler jitter < 2 ms (offline), T-802 record→playback timing within 5 ms, T-803 quantise maths, T-804 SMF round trip, T-805 undo/redo.
Manual: scenario S4. **Exit = V3 release.**

## Phase 9 — Audio DAW & export (V4)

Tasks: audio input via getUserMedia (processing off) [DAW-010]; recorder worklet → PCM chunks → IndexedDB blobs [STO-006];
round-trip latency calibration (loopback click test); clip editing [DAW-011]; offline render of full project via OfflineAudioContext → WAV encoder [DAW-012]; project zip export.
Acceptance: T-901 recording sample-accurate length, T-902 WAV header/format validation, T-903 offline render equals real-time mix (null test within −60 dB).
Manual: record vocals over a MIDI track, export WAV, play in another player. **Exit = V4 release.**
