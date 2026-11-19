# Phase Completion Certificate — Phase 4: Live performance engine

| Item           | Detail                                                      |
| -------------- | ----------------------------------------------------------- |
| Date submitted | 2026-11-19                                                  |
| Commit         | see `main` (Phase 4 certificate commit)                     |
| Deployed URL   | https://christcaremarketingsolutions.github.io/Live-Stream/ |

## 1. Requirement compliance

| Req ID       | Status  | Evidence                                              | Notes                                                                                               |
| ------------ | ------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| LIVE-001     | Done    | e2e S2 (new from template), T-406; unit concert-model | New, rename, duplicate, delete, templates.                                                          |
| LIVE-002     | Partial | e2e "LIVE-002/003"; unit move tests                   | Reorder by ↑/↓ buttons (keyboard accessible); drag-and-drop not built.                              |
| LIVE-003     | Done    | e2e "LIVE-002/003"; unit 1–8 layers                   |                                                                                                     |
| LIVE-010     | Done    | e2e "LIVE-002/003"; unit note-router                  | Instrument, sound, volume, pan, mute/solo, transpose, octave, channel, velocity range, responds-to. |
| LIVE-011     | Done    | `channel-strip.js`; Edit view sliders                 | Reverb and delay sends per layer.                                                                   |
| LIVE-020     | Partial | e2e zone by note name; zone map on keyboard           | Zone edited by note name or Learn; drag handles on the zone map not built.                          |
| LIVE-021     | Done    | e2e "LIVE-021"                                        |                                                                                                     |
| LIVE-030     | Done    | e2e "LIVE-030"; MIDI program change (Phase 2 e2e)     | Click, ←/→, PageUp/PageDown, program change.                                                        |
| LIVE-031     | Done    | T-402, T-403; unit patch-engine; T-207 stress         | Held and sustained notes finish on the old patch.                                                   |
| LIVE-032     | Done    | `app.js` preloadNeighbours; chain reuse               | Next/previous patches prepared in idle time; shared samples never reloaded.                         |
| LIVE-033     | Done    | T-404                                                 | Switch time well under 50 ms (median and max) in the test browser.                                  |
| LIVE-040     | Done    | Live view; e2e LIVE-030                               | Large patch name, prev/next, set and position, layers, cue, meter, panic.                           |
| LIVE-041     | Done    | Edit view: patch tempo + cue notes                    |                                                                                                     |
| LIVE-042     | Done    | e2e "LIVE-042"                                        |                                                                                                     |
| MIX-001      | Done    | e2e "MIX-001"                                         | Hall/room/cathedral/plate reverb; tempo-synced delay.                                               |
| MIX-005      | Done    | `smoothSet` on every parameter                        |                                                                                                     |
| STO-001..004 | Done    | T-405, T-406, T-407; unit validation/migration        | Autosave 2 s, Ctrl+S, restore last concert, import/export, readable errors.                         |

## 2. Automated tests

| Suite                      | Passed | Failed | Skipped |
| -------------------------- | ------ | ------ | ------- |
| Unit (Vitest)              | 94     | 0      | 0       |
| E2E (Playwright, Chromium) | 43     | 0      | 0       |

Issue found and fixed in this phase: the roadmap status table and the Phase 0 sign-off had not
actually been updated (the formatter had re-spaced the text being replaced). Both corrected.

## 3. Manual checks (product owner, with your keyboard and speakers)

| Check                                                                                                                                          | Result | Notes |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----- |
| M-401 Scenario S1: play through all 8 Sunday Worship patches; switch while holding chords, and with the pedal down                             |        |       |
| M-402 Scenario S2: Edit → New… → Split gig template; bass left hand, piano + pad right hand; change patch from your keyboard's program buttons |        |       |

## 4. Known limitations

- Drag-and-drop reordering and draggable zone handles are not built (buttons and note names instead).
- Concerts live in this browser's storage: use Export regularly as a backup.

## 5. Sign-off

- [ ] Exit Gate 4 criteria met
- Product owner: ____________ Date: ________
