import { h, replace } from '../dom.js';
import { icon } from '../icons.js';
import { VELOCITY_CURVES, noteName } from '../../core/math.js';
import { KEY_OFFSETS } from '../../midi/computer-keyboard.js';

const ms = (s) => (s === null || s === undefined ? 'n/a' : `${(s * 1000).toFixed(1)} ms`);

/** Settings: audio, MIDI, computer keyboard, diagnostics, system check, about. */
export function renderSettingsView(container, { app, capabilities }) {
  const { store, bus } = app;
  const S = () => store.getState();

  const audioCard = h('div', { class: 'card', 'data-testid': 'audio-card' });
  const midiCard = h('div', { class: 'card', 'data-testid': 'midi-card' });
  const monitor = h('ol', {
    class: 'monitor',
    'aria-label': 'Recent MIDI messages',
    'data-testid': 'midi-monitor',
  });
  const diag = h('dl', { class: 'facts', 'data-testid': 'diagnostics' });

  replace(
    container,
    h(
      'section',
      { class: 'panel-page', 'aria-labelledby': 'settings-title' },
      h('h1', { id: 'settings-title' }, 'Settings'),
      audioCard,
      midiCard,
      h(
        'div',
        { class: 'card' },
        h('h2', null, 'MIDI monitor'),
        h(
          'p',
          { class: 'muted' },
          'The last 50 messages from all sources. Use it to check that your keyboard and pedal are sending.',
        ),
        monitor,
      ),
      qwertyCard(),
      h('div', { class: 'card' }, h('h2', null, 'Diagnostics'), diag),
      systemCheck(capabilities),
      about(),
    ),
  );

  // ------------------------------------------------------------ audio
  function renderAudio(s) {
    const a = s.runtime.audio;
    const st = s.settings;
    const running = a.state === 'running';
    replace(
      audioCard,
      h('h2', null, 'Audio'),
      h(
        'dl',
        { class: 'facts' },
        h('dt', null, 'Status'),
        h(
          'dd',
          { 'data-testid': 'audio-state' },
          running ? 'Running' : a.state === 'not-started' ? 'Not started' : a.state,
        ),
        h('dt', null, 'Sample rate'),
        h('dd', null, a.sampleRate ? `${a.sampleRate} Hz` : 'n/a'),
        h('dt', null, 'Latency'),
        h('dd', null, `${ms(a.baseLatency)} processing + ${ms(a.outputLatency)} output device`),
      ),
      running
        ? null
        : h(
            'button',
            { class: 'btn btn-accent', type: 'button', onclick: () => app.startAudio() },
            h('span', { html: icon('power', 16) }),
            'Start audio',
          ),
      h(
        'div',
        { class: 'fields' },
        h(
          'label',
          { class: 'field' },
          h('span', { class: 'field-label' }, 'Master volume'),
          h(
            'span',
            { class: 'slider' },
            h('input', {
              type: 'range',
              min: -40,
              max: 6,
              step: 1,
              value: st.masterVolumeDb,
              'data-testid': 'master-volume',
              oninput: (e) => {
                e.target.nextSibling.textContent = `${e.target.value} dB`;
                app.setSettings({ masterVolumeDb: Number(e.target.value) });
              },
            }),
            h('output', { class: 'slider-val' }, `${st.masterVolumeDb} dB`),
          ),
        ),
        h(
          'label',
          { class: 'field' },
          h('span', { class: 'field-label' }, 'Latency mode'),
          h(
            'select',
            {
              onchange: (e) => {
                app.setSettings({ latencyHint: e.target.value });
                bus.emit('toast', {
                  message: 'Latency mode changes take effect after you reload the page.',
                });
              },
            },
            [
              ['interactive', 'Lowest latency (live playing)'],
              ['balanced', 'Balanced'],
              ['playback', 'Most stable (fewer crackles)'],
            ].map(([v, l]) => h('option', { value: v, selected: v === st.latencyHint }, l)),
          ),
          h(
            'span',
            { class: 'field-hint' },
            'If you hear crackles, choose Balanced. Applies after reload.',
          ),
        ),
        h(
          'label',
          { class: 'check' },
          h('input', {
            type: 'checkbox',
            checked: st.limiter,
            onchange: (e) => app.setSettings({ limiter: e.target.checked }),
          }),
          'Safety limiter on master output (recommended)',
        ),
      ),
      h('h3', null, 'Sound test'),
      h('p', { class: 'muted' }, 'Plays through the current patch.'),
      h(
        'div',
        { class: 'row wrap' },
        testBtn('Play middle C', [60]),
        testBtn('Play a chord', [48, 60, 64, 67, 72]),
        testBtn(
          'Stress test: 64 notes',
          Array.from({ length: 64 }, (_, i) => 36 + i),
          'stress',
        ),
        h(
          'button',
          { class: 'btn btn-danger', type: 'button', onclick: () => app.panic() },
          'Panic (Esc)',
        ),
      ),
    );
  }

  function testBtn(label, notes, id) {
    return h(
      'button',
      {
        class: 'btn',
        type: 'button',
        'data-testid': id ? `test-${id}` : null,
        onclick: async () => {
          await app.startAudio();
          notes.forEach((n) => app.sendBytes([0x90, n, 96], 'test'));
          setTimeout(() => notes.forEach((n) => app.sendBytes([0x80, n, 64], 'test')), 1200);
        },
      },
      label,
    );
  }

  // ------------------------------------------------------------ MIDI
  function renderMidi(s) {
    const m = s.runtime.midi;
    const st = s.settings;
    const enabled = st.midiInputs;
    let body;
    if (m.status === 'unsupported') {
      body = h(
        'p',
        { class: 'readiness bad' },
        'This browser has no Web MIDI. Use Chrome or Edge on a computer to connect a MIDI keyboard. You can still play with the on-screen and computer keyboards.',
      );
    } else if (m.status === 'denied') {
      body = h(
        'p',
        { class: 'readiness bad' },
        'MIDI permission was refused. Click the icon at the left of the address bar, allow MIDI devices, then reload.',
      );
    } else if (m.status !== 'ready') {
      body = h(
        'div',
        null,
        h(
          'p',
          { class: 'muted' },
          'Connect your keyboard by USB, then allow MIDI access when the browser asks.',
        ),
        h(
          'button',
          {
            class: 'btn btn-accent',
            type: 'button',
            'data-testid': 'connect-midi',
            onclick: () => app.midi.request(),
          },
          m.status === 'requesting' ? 'Waiting for permission…' : 'Connect MIDI keyboard',
        ),
      );
    } else {
      const devices = m.devices ?? [];
      body = h(
        'div',
        null,
        h(
          'label',
          { class: 'check' },
          h('input', {
            type: 'checkbox',
            checked: enabled === 'all',
            onchange: (e) => setInputs(e.target.checked ? 'all' : devices.map((d) => d.id)),
          }),
          'Listen to all inputs',
        ),
        devices.length === 0
          ? h(
              'p',
              { class: 'muted' },
              'No MIDI inputs found. Plug in your keyboard; it appears here automatically.',
            )
          : h(
              'ul',
              { class: 'device-list' },
              devices.map((d) =>
                h(
                  'li',
                  null,
                  h('span', {
                    class: `led ${d.state === 'connected' ? 'on' : ''}`,
                    'data-activity': d.id,
                  }),
                  h(
                    'label',
                    { class: 'check' },
                    h('input', {
                      type: 'checkbox',
                      disabled: enabled === 'all',
                      checked: enabled === 'all' || enabled.includes(d.id),
                      onchange: (e) => {
                        const cur = enabled === 'all' ? devices.map((x) => x.id) : enabled;
                        setInputs(
                          e.target.checked
                            ? [...new Set([...cur, d.id])]
                            : cur.filter((x) => x !== d.id),
                        );
                      },
                    }),
                    `${d.name}${d.manufacturer ? ` (${d.manufacturer})` : ''}`,
                  ),
                  h(
                    'span',
                    { class: 'muted' },
                    d.state === 'connected' ? 'Connected' : 'Disconnected',
                  ),
                ),
              ),
            ),
      );
    }
    replace(
      midiCard,
      h('h2', null, 'MIDI keyboard'),
      body,
      h(
        'label',
        { class: 'field' },
        h('span', { class: 'field-label' }, 'Velocity curve'),
        h(
          'select',
          { onchange: (e) => app.setSettings({ velocityCurve: e.target.value }) },
          VELOCITY_CURVES.map((v) =>
            h(
              'option',
              { value: v, selected: v === st.velocityCurve },
              {
                linear: 'Normal',
                soft: 'Light touch (louder with less force)',
                hard: 'Heavy touch',
                fixed: 'Fixed (always 100)',
              }[v],
            ),
          ),
        ),
      ),
    );
  }

  function setInputs(next) {
    const prev = S().settings.midiInputs;
    const prevIds = prev === 'all' ? (S().runtime.midi.devices ?? []).map((d) => d.id) : prev;
    app.setSettings({ midiInputs: next });
    app.midi.applyEnabled(prevIds);
  }

  // ------------------------------------------------------------ monitor + diagnostics
  let monitorPending = false;
  const offMidi = bus.on('midi:event', () => {
    if (monitorPending) return;
    monitorPending = true;
    requestAnimationFrame(() => {
      monitorPending = false;
      replace(
        monitor,
        ...app.midiLog
          .slice(-50)
          .reverse()
          .map((e) => h('li', null, describe(e))),
      );
    });
  });

  function describe(e) {
    const src =
      e.sourceId === 'qwerty'
        ? 'Computer keys'
        : e.sourceId === 'screen'
          ? 'On-screen'
          : e.sourceId === 'test'
            ? 'Sound test'
            : 'MIDI';
    const ch = `ch ${e.channel}`;
    switch (e.type) {
      case 'noteon':
        return `${src} · ${ch} · Note on ${noteName(e.note)} vel ${e.velocity}`;
      case 'noteoff':
        return `${src} · ${ch} · Note off ${noteName(e.note)}`;
      case 'cc':
        return `${src} · ${ch} · CC ${e.controller} = ${e.value}${e.controller === 64 ? (e.value >= 64 ? ' (sustain down)' : ' (sustain up)') : ''}`;
      case 'pitchbend':
        return `${src} · ${ch} · Pitch bend ${e.bend.toFixed(2)}`;
      case 'program':
        return `${src} · ${ch} · Program change ${e.program + 1}`;
      default:
        return `${src} · ${ch} · ${e.type}`;
    }
  }

  function renderDiag(s) {
    const sw = s.runtime.switchMs;
    const sorted = [...sw].sort((a, b) => a - b);
    const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const max = sorted.length ? sorted.at(-1) : null;
    replace(
      diag,
      h('dt', null, 'Patch switch time'),
      h(
        'dd',
        { 'data-testid': 'switch-time' },
        med === null
          ? 'Switch a patch to measure'
          : `median ${med.toFixed(2)} ms · max ${max.toFixed(2)} ms (${sw.length} switches)`,
      ),
      h('dt', null, 'Sounding voices'),
      h('dd', null, app.audio.ctx ? String(app.chains.voiceCount()) : 'n/a'),
      h('dt', null, 'Sample memory'),
      h('dd', null, `${Math.round(app.packStore.totalMemory() / 1048576)} MB`),
      h('dt', null, 'Held keys'),
      h(
        'dd',
        null,
        `${app.patchEngine.heldCount} held · ${app.patchEngine.sustainedCount} sustained`,
      ),
    );
  }

  let last = '';
  function render(s) {
    const key = JSON.stringify([
      s.runtime.audio,
      s.runtime.midi.status,
      s.runtime.midi.devices,
      s.settings,
    ]);
    if (key !== last) {
      last = key;
      renderAudio(s);
      renderMidi(s);
    }
    renderDiag(s);
  }
  const unsub = store.subscribe(render);
  render(S());
  const diagTimer = setInterval(() => renderDiag(S()), 1000);
  return () => {
    unsub();
    offMidi();
    clearInterval(diagTimer);
  };
}

