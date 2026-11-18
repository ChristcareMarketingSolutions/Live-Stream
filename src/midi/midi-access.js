import { parseMidi } from './midi-parser.js';

/**
 * Web MIDI device management (MIDI-001, MIDI-002, MIDI-007, MIDI-012).
 * Emits `midi:devices` and calls `onEvent` for every parsed message from an
 * enabled input. On disconnect it calls `onDisconnect(sourceId)` so the patch
 * engine can release that device's notes.
 */
export function createMidiAccess({ bus, onEvent, onDisconnect, getEnabled }) {
  let access = null;
  let status = 'idle'; // idle | unsupported | requesting | ready | denied | error
  let error = null;
  const attached = new Set();
  const lastActivity = new Map();

  function devices() {
    if (!access) return [];
    return [...access.inputs.values()].map((i) => ({
      id: i.id,
      name: i.name || 'MIDI input',
      manufacturer: i.manufacturer || '',
      state: i.state,
      enabled: isEnabled(i.id),
      lastActivity: lastActivity.get(i.id) ?? 0,
    }));
  }

  const isEnabled = (id) => {
    const enabled = getEnabled();
    return enabled === 'all' || (Array.isArray(enabled) && enabled.includes(id));
  };

  const emit = () => bus.emit('midi:devices', { status, error, devices: devices() });

  function handleMessage(input, e) {
    if (!isEnabled(input.id)) return;
    const ev = parseMidi(e.data, input.id, e.timeStamp);
    if (!ev) return;
    lastActivity.set(input.id, performance.now());
    onEvent(ev);
  }

  function attachAll() {
    for (const input of access.inputs.values()) {
      if (input.state === 'connected' && !attached.has(input.id)) {
        input.onmidimessage = (e) => handleMessage(input, e);
        attached.add(input.id);
      }
    }
  }

  async function request() {
    if (typeof navigator.requestMIDIAccess !== 'function') {
      status = 'unsupported';
      emit();
      return;
    }
    status = 'requesting';
    emit();
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
      status = 'ready';
      attachAll();
      access.onstatechange = (e) => {
        const port = e.port;
        if (port.type !== 'input') return;
        if (port.state === 'disconnected') {
          attached.delete(port.id);
          onDisconnect(port.id);
        } else {
          attachAll();
        }
        emit();
      };
    } catch (err) {
      status =
        err?.name === 'SecurityError' || err?.name === 'NotAllowedError' ? 'denied' : 'error';
      error = err?.message ?? String(err);
    }
    emit();
  }

  return {
    request,
    devices,
    refresh: emit,
    /** Re-evaluate enabled inputs; release notes from inputs just disabled. */
    applyEnabled(previouslyEnabledIds) {
      for (const id of previouslyEnabledIds) if (!isEnabled(id)) onDisconnect(id);
      emit();
    },
    get status() {
      return status;
    },
  };
}
