import { createMasterBus } from './master-bus.js';
import { createFxBuses } from './fx-buses.js';

/**
 * Owns the single shared AudioContext (AUD-001, AUD-002, ADR-0002).
 * The context is created on the first user gesture (browser autoplay rules).
 *
 * @param {{ bus: import('../core/event-bus.js').EventBus, getSettings: () => any }} deps
 */
export function createAudioEngine({ bus, getSettings }) {
  /** @type {AudioContext|null} */
  let ctx = null;
  let master = null;
  let fx = null;
  let starting = null;

  function info() {
    if (!ctx) return { state: 'not-started' };
    return {
      state: ctx.state,
      sampleRate: ctx.sampleRate,
      baseLatency: ctx.baseLatency ?? null,
      outputLatency: ctx.outputLatency ?? null,
      latencyHint: getSettings().latencyHint,
    };
  }

  const emitState = () => bus.emit('audio:state', info());

  /** Create (first time) or resume the context. Must be called from a user gesture. */
  function start() {
    if (starting) return starting;
    starting = (async () => {
      try {
        if (!ctx) {
          const settings = getSettings();
          const AC = window.AudioContext ?? window.webkitAudioContext;
          ctx = new AC({ latencyHint: settings.latencyHint ?? 'interactive' });
          ctx.addEventListener('statechange', emitState);
          master = await createMasterBus(ctx, {
            volumeDb: settings.masterVolumeDb,
            limiter: settings.limiter,
            onPeaks: (peaks) => bus.emit('audio:peaks', peaks),
          });
          fx = createFxBuses(ctx, master.input);
          bus.emit('audio:ready', { ctx, master, fx });
        }
        if (ctx.state !== 'running') await ctx.resume();
        emitState();
        return ctx;
      } catch (err) {
        bus.emit('error', {
          code: 'audio-start-failed',
          message:
            'Audio could not start. Check that an output device is connected, then try again.',
          detail: err,
        });
        throw err;
      } finally {
        starting = null;
      }
    })();
    return starting;
  }

  return {
    start,
    info,
    get ctx() {
      return ctx;
    },
    get master() {
      return master;
    },
    get fx() {
      return fx;
    },
    get isRunning() {
      return !!ctx && ctx.state === 'running';
    },
  };
}