function qwertyCard() {
  const names = { Semicolon: ';' };
  const keys = Object.entries(KEY_OFFSETS).map(
    ([code, off]) =>
      `${names[code] ?? code.replace('Key', '')} = ${noteName(60 + off)
        .replace('4', '')
        .replace('5', '+')}`,
  );
  return h(
    'div',
    { class: 'card' },
    h('h2', null, 'Computer keyboard'),
    h(
      'p',
      null,
      'Play with the letter keys when no text field is selected. Middle row A S D F G H J K L ; are white keys; W E T Y U O P are black keys.',
    ),
    h('p', { class: 'muted mono' }, keys.join('  ·  ')),
    h(
      'p',
      null,
      'Z / X: octave down / up · C / V: softer / louder · hold Space: sustain pedal · Esc: panic · ← → or Page Up/Down: previous / next patch · Ctrl+S: save.',
    ),
  );
}

function systemCheck(capabilities) {
  return h(
    'div',
    { class: 'card' },
    h('h2', null, 'System check'),
    h(
      'p',
      { class: 'muted' },
      'STAGECRAFT is built for desktop Chrome and Edge. Results are for this browser.',
    ),
    h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'table' },
        h(
          'thead',
          null,
          h(
            'tr',
            null,
            h('th', null, 'Feature'),
            h('th', null, 'Status'),
            h('th', null, 'Why it matters'),
          ),
        ),
        h(
          'tbody',
          null,
          capabilities.map((c) =>
            h(
              'tr',
              { 'data-capability': c.id },
              h('th', { scope: 'row' }, c.label),
              h(
                'td',
                null,
                h(
                  'span',
                  { class: `pill ${c.ok ? 'ok' : c.required ? 'bad' : 'warn'}` },
                  h('span', { html: icon(c.ok ? 'check' : 'cross', 14) }),
                  c.ok ? 'Available' : c.required ? 'Missing (required)' : 'Not available',
                ),
              ),
              h('td', { class: 'muted' }, c.help),
            ),
          ),
        ),
      ),
    ),
  );
}

function about() {
  return h(
    'div',
    { class: 'card' },
    h('h2', null, 'About'),
    h(
      'dl',
      { class: 'facts' },
      h('dt', null, 'Version'),
      h('dd', null, __APP_VERSION__),
      h('dt', null, 'Build'),
      h('dd', null, __BUILD_SHA__),
      h('dt', null, 'Privacy'),
      h('dd', null, 'Everything runs in your browser. No data leaves this device.'),
    ),
  );
}
