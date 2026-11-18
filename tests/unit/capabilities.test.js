import { describe, it, expect } from 'vitest';
import { detectCapabilities, summarise } from '../../src/core/capabilities.js';

function fakeAudioContext({ sink = true } = {}) {
  function AC() {}
  if (sink) AC.prototype.setSinkId = () => {};
  return AC;
}

const chromeLike = {
  isSecureContext: true,
  AudioContext: fakeAudioContext(),
  AudioWorkletNode: function AudioWorkletNode() {},
  indexedDB: {},
  navigator: { requestMIDIAccess: () => {}, serviceWorker: {} },
};

describe('capabilities', () => {
  it('reports a full-featured browser as ready', () => {
    const caps = detectCapabilities(chromeLike);
    expect(caps.every((c) => c.ok)).toBe(true);
    expect(summarise(caps)).toEqual({ ready: true, missingRequired: [], missingOptional: [] });
  });

  it('treats missing Web MIDI (e.g. Safari) as optional', () => {
    const g = { ...chromeLike, navigator: { serviceWorker: {} } };
    const s = summarise(detectCapabilities(g));
    expect(s.ready).toBe(true);
    expect(s.missingOptional).toContain('web-midi');
  });

  it('is not ready without a secure context or Web Audio', () => {
    const s = summarise(
      detectCapabilities({ ...chromeLike, isSecureContext: false, AudioContext: undefined }),
    );
    expect(s.ready).toBe(false);
    expect(s.missingRequired).toEqual(expect.arrayContaining(['secure-context', 'web-audio']));
  });

  it('accepts the prefixed webkitAudioContext', () => {
    const g = { ...chromeLike, AudioContext: undefined, webkitAudioContext: fakeAudioContext() };
    expect(detectCapabilities(g).find((c) => c.id === 'web-audio').ok).toBe(true);
  });

  it('detects missing output-device selection', () => {
    const g = { ...chromeLike, AudioContext: fakeAudioContext({ sink: false }) };
    expect(detectCapabilities(g).find((c) => c.id === 'output-select').ok).toBe(false);
  });
});
