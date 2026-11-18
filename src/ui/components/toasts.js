import { h } from '../dom.js';

/** Error and info toasts. Errors stay 10 s, info 4 s; both dismissable. */
export function createToasts(bus) {
  const region = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  document.body.append(region);

  function show(kind, message) {
    const close = h(
      'button',
      { class: 'toast-close', type: 'button', 'aria-label': 'Dismiss' },
      '×',
    );
    const el = h('div', { class: `toast ${kind}` }, h('span', null, message), close);
    region.append(el);
    const remove = () => el.remove();
    close.addEventListener('click', remove);
    setTimeout(remove, kind === 'error' ? 10000 : 4000);
    while (region.children.length > 4) region.firstChild.remove();
  }

  bus.on('error', ({ message, detail }) => {
    console.error(message, detail);
    show('error', message);
  });
  bus.on('toast', ({ message }) => show('info', message));
  return { show };
}
