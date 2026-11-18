/**
 * Detects the browser features STAGECRAFT depends on. Pure: takes the global
 * object as a parameter so it can be unit-tested with fakes.
 */

/**
 * @typedef {{ id: string, label: string, ok: boolean, required: boolean, help: string }} Capability
 */

/**
 * @param {any} g usually `window`
 * @returns {Capability[]}
 */
export function detectCapabilities(g) {
  const AC = g.AudioContext ?? g.webkitAudioContext;
  return [
    {
      id: 'secure-context',
      label: 'Secure context (HTTPS)',
      ok: !!g.isSecureContext,
      required: true,
      help: 'MIDI and audio worklets only work over HTTPS or on localhost.',
    },
    {
      id: 'web-audio',
      label: 'Web Audio',
      ok: typeof AC === 'function',
      required: true,
      help: 'Needed for all sound. Use a current Chrome or Edge.',
    },
    {
      id: 'audio-worklet',
      label: 'AudioWorklet',
      ok: typeof g.AudioWorkletNode === 'function',
      required: true,
      help: 'Needed for meters and the safety limiter.',
    },
    {
      id: 'web-midi',
      label: 'Web MIDI',
      ok: typeof g.navigator?.requestMIDIAccess === 'function',
      required: false,
      help: 'Needed for external MIDI keyboards. Supported in Chrome and Edge; not in Safari.',
    },
    {
      id: 'indexeddb',
      label: 'IndexedDB storage',
      ok: !!g.indexedDB,
      required: true,
      help: 'Needed to save concerts. Private/incognito windows may block it.',
    },
    {
      id: 'service-worker',
      label: 'Offline support (service worker)',
      ok: !!g.navigator?.serviceWorker,
      required: false,
      help: 'Needed to use the app without internet.',
    },
    {
      id: 'output-select',
      label: 'Audio output selection',
      ok: typeof AC === 'function' && typeof AC.prototype?.setSinkId === 'function',
      required: false,
      help: 'Lets you choose the speaker/interface inside the app. Otherwise use the system default.',
    },
  ];
}

/** @param {Capability[]} caps */
export function summarise(caps) {
  const missingRequired = caps.filter((c) => c.required && !c.ok);
  const missingOptional = caps.filter((c) => !c.required && !c.ok);
  return {
    ready: missingRequired.length === 0,
    missingRequired: missingRequired.map((c) => c.id),
    missingOptional: missingOptional.map((c) => c.id),
  };
}
