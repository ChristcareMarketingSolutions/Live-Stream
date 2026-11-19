# Phase Completion Certificate — Phase 3: Instrument library

| Item           | Detail                                                      |
| -------------- | ----------------------------------------------------------- |
| Date submitted | 2026-11-19                                                  |
| Commit         | see `main` (Phase 3 certificate commit)                     |
| Deployed URL   | https://christcaremarketingsolutions.github.io/Live-Stream/ |

## 1. Requirement compliance

| Req ID  | Status                      | Evidence                                               | Notes                                                              |
| ------- | --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------ |
| INS-001 | Done                        | `src/instruments/instrument.js`; all engines extend it |                                                                    |
| INS-002 | Done                        | T-305; unit manifest coverage test                     | Salamander Grand, 30 notes × 3 velocity layers, 4 presets.         |
| INS-003 | Done (synthesised)          | T-305                                                  | FM electric piano, 3 presets incl. tremolo.                        |
| INS-004 | Done                        | T-305; unit drawbar test                               | 9 drawbars, percussion, key click, rotary (mod wheel slow/fast).   |
| INS-005 | Done (synthesised)          | T-305                                                  | Principal 8', Flutes 8'+4', Full Organ.                            |
| INS-006 | Partial                     | T-305                                                  | Synthesised ensemble. Sampled strings not yet sourced (risk R-03). |
| INS-007 | Done (synthesised fallback) | T-305                                                  | Formant choir Aah/Ooh, as allowed by the spec.                     |
| INS-008 | Done                        | T-305; unit "6 pads"                                   | Warm, Worship, Shimmer, Air, Dark, Swell.                          |
| INS-009 | Done                        | T-305                                                  | Deep, Round, Punchy.                                               |
| INS-010 | Done                        | e2e INS-010, T-303 (offline + remove), T-304           | Cache API; works offline once installed.                           |
| STO-005 | Partial                     | e2e INS-010 (usage shown)                              | Persistent-storage request done; storage shown in Library.         |

## 2. Automated tests

| Suite                      | Passed | Failed | Skipped |
| -------------------------- | ------ | ------ | ------- |
| Unit (Vitest)              | 94     | 0      | 0       |
| E2E (Playwright, Chromium) | 30     | 0      | 0       |

Issue found and fixed in this phase: the piano samples had been committed without their
row in `ASSET-LICENSES.md`; the row is now added (CC BY 3.0, attribution shown in Library).

## 3. Manual checks (product owner)

| Check                                                                                                                                    | Result | Notes |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| M-301 Rate each sound 1–5 (piano must be ≥ 4, others ≥ 3): Piano __ EP __ Tonewheel __ Pipe organ __ Strings __ Choir __ Pads __ Bass __ |        |       |
| M-302 Grand Piano: hold sustain, play fast glissandi up and down: no dropouts                                                            |        |       |

## 4. Known limitations

- Strings, choir and electric piano are synthesised, not sampled. They will sound less
  realistic than the piano; sampled versions need CC0/CC-BY sources (follow-up).
- The piano uses about 200 MB of RAM once loaded.

## 5. Sign-off

- [ ] Exit Gate 3 criteria met
- Product owner: ____________ Date: ________
