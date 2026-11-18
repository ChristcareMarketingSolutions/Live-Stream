/**
 * Typed publish/subscribe bus used for communication between modules
 * (see docs/02-architecture.md §7). A failing handler never stops other
 * handlers; its error is re-published as an `error` event.
 */

/**
 * @typedef {(payload: any) => void} Handler
 * @typedef {{
 *   on: (type: string, fn: Handler) => () => void,
 *   once: (type: string, fn: Handler) => () => void,
 *   emit: (type: string, payload?: any) => void,
 *   listenerCount: (type: string) => number,
 *   clear: () => void,
 * }} EventBus
 */

/** @returns {EventBus} */
export function createEventBus() {
  /** @type {Map<string, Set<Handler>>} */
  const handlers = new Map();

  function on(type, fn) {
    if (typeof fn !== 'function') throw new TypeError(`Handler for "${type}" must be a function`);
    let set = handlers.get(type);
    if (!set) {
      set = new Set();
      handlers.set(type, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
      if (set.size === 0) handlers.delete(type);
    };
  }

  function once(type, fn) {
    const off = on(type, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  function emit(type, payload) {
    const set = handlers.get(type);
    if (!set) return;
    // Copy so handlers may unsubscribe while we iterate.
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        if (type === 'error') {
          console.error('Error handler failed', err);
        } else {
          emit('error', {
            code: 'handler-failed',
            message: `Handler for "${type}" threw`,
            detail: err,
          });
        }
      }
    }
  }

  return {
    on,
    once,
    emit,
    listenerCount: (type) => handlers.get(type)?.size ?? 0,
    clear: () => handlers.clear(),
  };
}
