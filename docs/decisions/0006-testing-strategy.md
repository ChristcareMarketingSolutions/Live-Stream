# ADR-0006: Vitest for logic, Playwright (Chromium) for browser and audio tests

- Status: Accepted
- Date: 2026-11-18
- Requirements affected: all (Definition of Done)

## Context

Most correctness risks (routing, sustain, voice stealing, migrations) are pure logic;
audio output can be checked deterministically with OfflineAudioContext in a real browser.

## Decision

- Vitest (Node) for pure modules in `tests/unit`.
- Playwright + Chromium for `tests/e2e`, run against the production build served under the
  GitHub Pages subpath (`/Live-Stream/`) so asset-path mistakes fail in CI.
- Audio assertions via OfflineAudioContext inside the page (from Phase 1).
- Sound quality, latency and physical MIDI are manual checks signed by the product owner.

## Consequences

CI installs Chromium (~1 minute). Traces off by default; enable per test to debug.
