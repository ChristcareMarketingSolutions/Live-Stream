# Development Log

Newest entries first. Template: `docs/templates/dev-log-entry.md`.

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
