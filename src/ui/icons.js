// Inline SVG icons (24x24, stroke = currentColor). Static, trusted markup.
const paths = {
  live: '<rect x="3" y="7" width="18" height="10" rx="1.5"/><path d="M7 7v6M11 7v6M15 7v6M19 7v6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/>',
  mixer:
    '<path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1"/><rect x="10" y="7" width="4" height="3" rx="1"/><rect x="16" y="11" width="4" height="3" rx="1"/>',
  library: '<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="M16.5 4.5l3.8 1-3.9 14.5-3.8-1z"/>',
  synth: '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
  daw: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 10h18M3 15h18M8 5v14"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  panic: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 7.5a8 8 0 1 0 11.4 0"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
};

/** @param {keyof typeof paths} name */
export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] ?? ''}</svg>`;
}
