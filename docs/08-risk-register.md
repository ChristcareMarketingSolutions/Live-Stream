# 08 — Risk Register

Likelihood (L) and Impact (I): 1 = low, 5 = high. Score = L × I. Review at every exit gate.

| ID | Risk | L | I | Score | Mitigation | Owner |
|---|---|---|---|---|---|---|
| R-01 | End-to-end latency on Windows too high for comfortable playing (no ASIO in browsers). | 3 | 5 | 15 | `latencyHint: interactive`; keep main thread idle; measure early (Phase 2); user guide on drivers/wired output; document limits honestly. | Claude / PO |
| R-02 | Stuck notes during live use. | 2 | 5 | 10 | Held-note table design, fuzz tests, disconnect handling, Panic button + Esc. | Claude |
| R-03 | No properly licensed, good-quality samples for EP or choir. | 3 | 3 | 9 | Synthesis fallbacks (FM EP, formant choir); log licences; allow user-imported samples (V2). | PO / Claude |
| R-04 | Using samples with an unclear licence → takedown/legal exposure. | 2 | 4 | 8 | ASSET-LICENSES gate before commit; CC0/CC-BY only; credits screen. | PO |
| R-05 | RAM exhaustion with several sampled instruments loaded (browser tab crash). | 3 | 4 | 12 | Memory budget + LRU unload; Lite piano; show memory in Library. | Claude |
| R-06 | Browser auto-update changes Web Audio/MIDI behaviour. | 2 | 3 | 6 | CI on latest Chromium; release notes check; keep fallbacks. | Claude |
| R-07 | Main-thread jank from UI (meters, keyboard drawing) delays notes. | 3 | 4 | 12 | Canvas + rAF batching; meters ≤ 30 Hz; performance budget tests. | Claude |
| R-08 | Service worker serves stale app version mid-service. | 2 | 4 | 8 | Never auto-activate; explicit "Update" prompt; versioned caches. | Claude |
| R-09 | GitHub Pages size/bandwidth limits reached by sample packs. | 2 | 3 | 6 | Budgets in 05; ADR for external host before 300 MB. | PO |
| R-10 | Scope creep into DAW before live engine is stable. | 4 | 3 | 12 | Phase gates; change control; CLAUDE.md scope rules. | PO |
| R-11 | Claude reports features as working without real-hardware verification. | 3 | 4 | 12 | Honesty rules in CLAUDE.md; manual M-checks signed by PO at every gate. | PO |
| R-12 | Data loss of concerts (browser storage cleared). | 2 | 4 | 8 | `storage.persist()`; export reminders; one-click backup of all concerts. | Claude |
| R-13 | Firefox/Safari users expect MIDI. | 3 | 2 | 6 | Clear unsupported notice; on-screen/QWERTY play still works. | Claude |
