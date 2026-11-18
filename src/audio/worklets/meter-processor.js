/**
 * Pass-through peak meter (AUD-003). Posts {peaks:[l,r]} about 30 times a second.
 * No allocation in process() (docs/04 §10).
 */
class MeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.peaks = new Float32Array(2);
    this.blocksPerPost = Math.max(1, Math.round(sampleRate / 128 / 30));
    this.count = 0;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    for (let ch = 0; ch < output.length; ch++) {
      const src = input[ch] ?? input[0];
      const dst = output[ch];
      if (!src) {
        dst.fill(0);
        continue;
      }
      let peak = this.peaks[ch < 2 ? ch : 1];
      for (let i = 0; i < dst.length; i++) {
        const s = src[i];
        dst[i] = s;
        const a = s < 0 ? -s : s;
        if (a > peak) peak = a;
      }
      this.peaks[ch < 2 ? ch : 1] = peak;
    }
    if (++this.count >= this.blocksPerPost) {
      this.port.postMessage([this.peaks[0], this.peaks[1]]);
      this.peaks[0] = 0;
      this.peaks[1] = 0;
      this.count = 0;
    }
    return true;
  }
}

registerProcessor('stagecraft-meter', MeterProcessor);
