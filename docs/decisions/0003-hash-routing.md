# ADR-0003: Hash-based routing

- Status: Accepted
- Date: 2026-11-18
- Requirements affected: APP-001, APP-003

## Context

GitHub Pages serves static files with no single-page-app fallback; a refresh on
`/Live-Stream/settings` would 404.

## Decision

Routes are hashes (`#/live`, `#/settings`). Unknown or not-yet-built routes fall back to
`#/live` and the address bar is normalised with `history.replaceState`.

## Consequences

URLs contain `#/`. Refresh and deep links always work on Pages and offline.
