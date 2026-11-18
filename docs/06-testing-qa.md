# 06 — Testing & Quality Assurance

## 1. Test layers

| Layer | Tool | What | When |
|---|---|---|---|
| Unit | Vitest (node/jsdom) | Pure logic: parser, router, held notes, sustain, voice stealing, velocity curves, schema validation, migrations, quantise | Every commit (CI) |
| Audio render | Playwright + Chromium page running `OfflineAudioContext` | Instruments/effects produce expected signal: not silent, no NaN, peak < 0 dBFS, release decays, no clicks | Every commit (CI) |
| End-to-end | Playwright (Chromium), `--trace off` | User flows via UI + injected MIDI (`window.__stagecraft.debug.injectMidi`) | Every commit (CI) |
| Manual hardware | Product owner | Real keyboard, real speakers, latency, sound quality | Each exit gate |
| Soak | Playwright scripted, long run | Memory/stability over hours | Phase 5, before each release |

Audio tests cannot assess "sounds good" — that is a manual check (M-xxx) and must be listed as such.

## 2. Audio-render assertions (helpers in `tests/helpers/audio-assert.js`)

- `assertNotSilent(buffer, minRmsDb = -50)`
- `assertNoNaN(buffer)`
- `assertPeakBelow(buffer, dBFS = -0.1)`
- `assertDecaysTo(buffer, fromTime, toDb = -80, within = seconds)`
- `assertNoClicks(buffer, maxDelta = 0.2)` — max sample-to-sample jump around note boundaries
- `assertPitch(buffer, expectedHz, toleranceCents = 10)` — zero-crossing or autocorrelation estimate

## 3. Automated test catalogue (initial; extend per phase)

| ID | Test |
|---|---|
| T-001 | App loads with no console errors/warnings |
| T-002 | Hash routes work; reload on `#/settings` restores view |
| T-003 | Production build served under `/Live-Stream/` subpath loads all assets (vite preview with base) |
| T-101..106 | See roadmap Phase 1 |
| T-201..207 | See roadmap Phase 2 (T-207 = fuzz/stress test, aka T-STRESS) |
| T-301..305 | See roadmap Phase 3 |
| T-401..409 | See roadmap Phase 4 |
| T-501..505 | See roadmap Phase 5 |

## 4. Manual hardware checklist (product owner)

Record results in the Phase Completion Certificate. Test machine: note laptop model, OS, browser version, audio output, MIDI keyboard model.

**Audio**
- [ ] M-101 Click "Start audio" → clean tone from test panel, no crackle.
- [ ] M-102 Master meter moves; clip LED lights when driven hard; limiter prevents harsh distortion.
- [ ] M-103 Resize window / switch tabs while holding a chord → no dropouts.

**MIDI**
- [ ] M-201 Keyboard appears in Settings → MIDI; notes play; velocity is musical (soft/hard).
- [ ] M-202 Unplug USB while holding notes → sound stops (releases); replug → works without reload.
- [ ] M-203 Sustain pedal holds/release; pedal polarity correct (if inverted, note it — add polarity setting).
- [ ] M-204 Pitch bend and mod wheel do something sensible on synth/organ.
- [ ] M-205 Added latency readout in Diagnostics ≤ 3 ms median.

**Instruments (rate 1–5)**
- [ ] M-301 Piano ___ EP ___ Tonewheel ___ Pipe organ ___ Strings ___ Choir ___ Pads ___ Bass ___
- [ ] M-302 Hold sustain, play 64 notes fast glissandi → no dropouts.

**Live**
- [ ] M-401 Scenario S1 (Sunday Worship) complete run, including patch changes while holding chords and with pedal down.
- [ ] M-402 Scenario S2 (split + program change from keyboard).

**Release**
- [ ] M-501 Full rehearsal of a real setlist.
- [ ] M-502 Wi-Fi off → app + installed instruments still load and play.
- [ ] M-503 Latency measurement (method below) recorded.

## 5. How to measure end-to-end latency (NFR-02)

Simple method (phone): set phone to slow-motion video (240 fps). Film the key being struck and the speaker/headphone cone or a VU meter of
an audio interface; count frames between key bottom and sound onset (1 frame ≈ 4.2 ms). Repeat 10×, report median.

Audio method (better): put a microphone next to the keys and the speaker; record in Audacity; strike a key hard (the mechanical click is
recorded) and measure the time between the click transient and the note onset. Repeat 10×, median.

## 6. Bug reports

Template: steps to reproduce, expected, actual, browser/OS, MIDI device, concert export attached, Diagnostics screenshot.
Every fixed bug gets a regression test where automatable.
