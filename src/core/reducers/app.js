/**
 * App state slices (docs/02 §8):
 *   settings — persisted user preferences
 *   session  — what is selected/open (not part of the concert file)
 *   runtime  — live status: audio, MIDI, packs (never persisted)
 *   concert  — the open concert document
 */

export const DEFAULT_SETTINGS = {
  latencyHint: 'interactive',
  masterVolumeDb: -6,
  limiter: true,
  velocityCurve: 'linear',
  midiInputs: 'all',
};

const initial = {
  settings: DEFAULT_SETTINGS,
  session: {
    activePatchId: null,
    editPatchId: null,
    selectedLayerId: null,
    saveState: 'saved',
    concertList: [],
    locked: false,
    learnZone: null,
  },
  runtime: {
    audio: { state: 'not-started' },
    midi: { status: 'idle', devices: [] },
    packs: {},
    qwerty: { octave: 4, velocity: 96, sustain: false, enabled: true },
    switchMs: [],
  },
  concert: null,
};

export const setSlice = (slice, changes) => ({ type: 'slice/set', slice, changes });
export const replaceConcert = (concert, dirty = true) => ({
  type: 'concert/replace',
  concert,
  dirty,
});

const sliceReducer =
  (name) =>
  (state = initial[name], action) => {
    if (action.type === 'slice/set' && action.slice === name)
      return { ...state, ...action.changes };
    if (name === 'session' && action.type === 'concert/replace' && action.dirty) {
      return state.saveState === 'dirty' ? state : { ...state, saveState: 'dirty' };
    }
    return state;
  };

export const settingsReducer = sliceReducer('settings');
export const sessionReducer = sliceReducer('session');
export const runtimeReducer = sliceReducer('runtime');

export function concertReducer(state = initial.concert, action) {
  return action.type === 'concert/replace' ? action.concert : state;
}
