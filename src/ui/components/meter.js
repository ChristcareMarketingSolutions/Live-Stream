import { gainToDb } from '../../core/math.js';

/**
 * Stereo peak meter for the master output (AUD-003): -48..0 dBFS bars,
 * 1.5 s peak hold, clip LED latched until clicked. Draws on animation frames.
 */
export function createMeter({ bus, readPeaks }) {
  const el = document.createElement('div');
  el.className = 'meter';
  const canvas = document.createElement('canvas');
  canvas.width = 120;
  canvas.height = 18;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Master output level');
  const clip = document.createElement('button');
  clip.type = 'button';
  clip.className = 'clip-led';
  clip.title = 'Clip indicator. Click to reset.';
  clip.setAttribute('aria-label', 'Clip indicator, click to reset');
  el.append(canvas, clip);

  const FLOOR = -48;
  let peaks = [0, 0];
  let display = [FLOOR, FLOOR];
  const hold = [
    { db: FLOOR, t: 0 },
    { db: FLOOR, t: 0 },
  ];
  let clipped = false;
  let raf = 0;

  bus.on('audio:peaks', (p) => {
    peaks = [Math.max(peaks[0], p[0]), Math.max(peaks[1], p[1])];
  });
  clip.addEventListener('click', () => {
    clipped = false;
    clip.classList.remove('on');
  });

  const cs = () => getComputedStyle(el);
  let colors = null;

  function frame(now) {
    if (readPeaks) {
      const p = readPeaks();
      peaks = [Math.max(peaks[0], p[0]), Math.max(peaks[1], p[1])];
    }
    if (!colors) {
      const s = cs();
      colors = {
        bg: s.getPropertyValue('--bg').trim() || '#0e1116',
        ok: s.getPropertyValue('--ok').trim() || '#4cc38a',
        warn: s.getPropertyValue('--warn').trim() || '#e0a83a',
        danger: s.getPropertyValue('--danger').trim() || '#e5534b',
        tick: s.getPropertyValue('--border-strong').trim() || '#3a4554',
      };
    }
    const g = canvas.getContext('2d');
    g.fillStyle = colors.bg;
    g.fillRect(0, 0, canvas.width, canvas.height);
    for (let ch = 0; ch < 2; ch++) {
      const db = Math.max(FLOOR, gainToDb(peaks[ch]));
      if (peaks[ch] >= 0.995) {
        clipped = true;
        clip.classList.add('on');
      }
      // Fast attack, ~20 dB/s fall.
      display[ch] = db > display[ch] ? db : Math.max(db, display[ch] - 0.35);
      if (display[ch] >= hold[ch].db || now - hold[ch].t > 1500)
        hold[ch] = { db: display[ch], t: now };
      const w = canvas.width;
      const y = ch * 9 + 1;
      const x = ((display[ch] - FLOOR) / -FLOOR) * w;
      const grad = g.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, colors.ok);
      grad.addColorStop(0.75, colors.ok);
      grad.addColorStop(0.875, colors.warn);
      grad.addColorStop(1, colors.danger);
      g.fillStyle = grad;
      g.fillRect(0, y, x, 7);
      const hx = ((hold[ch].db - FLOOR) / -FLOOR) * w;
      g.fillStyle = colors.warn;
      if (hold[ch].db > FLOOR) g.fillRect(Math.min(w - 2, hx), y, 2, 7);
    }
    g.fillStyle = colors.tick;
    for (const t of [-36, -24, -12, -6])
      g.fillRect(((t - FLOOR) / -FLOOR) * canvas.width, 0, 1, 18);
    peaks = [0, 0];
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    el,
    get clipped() {
      return clipped;
    },
    dispose: () => cancelAnimationFrame(raf),
  };
}
