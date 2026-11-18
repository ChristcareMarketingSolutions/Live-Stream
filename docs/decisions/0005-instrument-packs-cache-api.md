# ADR-0005: Instrument packs as separate assets cached with the Cache API

- Status: Accepted
- Date: 2026-11-18
- Requirements affected: INS-010, APP-004, NFR-05

## Context

Sampled instruments are tens of MB each; bundling them would make first load slow and
waste bandwidth for users who never open some instruments.

## Decision

Each sampled instrument is a pack (manifest + encoded samples, docs/05 §2) fetched on
demand from the same origin and stored in the Cache API (`stagecraft-packs-v1`), so it
works offline after install. Concert files reference packs by id only.

## Consequences

A Library view to install/remove packs (Phase 3). Hosting limits per docs/05 §5.
