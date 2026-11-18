# ADR-0002: Raw Web Audio for the live engine; Tone.js only for DAW scheduling

- Status: Accepted
- Date: 2026-11-18
- Requirements affected: AUD-001..006, LIVE-030..033, DAW-001

## Context

The live path (MIDI in → voice start) must be minimal and fully under our control:
voice allocation, held-note release and patch switching are custom logic.

## Options considered

1. Tone.js for everything: fast start, but its instrument/voice abstractions would sit
   between our held-note table and the AudioNodes, and add ~150 KB.
2. Raw Web Audio for live; consider Tone.js Transport in Phase 8 only.

## Decision

Option 2. Tone.js is **not** installed in Phase 0. Phase 8 will decide (new ADR) between
Tone.Transport and our own lookahead scheduler.

## Consequences

We write our own envelopes, voice pool and effects (docs/04). Every node we create is ours
to dispose of.
