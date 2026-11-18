import { describe, it, expect, vi } from 'vitest';
import { createEventBus } from '../../src/core/event-bus.js';

describe('event bus', () => {
  it('delivers payloads to subscribers', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.on('patch:changed', fn);
    bus.emit('patch:changed', { patchId: 'p1' });
    expect(fn).toHaveBeenCalledWith({ patchId: 'p1' });
  });

  it('unsubscribes and cleans up empty types', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    const off = bus.on('x', fn);
    off();
    bus.emit('x');
    expect(fn).not.toHaveBeenCalled();
    expect(bus.listenerCount('x')).toBe(0);
  });

  it('once fires a single time', () => {
    const bus = createEventBus();
    const fn = vi.fn();
    bus.once('x', fn);
    bus.emit('x', 1);
    bus.emit('x', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  it('a throwing handler does not stop others and is reported as an error event', () => {
    const bus = createEventBus();
    const errors = vi.fn();
    const after = vi.fn();
    bus.on('error', errors);
    bus.on('x', () => {
      throw new Error('boom');
    });
    bus.on('x', after);
    bus.emit('x');
    expect(after).toHaveBeenCalled();
    expect(errors).toHaveBeenCalledWith(expect.objectContaining({ code: 'handler-failed' }));
  });

  it('handlers may unsubscribe during emit without skipping others', () => {
    const bus = createEventBus();
    const second = vi.fn();
    const offFirst = bus.on('x', () => offFirst());
    bus.on('x', second);
    bus.emit('x');
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('rejects non-function handlers', () => {
    expect(() => createEventBus().on('x', null)).toThrow(TypeError);
  });
});
