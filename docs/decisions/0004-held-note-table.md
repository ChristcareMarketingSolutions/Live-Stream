# ADR-0004: The held-note table owns note release

- Status: Accepted
- Date: 2026-11-18
- Requirements affected: LIVE-031, MIDI-002, NFR-04

## Context

Releasing a note by "the current patch's layers" causes stuck notes when the patch,
transpose or zones change while a key is held, or when a device disconnects.

## Decision

Every note-on records `(sourceId, channel, note) → [voice handles]`. Note-off, sustain
release, device disconnect and panic release exactly those voices (docs/02 §5, docs/04 §4).

## Consequences

A small amount of bookkeeping per note; enables mandatory fuzz test T-207.
