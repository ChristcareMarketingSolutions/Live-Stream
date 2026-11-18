import { h } from '../dom.js';
import { icon } from '../icons.js';
import { hrefFor } from '../router.js';
import { WORKSPACES } from '../../core/workspaces.js';
import { createMeter } from '../components/meter.js';

/**
 * Persistent frame: top bar (concert, save state, master meter, Start audio,
 * Panic), workspace sidebar, main area and status bar.
 */
export function createShell(root, app) {
  const { store, bus } = app;
  const main = h('main', { id: 'main', class: 'workspace', tabindex: '-1' });

  const navItems = WORKSPACES.map((ws) => {
    const enabled = ws.availableInPhase === undefined;
    const attrs = enabled
      ? { href: hrefFor(ws.id), class: 'nav-item', 'data-workspace': ws.id }
      : {
          class: 'nav-item',
          'data-workspace': ws.id,
          role: 'link',
          'aria-disabled': 'true',
          title: `Coming in Phase ${ws.availableInPhase}`,
        };
    return h(
      'a',
      attrs,
      h('span', { class: 'nav-icon', html: icon(ws.icon) }),
      h('span', { class: 'nav-label' }, ws.label),
      enabled ? null : h('span', { class: 'nav-badge' }, `P${ws.availableInPhase}`),
    );
  });

  const concertName = h(
    'span',
    { class: 'topbar-concert-name', 'data-testid': 'concert-name' },
    '—',
  );
  const saveState = h('span', { class: 'save-state', 'data-testid': 'save-state' });
  const startBtn = h(
    'button',
    {
      class: 'btn btn-accent',
      type: 'button',
      'data-testid': 'start-audio',
      onclick: () => app.startAudio(),
    },
    h('span', { html: icon('power', 16) }),
    h('span', { class: 'btn-label' }, 'Start audio'),
  );
  const panicBtn = h(
    'button',
    {
      class: 'btn btn-danger',
      type: 'button',
      title: 'Stop all sound (Esc)',
      'data-testid': 'panic',
      onclick: () => app.panic(),
    },
    h('span', { html: icon('panic', 16) }),
    h('span', { class: 'btn-label' }, 'Panic'),
  );
  const meter = createMeter({ bus, readPeaks: () => app.audio.master?.readPeaks?.() ?? [0, 0] });

  const topbar = h(
    'header',
    { class: 'topbar' },
    h(
      'div',
      { class: 'brand' },
      h('span', { class: 'brand-mark', 'aria-hidden': 'true' }),
      h('span', { class: 'brand-name' }, 'STAGECRAFT'),
    ),
    h(
      'div',
      { class: 'topbar-concert' },
      h('span', { class: 'eyebrow' }, 'Concert'),
      h('span', { class: 'row' }, concertName, saveState),
    ),
    h('div', { class: 'topbar-actions' }, meter.el, startBtn, panicBtn),
  );

  const statusAudio = h('span', { class: 'status-item', 'data-testid': 'status-audio' });
  const statusMidi = h('span', { class: 'status-item', 'data-testid': 'status-midi' });
  const statusKeys = h('span', { class: 'status-item muted' });
  const statusVoices = h('span', { class: 'status-item muted', 'data-testid': 'status-voices' });
  const statusbar = h(
    'footer',
    { class: 'statusbar' },
    statusAudio,
    statusMidi,
    statusKeys,
    h('span', { class: 'status-spacer' }),
    statusVoices,
    h('span', { class: 'status-item muted version' }, `v${__APP_VERSION__} · ${__BUILD_SHA__}`),
  );

  root.replaceChildren(
    h('a', { class: 'skip-link', href: '#main', onclick: skipToMain }, 'Skip to content'),
    topbar,
    h(
      'nav',
      { class: 'sidebar', 'aria-label': 'Workspaces' },
      h('div', { class: 'nav-list' }, navItems),
    ),
    main,
    statusbar,
  );

  function skipToMain(event) {
    event.preventDefault();
    main.focus();
  }

  const led = (state) => h('span', { class: `led ${state}` });

  function renderStatus(s) {
    const a = s.runtime.audio;
    const running = a.state === 'running';
    startBtn.hidden = running;
    statusAudio.replaceChildren(
      led(running ? 'on' : a.state === 'suspended' ? 'warn' : ''),
      running
        ? `Audio: ${Math.round(a.sampleRate / 100) / 10} kHz · ${fmtMs(a.baseLatency)} + ${fmtMs(a.outputLatency)} output`
        : a.state === 'not-started'
          ? 'Audio: click Start audio'
          : `Audio: ${a.state}`,
    );
    const m = s.runtime.midi;
    const connected = (m.devices ?? []).filter((d) => d.state === 'connected');
    statusMidi.replaceChildren(
      led(
        connected.length ? 'on' : m.status === 'unsupported' || m.status === 'denied' ? 'bad' : '',
      ),
      m.status === 'unsupported'
        ? 'MIDI: not supported in this browser'
        : m.status === 'denied'
          ? 'MIDI: permission denied'
          : connected.length
            ? `MIDI: ${connected.map((d) => d.name).join(', ')}`
            : 'MIDI: no keyboard connected',
    );
    const q = s.runtime.qwerty;
    statusKeys.textContent = `Computer keys: C${q.octave} · vel ${q.velocity}${q.sustain ? ' · sustain' : ''}`;
    concertName.textContent = s.concert?.name ?? '—';
    const ss = s.session.saveState;
    saveState.textContent =
      ss === 'saved'
        ? 'Saved'
        : ss === 'saving'
          ? 'Saving…'
          : ss === 'error'
            ? 'Not saved'
            : 'Unsaved changes';
    saveState.className = `save-state ${ss}`;
  }
  const fmtMs = (sec) => (sec === null || sec === undefined ? '?' : `${Math.round(sec * 1000)} ms`);

  store.subscribe(renderStatus);
  renderStatus(store.getState());
  setInterval(() => {
    statusVoices.textContent = app.audio.ctx ? `Voices: ${app.chains.voiceCount()}` : '';
  }, 250);

  function setActive(id) {
    for (const item of navItems) {
      const active = item.dataset.workspace === id;
      item.classList.toggle('active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    }
  }

  return { main, setActive };
}
