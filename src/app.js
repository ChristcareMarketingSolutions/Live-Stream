import { createEventBus } from './core/event-bus.js';
import { createStore, combineReducers } from './core/store.js';
import { uiReducer } from './core/reducers/ui.js';
import {
  settingsReducer,
  sessionReducer,
  runtimeReducer,
  concertReducer,
  setSlice,
  replaceConcert,
  DEFAULT_SETTINGS,
} from './core/reducers/app.js';
import { applyVelocityCurve } from './core/math.js';
import { createAudioEngine } from './audio/audio-engine.js';
import { createPackStore } from './packs/pack-store.js';
import { getInstrument } from './instruments/registry.js';
import { createPatchEngine } from './performance/patch-engine.js';
import { createChainManager } from './performance/chain-manager.js';
import * as Concert from './performance/concert-model.js';
import { createMidiAccess } from './midi/midi-access.js';
import { createComputerKeyboard } from './midi/computer-keyboard.js';
import { parseMidi } from './midi/midi-parser.js';
import { concertRepo, requestPersistence } from './storage/concert-repo.js';

const AUTOSAVE_MS = 2000;

/**
 * Application controller: owns services and wires them to the store.
 * UI views call the methods returned here; they never touch audio directly.
 */
export function createApp() {
  const bus = createEventBus();
  const store = createStore(
    combineReducers({
      ui: uiReducer,
      settings: settingsReducer,
      session: sessionReducer,
      runtime: runtimeReducer,
      concert: concertReducer,
    }),
    {},
    { freeze: import.meta.env.DEV },
  );
  store.dispatch({ type: '@@init' });

  const S = () => store.getState();
  const setSession = (c) => store.dispatch(setSlice('session', c));
  const setRuntime = (c) => store.dispatch(setSlice('runtime', c));

  // ------------------------------------------------------------ audio
  const audio = createAudioEngine({ bus, getSettings: () => S().settings });
  const packStore = createPackStore({ bus, baseUrl: import.meta.env.BASE_URL });
  const chains = createChainManager({
    engine: audio,
    packStore,
    onNeedsPack: (instrumentId) => loadPackFor(instrumentId),
  });

  const patchEngine = createPatchEngine({
    getChain: (layer) => chains.get(layer),
    allChains: () => chains.all(),
    onProgramChange: (program) => {
      const c = S().concert;
      const p = c && Concert.findByProgram(c, program);
      if (p) selectPatch(p.id);
    },
    onActiveNotesChanged: (notes) => scheduleNotesEmit(notes),
  });

  let notesPending = null;
  function scheduleNotesEmit(notes) {
    const first = notesPending === null;
    notesPending = notes;
    if (first) {
      requestAnimationFrame(() => {
        bus.emit('notes:active', notesPending);
        notesPending = null;
      });
    }
  }

  bus.on('audio:state', (info) => setRuntime({ audio: info }));
  bus.on('audio:ready', () => {
    applyConcertSettings();
    activatePatch(S().session.activePatchId, { measure: false });
    setInterval(() => chains.sweep(patchEngine.chainsInUse()), 1000);
  });

  function loadPackFor(instrumentId) {
    const meta = getInstrument(instrumentId);
    if (!meta?.pack || !audio.fx) return;
    const pack = packStore.get(meta.pack);
    if (pack.loaded || pack.loading) return;
    updatePack(meta.pack, { state: 'loading', progress: 0 });
    packStore.load(meta.pack, audio.ctx).catch(() => {});
  }

  const updatePack = (id, changes) =>
    setRuntime({ packs: { ...S().runtime.packs, [id]: { ...S().runtime.packs[id], ...changes } } });
  bus.on('pack:progress', ({ id, progress }) => updatePack(id, { state: 'loading', progress }));
  bus.on('pack:loaded', ({ id, memoryBytes }) =>
    updatePack(id, { state: 'loaded', progress: 1, memoryBytes, installed: true }),
  );
  bus.on('pack:error', ({ id, message }) => updatePack(id, { state: 'error', error: message }));
  bus.on('pack:removed', ({ id }) =>
    updatePack(id, { state: 'idle', progress: 0, memoryBytes: 0, installed: false }),
  );

  async function startAudio() {
    await audio.start();
  }

  // ------------------------------------------------------------ patches
  function activePatch() {
    const { concert, session } = S();
    return concert?.patches[session.activePatchId] ?? null;
  }

  function applyConcertSettings() {
    const c = S().concert;
    if (!c || !audio.fx) return;
    const p = activePatch();
    audio.fx.apply({ ...c.settings, tempo: p?.tempo ?? c.settings.tempo });
  }

  /** Point new notes at a patch's layers (LIVE-030..033). */
  function activatePatch(patchId, { measure = true } = {}) {
    const c = S().concert;
    const patch = c?.patches[patchId];
    if (!patch) return;
    const t0 = performance.now();
    if (audio.fx) chains.activate(patch.layers);
    patchEngine.setLayers(patch.layers);
    const ms = performance.now() - t0;
    if (measure) setRuntime({ switchMs: [...S().runtime.switchMs.slice(-49), ms] });
    applyConcertSettings();
    if (audio.fx) preloadNeighbours(patchId);
  }

  function preloadNeighbours(patchId) {
    const run = () => {
      const c = S().concert;
      if (!c) return;
      const n = Concert.neighbours(c, patchId);
      for (const x of [n.prev, n.next]) x?.patch.layers.forEach((l) => chains.get(l));
    };
    (window.requestIdleCallback ?? ((fn) => setTimeout(fn, 50)))(run);
  }

  function selectPatch(patchId) {
    if (!S().concert?.patches[patchId]) return;
    setSession({ activePatchId: patchId });
    activatePatch(patchId);
  }

  function stepPatch(delta) {
    const c = S().concert;
    if (!c) return;
    const n = Concert.neighbours(c, S().session.activePatchId);
    const target = delta > 0 ? n.next : n.prev;
    if (target) selectPatch(target.patch.id);
  }

  // Keep audio in sync with concert edits.
  store.select(
    (s) => s.concert,
    (concert, prev) => {
      if (!concert) return;
      if (prev && prev.id === concert.id) {
        const p = concert.patches[S().session.activePatchId];
        const before = prev.patches[S().session.activePatchId];
        if (p && p !== before) {
          if (audio.fx) {
            for (const l of p.layers) chains.applyParams(l);
            chains.activate(p.layers);
          }
          patchEngine.setLayers(p.layers);
        }
        if (concert.settings !== prev.settings) applyConcertSettings();
        const ids = new Set(
          Object.values(concert.patches).flatMap((x) => x.layers.map((l) => l.id)),
        );
        if (audio.fx) chains.prune(ids);
      }
      scheduleAutosave();
    },
  );

  store.select(
    (s) => s.settings,
    (settings, prev) => {
      if (audio.master && settings.masterVolumeDb !== prev?.masterVolumeDb) {
        audio.master.setVolumeDb(settings.masterVolumeDb);
      }
      if (audio.master && settings.limiter !== prev?.limiter)
        audio.master.setLimiter(settings.limiter);
      concertRepo.saveSettings(settings).catch(() => {});
    },
  );

  // ------------------------------------------------------------ storage
  let saveTimer = null;
  function scheduleAutosave() {
    if (S().session.saveState !== 'dirty') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, AUTOSAVE_MS);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    const c = S().concert;
    if (!c) return;
    setSession({ saveState: 'saving' });
    try {
      await concertRepo.save(c);
      await concertRepo.setLastOpened(c.id);
      setSession({
        saveState: S().concert === c ? 'saved' : 'dirty',
        concertList: await concertRepo.list(),
      });
      if (S().session.saveState === 'dirty') scheduleAutosave();
    } catch (err) {
      setSession({ saveState: 'error' });
      bus.emit('error', {
        code: 'save-failed',
        message: 'Saving failed. Export the concert as a backup file from Edit → Export.',
        detail: err,
      });
    }
  }

  async function openConcert(concert, { save = false } = {}) {
    if (S().session.saveState === 'dirty') await saveNow();
    patchEngine.panic();
    store.dispatch(replaceConcert(concert, false));
    const first = Concert.firstPatchId(concert);
    setSession({
      activePatchId: first,
      editPatchId: first,
      selectedLayerId: null,
      saveState: 'saved',
    });
    activatePatch(first, { measure: false });
    if (save) {
      setSession({ saveState: 'dirty' });
      await saveNow();
    } else {
      concertRepo.setLastOpened(concert.id).catch(() => {});
    }
  }

  /** Apply a pure concert-model edit: app.edit(Concert.updateLayer, pid, lid, {...}). */
  function edit(fn, ...args) {
    const c = S().concert;
    if (!c || S().session.locked) return c;
    const next = fn(c, ...args);
    if (next !== c) store.dispatch(replaceConcert(next));
    return next;
  }

  async function init() {
    try {
      const saved = await concertRepo.loadSettings();
      if (saved) store.dispatch(setSlice('settings', { ...DEFAULT_SETTINGS, ...saved }));
      const list = await concertRepo.list();
      setSession({ concertList: list });
      const lastId = await concertRepo.getLastOpened();
      const concert =
        (lastId && (await concertRepo.load(lastId))) ||
        (list[0] && (await concertRepo.load(list[0].id)));
      if (concert) await openConcert(concert);
      else await openConcert(Concert.sundayWorshipTemplate(), { save: true });
      requestPersistence();
    } catch (err) {
      bus.emit('error', {
        code: 'storage-unavailable',
        message:
          'Saved concerts could not be opened, so a fresh concert was loaded. Changes may not be saved in this window.',
        detail: err,
      });
      await openConcert(Concert.sundayWorshipTemplate()).catch(() => {});
    }
  }

  // ------------------------------------------------------------ MIDI input
  const midiLog = [];
  function input(ev) {
    if (!ev) return;
    if (ev.type === 'noteon') {
      ev = { ...ev, velocity: applyVelocityCurve(ev.velocity, S().settings.velocityCurve) };
      const learn = S().session.learnZone;
      if (learn) return handleLearnZone(learn, ev.note);
    }
    patchEngine.handle(ev);
    midiLog.push(ev);
    if (midiLog.length > 50) midiLog.shift();
    bus.emit('midi:event', ev);
  }

  function handleLearnZone(learn, note) {
    if (learn.low === undefined) {
      setSession({ learnZone: { ...learn, low: note } });
      return;
    }
    const low = Math.min(learn.low, note);
    const high = Math.max(learn.low, note);
    edit(Concert.updateLayer, learn.patchId, learn.layerId, { zone: { low, high } });
    setSession({ learnZone: null });
  }

  /** Raw bytes from any built-in source (on-screen keys, QWERTY, debug hook). */
  const sendBytes = (bytes, sourceId) => input(parseMidi(bytes, sourceId, performance.now()));

  const midi = createMidiAccess({
    bus,
    onEvent: input,
    onDisconnect: (id) => patchEngine.releaseSource(id),
    getEnabled: () => S().settings.midiInputs,
  });
  bus.on('midi:devices', (m) => setRuntime({ midi: m }));

  const qwerty = createComputerKeyboard({
    send: (bytes) => sendBytes(bytes, 'qwerty'),
    onStateChange: (q) => setRuntime({ qwerty: q }),
  });

  function panic() {
    patchEngine.panic();
    qwerty.releaseAll();
  }

  return {
    bus,
    store,
    audio,
    packStore,
    patchEngine,
    chains,
    midi,
    qwerty,
    midiLog,
    init,
    startAudio,
    selectPatch,
    stepPatch,
    activePatch,
    edit,
    saveNow,
    openConcert,
    sendBytes,
    panic,
    loadPackFor,
    setSettings: (c) => store.dispatch(setSlice('settings', c)),
    setSession,
    async deleteConcert(id) {
      await concertRepo.remove(id);
      const list = await concertRepo.list();
      setSession({ concertList: list });
      if (S().concert?.id === id) {
        const next = list[0] ? await concertRepo.load(list[0].id) : Concert.emptyConcert();
        await openConcert(next, { save: !list[0] });
      }
    },
    async switchConcert(id) {
      const c = await concertRepo.load(id);
      if (c) await openConcert(c);
    },
  };
}
