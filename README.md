# STAGECRAFT (Live-Stream)

A browser-based live-performance keyboard workstation, in the spirit of MainStage, with a mini-DAW to follow.
Connect a MIDI keyboard, pick a patch such as "Worship Piano + Pad", and play: layers, splits, setlists, and
sustain, all running in the browser and hosted on GitHub Pages.

**Status:** Phases 1–4 delivered (live keyboard workstation: piano, organs, strings, choir, pads, bass; layers, splits, setlists; MIDI keyboards; offline instrument cache). Awaiting hardware checks before V1 hardening (Phase 5).

**Live site:** https://christcaremarketingsolutions.github.io/Live-Stream/

## Run locally

Requires Node 20.19+ (22 recommended).

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run test:e2e   # browser tests (run `npx playwright install chromium` once first)
npm run build      # production build in dist/
```

## Deploy

Every push to `main` builds and deploys to GitHub Pages (`.github/workflows/deploy.yml`).
One-time setup: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Supported browsers: desktop Chrome and Edge. Safari has no Web MIDI support.

## Plan documents

- [Plan overview](docs/00-plan-overview.md): start here
- [Product specification](docs/01-product-spec.md)
- [Architecture](docs/02-architecture.md)
- [Roadmap and work programme](docs/03-roadmap.md)
- [Audio and MIDI engineering rules](docs/04-audio-midi-engineering.md)
- [Instruments, samples and licensing](docs/05-instruments-and-samples.md)
- [Testing and QA](docs/06-testing-qa.md)
- [Prompts for Claude](docs/07-prompts.md)
- [Risk register](docs/08-risk-register.md)

Rules for AI-assisted development are in [CLAUDE.md](CLAUDE.md).
