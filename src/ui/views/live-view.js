import { h } from '../dom.js';
import { icon } from '../icons.js';
import { summarise } from '../../core/capabilities.js';

/**
 * Live (performance) workspace. In Phase 0 there is no sound engine yet, so
 * this view shows an honest empty state plus a real browser readiness check.
 */
export function renderLiveView(container, { capabilities }) {
  const summary = summarise(capabilities);

  const readiness = summary.ready
    ? h(
        'p',
        { class: 'readiness ok', 'data-testid': 'readiness' },
        h('span', { html: icon('check', 18) }),
        'This browser has everything STAGECRAFT needs.',
      )
    : h(
        'p',
        { class: 'readiness bad', 'data-testid': 'readiness' },
        h('span', { html: icon('cross', 18) }),
        'This browser is missing required features. See Settings → System check.',
      );

  container.replaceChildren(
    h(
      'section',
      { class: 'live-empty', 'aria-labelledby': 'live-title' },
      h('p', { class: 'eyebrow' }, 'Live performance'),
      h('h1', { id: 'live-title', class: 'live-title' }, 'No concert loaded'),
      h(
        'p',
        { class: 'lead' },
        'This is the foundation build. Sound arrives in Phase 1, MIDI keyboards in Phase 2, ',
        'instruments in Phase 3 and concerts, patches and setlists in Phase 4.',
      ),
      readiness,
      h(
        'ol',
        { class: 'phase-track', 'aria-label': 'Build progress' },
        phase(0, 'Foundation', 'current'),
        phase(1, 'Audio engine'),
        phase(2, 'Keyboard & MIDI'),
        phase(3, 'Instruments'),
        phase(4, 'Live performance'),
        phase(5, 'V1 release'),
      ),
    ),
  );
}

function phase(n, label, state = 'todo') {
  return h(
    'li',
    { class: `phase ${state}`, 'aria-current': state === 'current' ? 'step' : false },
    h('span', { class: 'phase-num' }, String(n)),
    h('span', { class: 'phase-label' }, label),
  );
}
