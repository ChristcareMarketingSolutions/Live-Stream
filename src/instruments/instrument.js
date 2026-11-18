import { chooseVoiceToSteal } from '../audio/voice-steal.js';

/**
 * Base class for all instruments (INS-001, docs/02 §4).
 *
 * Subclasses implement `createVoice(note, velocity, time)` and return a
 * VoiceImpl: { release(time) -> endTime, kill(time), setDetune(cents, time), onEnded(fn) }.
 * The base class owns polyphony, stealing, retrigger limits and pitch bend so
 * every engine behaves the same way.
 *
 * @typedef {{ release: (t: number) => number, kill: (t: number) => void,
 *   setDetune: (cents: number, t: number) => void, onEnded: (fn: () => void) => void }} VoiceImpl
 * @typedef {{ id: number, note: number, state: 'held'|'sustained'|'released'|'dead',
 *   startedAt: number, releasedAt?: number, impl: VoiceImpl, owner: Instrument }} VoiceHandle
 */
export class Instrument {
  /** Max overlapping voices of one note (sustained re-strikes), docs/04 §3. */
  static SAME_NOTE_LIMIT = 2;

  /** @param {BaseAudioContext} ctx */
  constructor(ctx, { maxVoices = 48 } = {}) {
    this.ctx = ctx;
    this.output = ctx.createGain();
    this.maxVoices = maxVoices;
    /** @type {VoiceHandle[]} */
    this.voices = [];
    this.bendCents = 0;
    this.modWheel = 0;
    this.nextId = 1;
    this.disposed = false;
  }

  get isLoaded() {
    return true;
  }

  async load(_onProgress) {}

  get memoryBytes() {
    return 0;
  }

  get activeVoiceCount() {
    return this.voices.length;
  }

  /**
   * @param {number} note 0-127 (already transposed)
   * @param {number} velocity 1-127
   * @returns {VoiceHandle|null}
   */
  noteOn(note, velocity, time = this.ctx.currentTime) {
    if (this.disposed || !this.isLoaded) return null;

    const same = this.voices.filter((v) => v.note === note);
    if (same.length >= Instrument.SAME_NOTE_LIMIT) this.#steal(same[0], time);

    while (this.voices.length >= this.maxVoices) {
      const victim = chooseVoiceToSteal(this.voices);
      if (!victim) break;
      this.#steal(victim, time);
    }

    const impl = this.createVoice(note, velocity, time);
    if (!impl) return null;
    if (this.bendCents) impl.setDetune(this.bendCents, time);
    /** @type {VoiceHandle} */
    const handle = { id: this.nextId++, note, state: 'held', startedAt: time, impl, owner: this };
    this.voices.push(handle);
    impl.onEnded(() => this.#remove(handle));
    return handle;
  }

  /** Release one voice (sustain is decided by the caller). */
  noteOff(handle, time = this.ctx.currentTime) {
    if (!handle || handle.owner !== this) return;
    if (handle.state === 'released' || handle.state === 'dead') return;
    handle.state = 'released';
    handle.releasedAt = time;
    handle.impl.release(time);
  }

  /** Mark a voice as held by the sustain pedal (affects stealing order). */
  markSustained(handle) {
    if (handle?.owner === this && handle.state === 'held') handle.state = 'sustained';
  }

  setPitchBend(semitones, time = this.ctx.currentTime) {
    this.bendCents = semitones * 100;
    for (const v of this.voices) v.impl.setDetune(this.bendCents, time);
  }

  /** 0..1. Subclasses override `onModWheel` to map it to their own parameter. */
  setModWheel(value01, time = this.ctx.currentTime) {
    this.modWheel = value01;
    this.onModWheel(value01, time);
  }

  onModWheel(_value01, _time) {}

  /** Release (or with hardStop, cut within ~6 ms) every voice. */
  allNotesOff(time = this.ctx.currentTime, hardStop = false) {
    for (const v of [...this.voices]) {
      if (hardStop) this.#steal(v, time);
      else this.noteOff(v, time);
    }
  }

  createVoice(_note, _velocity, _time) {
    throw new Error(`${this.constructor.name} must implement createVoice()`);
  }

  dispose() {
    this.allNotesOff(this.ctx.currentTime, true);
    this.disposed = true;
    setTimeout(() => this.output.disconnect(), 50);
  }

  #steal(handle, time) {
    if (handle.state === 'dead') return;
    handle.state = 'dead';
    handle.impl.kill(time);
    this.#remove(handle);
  }

  #remove(handle) {
    const i = this.voices.indexOf(handle);
    if (i >= 0) this.voices.splice(i, 1);
    handle.state = 'dead';
  }
}
