# Phase Completion Certificate — Phase 2: Keyboard & MIDI

| Item           | Detail                                                      |
| -------------- | ----------------------------------------------------------- |
| Date submitted | 2026-11-19                                                  |
| Commit         | see `main` (Phase 2 certificate commit)                     |
| Deployed URL   | https://christcaremarketingsolutions.github.io/Live-Stream/ |

## 1. Requirement compliance

| Req ID   | Status | Evidence                                              | Notes                                                            |
| -------- | ------ | ----------------------------------------------------- | ---------------------------------------------------------------- |
| MIDI-001 | Done   | e2e "MIDI-001/012"; Settings → MIDI keyboard          | Real devices: manual check M-201.                                |
| MIDI-002 | Done   | unit patch-engine "device disconnect"; e2e "MIDI-002" | Unplugging releases that device's notes and pedal.               |
| MIDI-003 | Done   | unit midi-parser; e2e T-205                           | Velocity-0 note-on = note-off.                                   |
| MIDI-004 | Done   | unit sustain tests; e2e "MIDI-004", T-206 (Space)     |                                                                  |
| MIDI-005 | Done   | unit bend/mod/expression; e2e "MIDI-005/006"          | Bend range per layer (default ±2).                               |
| MIDI-006 | Done   | e2e "MIDI-005/006"                                    | Program change 1–128 selects patch.                              |
| MIDI-007 | Done   | e2e "MIDI-007"                                        | Monitor shows last 50 messages; activity LED per device.         |
| MIDI-008 | Done   | unit curves; e2e "MIDI-007…MIDI-008"                  | Normal / light / heavy / fixed.                                  |
| MIDI-010 | Done   | e2e "MIDI-010"                                        | 88 keys, velocity by press height, highlights all sources.       |
| MIDI-011 | Done   | e2e T-206                                             | Z/X octave, C/V velocity, Space sustain, ignored in text fields. |
| MIDI-012 | Done   | e2e "MIDI-001/012"                                    | Unsupported (Safari) and permission-refused messages.            |

## 2. Automated tests

| Suite                      | Passed | Failed | Skipped |
| -------------------------- | ------ | ------ | ------- |
| Unit (Vitest)              | 94     | 0      | 0       |
| E2E (Playwright, Chromium) | 24     | 0      | 0       |

Issues found and fixed in this phase:

- Stress test (T-207) showed three pad layers could hold 144 long-release voices, overloading
  the CPU. Polyphony is now per instrument (piano 64, organs 40–48, pads/strings/choir 32, bass 16).
- CI runner fonts made the status bar 2 px too wide on phones; status items now shrink with "…".

## 3. Manual checks (product owner, with your MIDI keyboard)

Machine / keyboard: ____________________

| Check                                                                                                     | Result | Notes |
| --------------------------------------------------------------------------------------------------------- | ------ | ----- |
| M-201 Settings → MIDI keyboard → Connect: keyboard listed; notes play; soft/hard playing sounds different |        |       |
| M-202 Unplug USB while holding notes: sound stops; plug back in: works without reload                     |        |       |
| M-203 Sustain pedal holds and releases (if it works backwards, tell me: polarity setting)                 |        |       |
| M-204 Pitch bend bends; mod wheel on Church Organ / Tonewheel changes the sound                           |        |       |
| M-205 Settings → Diagnostics: note the patch switch time; play and judge the delay (latency)              |        |       |

## 4. Known limitations

- Headless test browsers have no MIDI hardware, so device connection is verified manually.
- Half-pedalling is not supported in V1 (pedal is on/off at 64).

## 5. Sign-off

- [ ] Exit Gate 2 criteria met
- Product owner: ____________ Date: ________
