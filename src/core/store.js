/**
 * Minimal single-store state container (docs/02-architecture.md §8).
 * Reducers must be pure and return a new object when state changes.
 */

/**
 * @template S
 * @param {(state: S, action: {type: string}) => S} reducer
 * @param {S} initialState
 * @param {{ freeze?: boolean }} [options] freeze=true deep-freezes state to catch mutations (dev/test).
 */
export function createStore(reducer, initialState, { freeze = false } = {}) {
  let state = freeze ? deepFreeze(initialState) : initialState;
  let dispatching = false;
  /** @type {Set<(state: S, prev: S, action: {type: string}) => void>} */
  const listeners = new Set();

  function getState() {
    return state;
  }

  /** @param {{type: string}} action */
  function dispatch(action) {
    if (!action || typeof action.type !== 'string') {
      throw new TypeError('Actions must be objects with a string "type"');
    }
    if (dispatching) throw new Error('Reducers may not dispatch actions');
    let next;
    try {
      dispatching = true;
      next = reducer(state, action);
    } finally {
      dispatching = false;
    }
    if (next !== state) {
      const prev = state;
      state = freeze ? deepFreeze(next) : next;
      for (const fn of [...listeners]) fn(state, prev, action);
    }
    return action;
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  /**
   * Call onChange only when the selected slice changes.
   * @template T
   * @param {(state: S) => T} selector
   * @param {(value: T, prev: T) => void} onChange
   * @param {{ equals?: (a: T, b: T) => boolean, immediate?: boolean }} [opts]
   */
  function select(selector, onChange, { equals = Object.is, immediate = false } = {}) {
    let current = selector(state);
    if (immediate) onChange(current, undefined);
    return subscribe((s) => {
      const value = selector(s);
      if (!equals(value, current)) {
        const prev = current;
        current = value;
        onChange(value, prev);
      }
    });
  }

  return { getState, dispatch, subscribe, select };
}

/**
 * @param {Record<string, (state: any, action: {type: string}) => any>} reducers
 */
export function combineReducers(reducers) {
  const keys = Object.keys(reducers);
  return (state = {}, action) => {
    let changed = false;
    const next = {};
    for (const key of keys) {
      next[key] = reducers[key](state[key], action);
      if (next[key] !== state[key]) changed = true;
    }
    return changed ? next : state;
  };
}

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) deepFreeze(value);
  }
  return obj;
}
