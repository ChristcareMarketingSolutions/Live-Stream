import { isBlackKey, noteName, clamp } from '../../core/math.js';

/**
 * 88-key on-screen keyboard (MIDI-010) drawn on one canvas, with a zone map
 * strip above the keys (LIVE-020). Mouse/touch play: pressing lower on a key
 * plays louder. Highlights notes from every source (MIDI, QWERTY, screen).
 */
export function createKeyboard({ low = 21, high = 108, onNoteOn, onNoteOff, zoneStrip = true }) {
  const wrap = document.createElement('div');
  wrap.className = 'kbd-wrap';
  const canvas = document.createElement('canvas');
  canvas.className = 'kbd';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'On-screen piano keyboard, A0 to C8. Click or touch keys to play.',
  );
  wrap.append(canvas);

  const whites = [];
  for (let n = low; n <= high; n++) if (!isBlackKey(n)) whites.push(n);

  let active = new Map();
  let zones = [];
  let width = 0;
  let height = 0;
  let whiteW = 0;
  const ZONE_H = zoneStrip ? 22 : 0;
  let colors = null;

  function readColors() {
    const cs = getComputedStyle(wrap);
    const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    colors = {
      white: v('--key-white', '#e9e6df'),
      whiteDown: v('--key-white-down', '#f2b84b'),
      black: v('--key-black', '#15181d'),
      blackDown: v('--key-black-down', '#c98d22'),
      line: v('--key-line', '#9aa0a8'),
      label: v('--text-faint', '#6b7686'),
      zoneBg: v('--bg-raised', '#151a21'),
      zones: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--zone-${i}`, '#6cb6ff')),
    };
  }

  function layout() {
    const minW = whites.length * 20;
    width = Math.max(minW, wrap.clientWidth || minW);
    whiteW = width / whites.length;
    height = Math.round(clamp(whiteW * 6, 110, 170)) + ZONE_H;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  /** x-position and width of a key. */
  function keyRect(note) {
    if (!isBlackKey(note)) {
      const i = whites.indexOf(note);
      return { x: i * whiteW, w: whiteW, black: false };
    }
    const i = whites.indexOf(note - 1);
    const w = whiteW * 0.6;
    return { x: (i + 1) * whiteW - w / 2, w, black: true };
  }

  function draw() {
    if (!colors) readColors();
    const g = canvas.getContext('2d');
    const keyTop = ZONE_H;
    const keyH = height - ZONE_H;
    const blackH = keyH * 0.62;
    g.clearRect(0, 0, width, height);

    if (ZONE_H) {
      g.fillStyle = colors.zoneBg;
      g.fillRect(0, 0, width, ZONE_H);
      const rows = Math.max(1, zones.length);
      const rowH = Math.max(2, (ZONE_H - 4) / rows);
      zones.forEach((z, i) => {
        const a = keyRect(clamp(z.low, low, high));
        const b = keyRect(clamp(z.high, low, high));
        g.globalAlpha = z.muted ? 0.3 : 0.9;
        g.fillStyle = colors.zones[i % 8];
        g.fillRect(a.x, 2 + i * rowH, b.x + b.w - a.x, rowH - 1);
      });
      g.globalAlpha = 1;
    }

    for (const n of whites) {
      const r = keyRect(n);
      g.fillStyle = active.has(n) ? colors.whiteDown : colors.white;
      g.fillRect(r.x, keyTop, r.w, keyH);
      g.strokeStyle = colors.line;
      g.lineWidth = 1;
      g.strokeRect(r.x + 0.5, keyTop + 0.5, r.w - 1, keyH - 1);
      if (n % 12 === 0 && whiteW >= 14) {
        g.fillStyle = n === 60 ? '#3a4554' : colors.label;
        g.font = `${Math.min(11, whiteW * 0.55)}px system-ui, sans-serif`;
        g.textAlign = 'center';
        g.fillText(noteName(n), r.x + r.w / 2, keyTop + keyH - 6);
      }
    }
    for (let n = low; n <= high; n++) {
      if (!isBlackKey(n)) continue;
      const r = keyRect(n);
      g.fillStyle = active.has(n) ? colors.blackDown : colors.black;
      g.fillRect(r.x, keyTop, r.w, blackH);
    }
  }

  function noteAt(x, y) {
    const keyH = height - ZONE_H;
    const ky = y - ZONE_H;
    if (ky < 0) return null;
    if (ky < keyH * 0.62) {
      for (let n = low; n <= high; n++) {
        if (!isBlackKey(n)) continue;
        const r = keyRect(n);
        if (x >= r.x && x < r.x + r.w) return { note: n, depth: ky / (keyH * 0.62) };
      }
    }
    const i = clamp(Math.floor(x / whiteW), 0, whites.length - 1);
    return { note: whites[i], depth: ky / keyH };
  }

  const pointers = new Map(); // pointerId → note
  function local(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  const velocityFor = (depth) => clamp(Math.round(35 + 92 * depth), 1, 127);

  canvas.addEventListener('pointerdown', (e) => {
    const { x, y } = local(e);
    const hit = noteAt(x, y);
    if (!hit) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, hit.note);
    onNoteOn?.(hit.note, velocityFor(hit.depth));
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const { x, y } = local(e);
    const hit = noteAt(x, Math.max(y, ZONE_H + 1));
    const prev = pointers.get(e.pointerId);
    if (hit && hit.note !== prev) {
      onNoteOff?.(prev);
      pointers.set(e.pointerId, hit.note);
      onNoteOn?.(hit.note, velocityFor(hit.depth));
    }
  });
  const end = (e) => {
    const note = pointers.get(e.pointerId);
    if (note === undefined) return;
    pointers.delete(e.pointerId);
    onNoteOff?.(note);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('lostpointercapture', end);

  const ro = new ResizeObserver(() => layout());
  ro.observe(wrap);

  return {
    el: wrap,
    setActive(map) {
      active = map;
      draw();
    },
    setZones(next) {
      zones = next;
      draw();
    },
    /** Scroll so `note` is centred (narrow screens). */
    centre(note = 60) {
      const r = keyRect(note);
      wrap.scrollLeft = r.x - wrap.clientWidth / 2;
    },
    refreshColors() {
      colors = null;
      draw();
    },
    dispose() {
      ro.disconnect();
      for (const note of pointers.values()) onNoteOff?.(note);
      pointers.clear();
    },
  };
}
