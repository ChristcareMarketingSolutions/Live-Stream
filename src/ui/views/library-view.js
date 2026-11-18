import { h, replace } from '../dom.js';
import { INSTRUMENTS, presetsFor } from '../../instruments/registry.js';
import { storageEstimate } from '../../storage/concert-repo.js';

const mb = (bytes) => `${Math.round((bytes / 1048576) * 10) / 10} MB`;

/** Instrument library (INS-010, STO-005) and credits for licensed samples. */
export function renderLibraryView(container, { app }) {
  const { store } = app;
  const list = h('div', { class: 'lib-list' });
  const storage = h('p', { class: 'muted', 'data-testid': 'storage-usage' }, 'Checking storage…');
  replace(
    container,
    h(
      'section',
      { class: 'panel-page', 'aria-labelledby': 'lib-title' },
      h('h1', { id: 'lib-title' }, 'Instrument library'),
      h(
        'p',
        { class: 'muted' },
        'Sampled instruments download once and are then stored in this browser for offline use. Synthesised instruments are built in and need no download.',
      ),
      list,
      h('div', { class: 'card' }, h('h2', null, 'Storage'), storage),
      h(
        'div',
        { class: 'card' },
        h('h2', null, 'Credits'),
        h(
          'p',
          null,
          'Grand Piano: Salamander Grand Piano V3 by Alexander Holm, SFZ mapping by kinwie, licensed under ',
          h(
            'a',
            {
              href: 'https://creativecommons.org/licenses/by/3.0/',
              target: '_blank',
              rel: 'noopener',
            },
            'CC BY 3.0',
          ),
          '. Shortened to 30 notes × 3 velocity layers and re-encoded for the web. ',
          h(
            'a',
            {
              href: 'https://github.com/sfzinstruments/SalamanderGrandPiano',
              target: '_blank',
              rel: 'noopener',
            },
            'Source',
          ),
          '.',
        ),
        h(
          'p',
          { class: 'muted' },
          'All other instruments, the reverb and the effects are synthesised by STAGECRAFT itself.',
        ),
      ),
    ),
  );

  const installed = new Map();
  async function refreshInstalled() {
    for (const inst of INSTRUMENTS.filter((i) => i.pack))
      installed.set(inst.pack, await app.packStore.isInstalled(inst.pack));
    const est = await storageEstimate();
    storage.textContent = est
      ? `This site uses ${mb(est.usage)} of ${mb(est.quota)} available in this browser.`
      : 'Storage usage is not available in this browser.';
    render(store.getState(), true);
  }

  let lastKey = '';
  function render(s, force = false) {
    const key = JSON.stringify([s.runtime.packs, s.runtime.audio.state]);
    if (!force && key === lastKey) return;
    lastKey = key;
    const groups = {};
    for (const inst of INSTRUMENTS) (groups[inst.category] ??= []).push(inst);
    replace(
      list,
      ...Object.entries(groups).map(([cat, items]) =>
        h(
          'div',
          { class: 'card' },
          h('h2', null, cat),
          h(
            'ul',
            { class: 'lib-items' },
            items.map((inst) => item(inst, s)),
          ),
        ),
      ),
    );
  }

  function item(inst, s) {
    const presets = presetsFor(inst.id)
      .map((p) => p.name)
      .join(' · ');
    let status;
    let action = null;
    if (inst.engine !== 'sampler') {
      status = h('span', { class: 'pill ok' }, 'Built in');
    } else {
      const p = s.runtime.packs[inst.pack] ?? {};
      const isInstalled = p.installed || installed.get(inst.pack);
      if (p.state === 'loading') {
        status = h(
          'span',
          {
            class: 'progress',
            role: 'progressbar',
            'aria-valuenow': Math.round((p.progress ?? 0) * 100),
            'aria-valuemin': 0,
            'aria-valuemax': 100,
          },
          h('span', {
            class: 'progress-bar',
            style: `width:${Math.round((p.progress ?? 0) * 100)}%`,
          }),
          h(
            'span',
            { class: 'progress-label' },
            `Downloading ${Math.round((p.progress ?? 0) * 100)}%`,
          ),
        );
      } else if (p.state === 'loaded') {
        status = h(
          'span',
          { class: 'pill ok', 'data-testid': `pack-${inst.pack}` },
          `Installed · ${mb(p.memoryBytes)} in memory`,
        );
        action = h(
          'button',
          { class: 'btn btn-sm', type: 'button', onclick: () => remove(inst.pack) },
          'Remove',
        );
      } else if (p.state === 'error') {
        status = h('span', { class: 'pill bad' }, 'Download failed');
        action = h(
          'button',
          { class: 'btn btn-sm', type: 'button', onclick: () => install(inst) },
          'Retry',
        );
      } else {
        status = h(
          'span',
          { class: `pill ${isInstalled ? 'ok' : 'warn'}`, 'data-testid': `pack-${inst.pack}` },
          isInstalled ? 'Installed for offline use' : `Not installed · ${inst.sizeMb} MB download`,
        );
        action = h(
          'button',
          {
            class: 'btn btn-sm btn-accent',
            type: 'button',
            onclick: () => install(inst),
            'data-testid': `install-${inst.pack}`,
          },
          isInstalled ? 'Load' : 'Install',
        );
      }
    }
    return h(
      'li',
      { class: 'lib-item' },
      h(
        'div',
        { class: 'lib-main' },
        h('strong', null, inst.name),
        h(
          'span',
          { class: 'muted' },
          `${inst.engine === 'sampler' ? 'Sampled' : 'Synthesised'} · ${presets}`,
        ),
      ),
      status,
      action,
    );
  }

  async function install(inst) {
    await app.startAudio();
    app.loadPackFor(inst.id);
  }

  async function remove(packId) {
    await app.packStore.remove(packId);
    installed.set(packId, false);
    render(store.getState(), true);
  }

  const unsub = store.subscribe((s) => render(s));
  render(store.getState(), true);
  refreshInstalled();
  const offLoaded = app.bus.on('pack:loaded', refreshInstalled);
  return () => {
    unsub();
    offLoaded();
  };
}
