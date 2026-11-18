/**
 * AudioParam envelope helpers (docs/04 §3). All times are AudioContext seconds.
 * Ramps are used everywhere so starts/stops never click.
 */

export const MIN_ATTACK = 0.002;
const KILL_TIME = 0.006;

/** Freeze a param at its current value from `time` on, so a new ramp starts cleanly. */
export function holdAt(param, time) {
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(time);
  } else {
    const v = param.value;
    param.cancelScheduledValues(time);
    param.setValueAtTime(v, time);
  }
}

/**
 * Start an ADSR on `param` at `time`.
 * @param {AudioParam} param
 * @param {{a: number, d: number, s: number}} env attack/decay seconds, sustain level 0..1
 * @param {number} peak
 */
export function startAdsr(param, time, env, peak) {
  const a = Math.max(MIN_ATTACK, env.a);
  param.cancelScheduledValues(time);
  param.setValueAtTime(0, time);
  param.linearRampToValueAtTime(peak, time + a);
  if (env.s < 1) {
    // Exponential approach; time constant = decay/4 so it is ~98% done after `d`.
    param.setTargetAtTime(peak * env.s, time + a, Math.max(0.001, env.d / 4));
  }
}

/** Release towards silence; returns the time at which the voice is inaudible (< -80 dB). */
export function releaseParam(param, time, release) {
  const r = Math.max(0.005, release);
  holdAt(param, time);
  param.setTargetAtTime(0, time, r / 5);
  // After 9.2 time constants an exponential decay is 80 dB down.
  return time + (r / 5) * 9.2;
}

/** Very fast fade used for stealing and panic. Returns the stop time. */
export function killParam(param, time) {
  holdAt(param, time);
  param.linearRampToValueAtTime(0, time + KILL_TIME);
  return time + KILL_TIME + 0.002;
}

/** Smoothly move a param (de-zipper, MIX-005). */
export function smoothSet(param, value, ctx, timeConstant = 0.012) {
  const t = ctx.currentTime;
  holdAt(param, t);
  param.setTargetAtTime(value, t, timeConstant);
}
