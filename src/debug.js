import { createInstrument } from './instruments/registry.js';
import { getInstrument } from './instruments/registry.js';
import { createMasterBus } from './audio/master-bus.js';

/**
 * Test/diagnostic hook, installed only when the URL has ?debug
 * (docs/03 Phase 2 task 9). Lets automated tests inject MIDI and render
 * instruments offline to check the audio maths without speakers.
 */
export function installDebugHook(app) {
  window.__stagecraft = {
    app,
    injectMidi: (bytes, sourceId = 'debug') => app.sendBytes(bytes, sourceId),
    voices: () => app.chains.voiceCount(),
    state: () => app.store.getState(),

    /**
     * Render notes through one instrument in an OfflineAudioContext.
     * @param {{ instrument: string, preset: string, notes: Array<{note:number, velocity:number, start:number, end:number}>,
     *   duration: number, windows?: Array<[number, number]>, master?: boolean }} opts
     */
    async renderOffline({ instrument, preset, notes, duration, windows = [], master = false }) {
      const rate = 48000;
      const ctx = new OfflineAudioContext(2, Math.ceil(rate * duration), rate);
      const meta = getInstrument(instrument);
      if (meta?.pack) {
        if (!app.audio.ctx) throw new Error('Start audio before rendering sampled instruments');
        await app.packStore.load(meta.pack, app.audio.ctx);
      }
      const inst = createInstrument(ctx, instrument, preset, { packStore: app.packStore });
      if (master) {
        const bus = await createMasterBus(ctx, { volumeDb: 0, limiter: true });
        inst.output.connect(bus.input);
      } else {
        inst.output.connect(ctx.destination);
      }
      // Releases are applied at their exact time by suspending the render there.
      const releases = new Map();
      for (const n of notes) {
        const handle = inst.noteOn(n.note, n.velocity, n.start);
        if (handle && n.end !== undefined) {
          const at = Math.round((n.end * rate) / 128) * (128 / rate); // render-quantum aligned
          if (!releases.has(at)) releases.set(at, []);
          releases.get(at).push(handle);
        }
      }
      for (const [at, handles] of releases) {
        ctx.suspend(at).then(() => {
          handles.forEach((hd) => inst.noteOff(hd, at));
          ctx.resume();
        });
      }
      const buf = await ctx.startRendering();
      return analyse(buf, windows);
    },
  };
}

function analyse(buf, windows) {
  const rate = buf.sampleRate;
  const chans = [buf.getChannelData(0), buf.getChannelData(1)];
  let peak = 0;
  let sumSq = 0;
  let nan = 0;
  let maxDelta = 0;
  for (const d of chans) {
    for (let i = 0; i < d.length; i++) {
      const s = d[i];
      if (!Number.isFinite(s)) {
        nan++;
        continue;
      }
      const a = Math.abs(s);
      if (a > peak) peak = a;
      sumSq += s * s;
      if (i > 0) maxDelta = Math.max(maxDelta, Math.abs(s - d[i - 1]));
    }
  }
  const win = windows.map(([t0, t1]) => {
    let p = 0;
    for (const d of chans) {
      for (let i = Math.floor(t0 * rate); i < Math.min(d.length, Math.floor(t1 * rate)); i++)
        p = Math.max(p, Math.abs(d[i]));
    }
    return p;
  });
  return {
    peak,
    rms: Math.sqrt(sumSq / (chans[0].length * 2)),
    nan,
    maxDelta,
    windows: win,
  };
}
