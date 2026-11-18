import { h } from '../dom.js';
import { icon } from '../icons.js';
import { hrefFor } from '../router.js';
import { WORKSPACES } from '../../core/workspaces.js';

/**
 * Builds the persistent app frame: top bar, workspace sidebar, main area and
 * status bar. Controls for features not built yet are disabled and say which
 * phase delivers them (CLAUDE.md §3).
 */
export function createShell(root) {
  const main = h('main', { id: 'main', class: 'workspace', tabindex: '-1' });

  const navItems = WORKSPACES.map((ws) => {
    const enabled = ws.availableInPhase === undefined;
    const label = h('span', { class: 'nav-label' }, ws.label);
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
      label,
      enabled ? null : h('span', { class: 'nav-badge' }, `P${ws.availableInPhase}`),
    );
  });

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
      h('span', { class: 'topbar-concert-name' }, 'None loaded'),
    ),
    h(
      'div',
      { class: 'topbar-actions' },
      h(
        'button',
        { class: 'btn', type: 'button', disabled: true, title: 'Coming in Phase 1' },
        h('span', { html: icon('power', 16) }),
        'Start audio',
      ),
      h(
        'button',
        { class: 'btn btn-danger', type: 'button', disabled: true, title: 'Coming in Phase 1' },
        h('span', { html: icon('panic', 16) }),
        'Panic',
      ),
    ),
  );

  const statusAudio = h(
    'span',
    { class: 'status-item' },
    h('span', { class: 'led' }),
    'Audio: not started',
  );
  const statusMidi = h(
    'span',
    { class: 'status-item' },
    h('span', { class: 'led' }),
    'MIDI: not connected',
  );
  const statusbar = h(
    'footer',
    { class: 'statusbar' },
    statusAudio,
    statusMidi,
    h('span', { class: 'status-spacer' }),
    h('span', { class: 'status-item muted' }, `v${__APP_VERSION__} · ${__BUILD_SHA__}`),
  );

  const sidebar = h(
    'nav',
    { class: 'sidebar', 'aria-label': 'Workspaces' },
    h('div', { class: 'nav-list' }, navItems),
  );

  root.replaceChildren(
    h('a', { class: 'skip-link', href: '#main', onclick: skipToMain }, 'Skip to content'),
    topbar,
    sidebar,
    main,
    statusbar,
  );

  function skipToMain(event) {
    event.preventDefault();
    main.focus();
  }

  /** Highlight the active workspace in the sidebar. */
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
