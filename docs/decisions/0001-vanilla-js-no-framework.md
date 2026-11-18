# ADR-0001: Vanilla JavaScript ES modules, no UI framework

- Status: Accepted
- Date: 2026-11-18
- Requirements affected: APP-001, NFR-05

## Context

The core of the product is a real-time audio engine. The UI is a set of workstation panels
whose hot paths (meters, keyboard highlights) are drawn on canvas outside any framework's
render cycle anyway.

## Options considered

1. React/Vue/Svelte: rich component model, but a virtual-DOM/reactivity runtime on the main
   thread, which also delivers MIDI messages, plus more dependencies and build complexity.
2. Vanilla ES modules with a tiny `h()` DOM helper, a store and an event bus: full control
   over when the DOM updates, smallest bundle, no framework churn.

## Decision

Option 2. JSDoc annotations provide type hints without a TypeScript build step.

## Consequences

More hand-written UI code. Views must re-render deliberately; heavy visuals use canvas +
requestAnimationFrame. Revisit only if the DAW UI (Phase 8) becomes unmanageable.
