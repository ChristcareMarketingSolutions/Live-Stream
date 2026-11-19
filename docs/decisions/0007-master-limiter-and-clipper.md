# ADR-0007: Master safety limiter = fast compressor + soft clipper

- Status: Accepted
- Date: 2026-11-19
- Requirements affected: AUD-004, NFR (no clipping)

## Context

AUD-004 asks for a master safety limiter on by default. Test T-102 (64 voices at full
velocity) showed the browser's DynamicsCompressorNode alone overshoots: peaks reached
+1.2 dBFS because it is not a look-ahead limiter.

## Options considered

1. Look-ahead limiter in an AudioWorklet: best quality, adds a few ms of latency
   and more code on the audio thread.
2. DynamicsCompressor (ratio 20, 2 ms attack) followed by a WaveShaper soft clipper:
   zero added latency, guaranteed ceiling, mild saturation only on extreme peaks.

## Decision

Option 2. The clipper is linear below 0.8 (−1.9 dBFS) and saturates smoothly towards
0.977 (−0.2 dBFS). Normal playing (single notes peak near −12 dBFS, see levels.js)
never reaches the knee. Oversampling is off so the filter cannot overshoot the ceiling.

## Consequences

Very dense, loud playing can sound slightly saturated instead of clipping harshly.
Revisit with a look-ahead worklet if users report audible distortion.
