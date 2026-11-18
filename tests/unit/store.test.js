import { describe, it, expect, vi } from 'vitest';
import { createStore, combineReducers } from '../../src/core/store.js';
import { uiReducer, workspaceChanged } from '../../src/core/reducers/ui.js';

const counter = (state = 0, action) => (action.type === 'inc' ? state + 1 : state);

describe('store', () => {
  it('applies actions through the reducer', () => {
    const store = createStore(counter, 0);
    store.dispatch({ type: 'inc' });
    expect(store.getState()).toBe(1);
  });

  it('notifies subscribers only when state changes', () => {
    const store = createStore(counter, 0);
    const fn = vi.fn();
    store.subscribe(fn);
    store.dispatch({ type: 'noop' });
    expect(fn).not.toHaveBeenCalled();
    store.dispatch({ type: 'inc' });
    expect(fn).toHaveBeenCalledWith(1, 0, { type: 'inc' });
  });

  it('select fires only when the selected value changes', () => {
    const store = createStore(combineReducers({ a: counter, b: counter }), {});
    store.dispatch({ type: '@@init' });
    const fn = vi.fn();
    store.select((s) => s.a, fn);
    store.dispatch({ type: 'noop' });
    expect(fn).not.toHaveBeenCalled();
    store.dispatch({ type: 'inc' });
    expect(fn).toHaveBeenCalledWith(1, 0);
  });

  it('select with immediate calls back straight away', () => {
    const store = createStore(counter, 5);
    const fn = vi.fn();
    store.select((s) => s, fn, { immediate: true });
    expect(fn).toHaveBeenCalledWith(5, undefined);
  });

  it('rejects malformed actions', () => {
    const store = createStore(counter, 0);
    expect(() => store.dispatch({})).toThrow(TypeError);
    expect(() => store.dispatch(null)).toThrow(TypeError);
  });

  it('forbids dispatching from inside a reducer', () => {
    let store;
    store = createStore((s, a) => {
      if (a.type === 'nested') store.dispatch({ type: 'inc' });
      return s;
    }, 0);
    expect(() => store.dispatch({ type: 'nested' })).toThrow(/may not dispatch/);
  });

  it('freeze mode catches accidental mutation', () => {
    const store = createStore((s) => s, { list: [1] }, { freeze: true });
    expect(() => store.getState().list.push(2)).toThrow(TypeError);
  });

  it('combineReducers keeps the same object when nothing changes', () => {
    const reducer = combineReducers({ a: counter });
    const state = reducer(undefined, { type: '@@init' });
    expect(reducer(state, { type: 'noop' })).toBe(state);
  });
});

describe('ui reducer', () => {
  it('starts on the live workspace and changes workspace', () => {
    const s0 = uiReducer(undefined, { type: '@@init' });
    expect(s0.workspace).toBe('live');
    const s1 = uiReducer(s0, workspaceChanged('settings'));
    expect(s1.workspace).toBe('settings');
    expect(uiReducer(s1, workspaceChanged('settings'))).toBe(s1);
  });
});
