# 04 — Audio & MIDI Engineering Rules

This is the "method statement" for the real-time parts. Follow it exactly; deviations need an ADR.

## 1. Latency budget (what we control vs. what we don't)

| Stage | Typical | Controlled by us? |
|---|---|---|
| Keyboard USB/MIDI transmission | 1–3 ms | No |
| Browser delivers MIDI message to main thread | 0–10 ms (worse if main thread busy) | **Partly** — keep the main thread free |
| Our handling (route, start voice) | target < 1 ms | **Yes** |
| Audio render quantum (128 frames @ 48 kHz) | 2.7 ms | No |
| Output buffer (OS / browser, `latencyHint`) | 10–40 ms on Windows shared mode | Partly (`latencyHint: 'interactive'`) |

Implications:
- Main-thread jank directly delays notes. Never run heavy work (JSON parsing of big files, decoding, layout thrash) while playing.
  Sample decoding happens at load time, not when playing.
- Display `ctx.baseLatency` and `ctx.outputLatency` in Settings so the user can see the hardware share.
- Tip for users (put in user guide): on Windows, use the laptop's/audio interface's native driver, close other audio apps, use wired output — Bluetooth headphones add 100–250 ms.

## 2. AudioContext

- Create once, on first user gesture: `new AudioContext({ latencyHint })`. Do not force `sampleRate`; let the device choose.
- Listen to `statechange`; if `suspended`/`interrupted` show the start overlay.
- Changing `latencyHint` requires a new context → full graph rebuild → only allowed when no notes are sounding; warn the user.
- Output device: `ctx.setSinkId` if available, else hide the option.

## 3. Voices

- A voice = source node(s) + amp `GainNode` (+ optional filter). Connected to the instrument's output bus.
- Note start: `src.start(t)`, gain from 0 to peak with ≥ 2 ms attack ramp (prevents clicks) even for "instant" sounds.
- Note release: `gain.cancelAndHoldAtTime(t)` (fallback: `cancelScheduledValues` + `setValueAtTime(currentValue)`), then
  `setTargetAtTime(0, t, releaseTime/5)`; schedule `src.stop(t + releaseTime*1.5)`; on `ended` disconnect and return to pool.
- Voice stealing (pure function, unit-tested): when at limit choose, in order:
  1) oldest voice already in release phase; 2) oldest sustained voice (key up, pedal down); 3) oldest held voice.
  Never steal the voice started by the current event.
  Stolen voice gets a 5 ms fade, not a hard cut.
- Same note retriggered on same layer while still sounding (sustain): allow up to 2 overlapping voices of the same note per layer, then steal the oldest of them (piano-like behaviour, avoids build-up).

## 4. Held-note table — see architecture §5. Mandatory tests

1. Note on → patch switch → note off ⇒ voice of old patch released.
2. Note on → transpose change → note off ⇒ correct (originally transposed) voice released.
3. Note on (device A) → device A disconnect ⇒ released.
4. Two devices play the same note number ⇒ independent.
5. Note on twice without note off ⇒ first released before second starts (no orphan).
6. 10 000-event random fuzz ⇒ table empty and 0 voices after final all-off.

## 5. Sustain state machine (per layer)

States per voice: `held` → (key up & pedal up) `released`; `held` → (key up & pedal down) `sustained` → (pedal up) `released`;
`sustained` → (same key pressed again) old voice released (piano re-strike), new voice `held`.
Layers with `respond.sustain = false` ignore the pedal (useful for pads layered with piano... or the reverse).

## 6. Continuous controllers

- Pitch bend: 14-bit, centre 8192 → semitones × layer bend range; apply via `detune` (cents) on sources, smoothed with `setTargetAtTime(…, 0.005)`.
- Mod wheel: instrument-defined (vibrato depth, rotary speed toggle at threshold 64 for organ, filter for synths).
- Expression (CC11) and CC7: multiply a per-layer `expression` gain node; smooth 10 ms.
- All parameter changes (faders, knobs) are de-zippered with `setTargetAtTime(v, now, 0.01)`.

## 7. Gain staging and protection

- Instrument outputs normalised so a vel-100 single note ≈ −18 dBFS peak.
- Layer volume default 0 dB; master default −6 dB; limiter ceiling −1 dBFS, fast attack, 50–100 ms release.
- Reverb return default −8 dB; delay feedback hard-clamped ≤ 0.95.
- Meters: peak with 1.5 s hold + clip LED latched until clicked.

## 8. Patch switching sequence (must stay < 50 ms when loaded)

1. Resolve target patch (pure).
2. Ensure instruments in pool (should already be preloaded; if not, start loading and show "loading" in Live view; old patch keeps sounding until ready — never silence).
3. Build or reuse layer chains (connect channel strips; cheap).
4. Atomically set `activePatchId` in the patch engine (new note-ons now go to new layers).
5. Mark old patch's chains as `draining`; when they have 0 voices + release time elapsed → disconnect.
6. Emit `patch:changed`; preload neighbours in idle time (`requestIdleCallback` fallback `setTimeout`).

Instrument time: `performance.now()` before step 1 and after step 4, logged in a ring buffer viewable in Settings → Diagnostics.

## 9. Memory

- Decoded size ≈ seconds × sampleRate × channels × 4 bytes (≈ 384 KB per stereo second at 48 kHz).
- The pool keeps a running total; budget default 700 MB (setting). Unload LRU instruments not in current/prev/next patch above budget.
- Dispose: stop voices, disconnect all nodes, drop buffer references so GC can reclaim.

## 10. AudioWorklets

- Files in `src/audio/worklets/`, loaded with `ctx.audioWorklet.addModule(new URL('./x.js', import.meta.url))` so Vite emits them correctly with the base path.
- No allocations in `process()`; preallocate typed arrays. Communicate with `port.postMessage` at ≤ 30 Hz.
- Required: meter, limiter (or DynamicsCompressor fallback per ADR), recorder (V4).

## 11. MIDI specifics

- `navigator.requestMIDIAccess({ sysex: false })`. Handle missing API (Safari) and `SecurityError` (permission denied).
- Attach `onmidimessage` to every selected input; on `statechange` re-scan and release notes of disconnected inputs.
- Ignore active sensing (0xFE) and clock (0xF8) in V1 (clock may be used in V3 sync later).
- Program change numbers in UI are 1–128; internally 0–127. Document this.
- Use `event.timeStamp` (DOMHighResTimeStamp) for diagnostics and DAW recording; live playback starts at `ctx.currentTime` (no artificial delay).

## 12. Timing for the DAW (V3+)

- Lookahead scheduler: tick every ~25 ms (Worker timer to avoid background-tab throttling), schedule events within the next 100 ms using `ctx` time.
- Map `performance.now()` → `ctx` time via `ctx.getOutputTimestamp()` for recording alignment.
- Never use `setTimeout` to trigger notes directly.
