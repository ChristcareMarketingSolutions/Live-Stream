import { h } from '../dom.js';
import { icon } from '../icons.js';

/** Settings workspace. Phase 0: system check and build information. */
export function renderSettingsView(container, { capabilities }) {
  const rows = capabilities.map((c) =>
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
  );

  container.replaceChildren(
    h(
      'section',
      { class: 'panel-page', 'aria-labelledby': 'settings-title' },
      h('h1', { id: 'settings-title' }, 'Settings'),
      h(
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
            h('tbody', null, rows),
          ),
        ),
      ),
      h(
        'div',
        { class: 'card' },
        h('h2', null, 'Audio and MIDI'),
        h(
          'p',
          { class: 'muted' },
          'Audio device, latency and MIDI input settings arrive in Phases 1 and 2.',
        ),
      ),
      h(
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
      ),
    ),
  );
}
