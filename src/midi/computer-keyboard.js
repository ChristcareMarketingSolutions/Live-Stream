import { clamp } from '../core/math.js';

/**
 * Computer keyboard as a MIDI source (MIDI-011). Two rows like a piano:
 *   white keys  A S D F G H J K L ;  → C D E F G A B C D E
 *   black keys  W E   T Y U   O P    → C# D#  F# G# A#  C# D#
 * Z / X: octave down / up · C / V: velocity down / up · hold Space: sustain.
 * Uses KeyboardEvent.code so it works on any keyboard layout.
 */
export const KEY_OFFSETS = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
};

/** True when keystrokes belong to a form field, not the instrument. */
export function isTypingTarget(el) {
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
  if (tag === 'INPUT') {
    const type = (el.type || 'text').toLowerCase();
    return !['range', 'checkbox', 'radio', 'button', 'submit'].includes(type);
  }
  return false;
}

export function createComputerKeyboard({ send, onStateChange, target = window }) {
  let octave = 4; // A-key = C4 (middle C)
  let velocity = 96;
  let enabled = true;
  const down = new Map(); // code → note actually started
  let sustain = false;

  const state = () => ({ octave, velocity, enabled, sustain });
  const changed = () => onStateChange?.(state());

  function onKeyDown(e) {
    if (!enabled || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
    if (e.code === 'Space') {
      // Space on a focused button should still click it.
      if (e.target?.tagName === 'BUTTON') return;
      e.preventDefault();
      if (!e.repeat && !sustain) {
        sustain = true;
        send([0xb0, 64, 127]);
        changed();
      }
      return;
    }
    if (e.repeat) {
      if (e.code in KEY_OFFSETS) e.preventDefault();
      return;
    }
    switch (e.code) {
      case 'KeyZ':
        octave = clamp(octave - 1, 0, 8);
        return changed();
      case 'KeyX':
        octave = clamp(octave + 1, 0, 8);
        return changed();
      case 'KeyC':
        velocity = clamp(velocity - 16, 16, 127);
        return changed();
      case 'KeyV':
        velocity = clamp(velocity + 16, 16, 127);
        return changed();
    }
    const offset = KEY_OFFSETS[e.code];
    if (offset === undefined || down.has(e.code)) return;
    const note = (octave + 1) * 12 + offset;
    if (note > 127) return;
    e.preventDefault();
    down.set(e.code, note);
    send([0x90, note, velocity]);
  }

  function onKeyUp(e) {
    if (e.code === 'Space' && sustain) {
      sustain = false;
      send([0xb0, 64, 0]);
      changed();
      return;
    }
    const note = down.get(e.code);
    if (note === undefined) return;
    down.delete(e.code);
    send([0x80, note, 64]);
  }

  /** Window lost focus: release everything so nothing sticks. */
  function releaseAll() {
    for (const note of down.values()) send([0x80, note, 64]);
    down.clear();
    if (sustain) {
      sustain = false;
      send([0xb0, 64, 0]);
      changed();
    }
  }

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', releaseAll);

  return {
    state,
    releaseAll,
    setEnabled(on) {
      if (!on) releaseAll();
      enabled = on;
      changed();
    },
    dispose() {
      releaseAll();
      target.removeEventListener('keydown', onKeyDown);
      target.removeEventListener('keyup', onKeyUp);
      target.removeEventListener('blur', releaseAll);
    },
  };
}
