# Development Log

Newest entries first. Template: `docs/templates/dev-log-entry.md`.

## 2026-11-19 — Phase 2 — Verified and deployed

**Done**

- Browser acceptance tests `tests/e2e/phase2-midi.spec.js` [MIDI-001..012].
- Fixed: per-instrument polyphony (stress test showed 144 long pad voices) [AUD-005].
- Fixed: status bar could widen the page by 2 px with other fonts (CI failure) [APP-002].

**Tests**

- Unit 94 pass; e2e 24 pass, including a 3 000-event in-browser stress test.
- Manual checks needed: M-201..M-205 (`docs/certificates/phase-2.md`).

**Next**

- Phase 3 verification: instrument library, piano pack, offline cache.

## 2026-11-19 — Phase 1 — Verified and deployed

**Done**

- Browser acceptance tests for Phase 1 (`tests/e2e/phase1-audio.spec.js`) [AUD-001..006].
- Fixed: master output overshoot (+1.2 dBFS with 64 loud voices). Added soft clipper after
  the limiter (ADR-0007) [AUD-004].
- Smoke tests updated for the live app (concert loads, phone width on every view).
- Phase 0 sign-off recorded; Phase 1 certificate written.

**Tests**

- Unit 93 pass; e2e 15 pass. Every preset renders at about −12 dBFS with no NaN, no clicks,
  and releases decay below −80 dB.
- Manual checks needed: M-101..M-103 (see `docs/certificates/phase-1.md`).

**Next**

- Phase 2 verification: MIDI, keyboards, sustain.

## 2026-11-18 — Phase 0 — Foundation

**Done**

- Tooling with pinned versions: Vite 8.3.8, Vitest 5.1.1, Playwright 1.63.0, ESLint 10.15.0, Prettier 3.10.1.
  Scripts: dev, build, preview, test, test:e2e, lint, format. `BASE_PATH` env controls the Vite base.
- Core: `event-bus.js`, `store.js` (+ `combineReducers`, `select`, dev freeze), `workspaces.js`, `capabilities.js`, `reducers/ui.js`.
- UI shell [APP-001, APP-002]: top bar, workspace sidebar (unbuilt workspaces disabled with phase badge and
  "Coming in Phase N" tooltip), status bar, skip link, responsive layout to phone width, dark design tokens.
- Hash router [APP-001] with fallback and address normalisation (ADR-0003).
- Live view: honest empty state, browser readiness check, phase tracker. Settings view: system check table, about.
- GitHub Actions: `ci.yml` (lint, unit, build, e2e on every push/PR) and `deploy.yml` (Pages on push to main) [APP-003].
- ADRs 0001–0006. README, LICENSE (MIT, pending product owner confirmation), ASSET-LICENSES.md.

**Tests**

- Unit: 4 files, 35 tests, all pass.
- E2E (Chromium, production build under `/Live-Stream/`): 6 tests, all pass: T-001, T-002, T-003, disabled
  workspaces, system check, no horizontal scroll at 375 px.
- Manual checks needed (product owner): open the Pages URL in Chrome/Edge on your laptop; check the System
  check shows Web MIDI "Available"; check the layout reads well; try a refresh on Settings.

**Decisions**

- ADR-0001 … ADR-0006 accepted as planned. No runtime dependencies at all in Phase 0 (the plan's `idb` and
  Tone.js are deferred to the phases that need them).

**Issues / risks**

- GitHub Pages must be switched on once (Settings → Pages → Source: GitHub Actions); until then deploy fails.
- R-11 (unverified claims): no audio exists yet, so nothing audio-related is claimed.

**Open questions**

- Confirm the MIT licence for the code (samples are licensed separately).

**Next**

- Phase 1 (audio engine & first synth) after Exit Gate 0 sign-off.

## 2026-11-18 — Phases 1–4 — Work in progress (saved, not deployed, not signed off)

**Done (code complete, partly verified)**

- Phase 1: shared AudioContext, master bus (gain → limiter → meter worklet), envelopes, voice stealing, Instrument base, Panic, audio settings, sound test.
- Phase 2: MIDI parser/access/hot-plug, held-note table, sustain, controllers, on-screen 88-key keyboard, computer keyboard, MIDI settings and monitor, `?debug` test hook.
- Phase 3: pack loader with offline cache, sampler, Salamander Grand Piano pack (CC-BY 3.0, 90 samples, 7 MB), synthesised EP / tonewheel / pipe organ / strings / choir / pads / bass / analog synth (32 presets, level-matched to -12 dBFS), Library view with credits.
- Phase 4: concert model, IndexedDB autosave, import/export, note router, patch engine, chain manager, shared reverb + delay, Edit view, Live view, program change.

**Tests**

- Unit: 11 files, 91 tests pass (incl. 10 000-event stuck-note fuzz test).
- Browser probes: audio starts, piano pack loads (206 MB decoded), notes start and release to 0 voices, no console errors, all presets render without NaN or clicks.
- Not yet done: Playwright e2e suites for Phases 1–4, phase certificates, manual hardware checks.

**Open questions**

- Product owner is deciding between web/PWA, Electron/Tauri desktop wrapper, or a native (JUCE/ASIO) engine for Windows, after a latency measurement.

**Next**

- Wait for product owner decision. Then: e2e tests, certificates, deploy.
