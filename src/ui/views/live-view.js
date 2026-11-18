import { h, replace } from '../dom.js';
import { icon } from '../icons.js';
import { createKeyboard } from '../components/keyboard.js';
import { noteName } from '../../core/math.js';
import { neighbours, orderedPatches } from '../../performance/concert-model.js';
import { getInstrument, presetsFor } from '../../instruments/registry.js';

/**
 * Live performance workspace (LIVE-040): large patch name readable from a
 * distance, previous/next, setlist, layer status, cue notes, keyboard.
 */
export function renderLiveView(container, { app }) {
  const { store, bus } = app;
  const keyboard = createKeyboard({
    onNoteOn: (n, v) => app.sendBytes([0x90, n, v], 'screen'),
    onNoteOff: (n) => app.sendBytes([0x80, n, 64], 'screen'),
  });
  const offNotes = bus.on('notes:active', (m) => keyboard.setActive(m));

  const setlist = h('nav', { class: 'setlist', 'aria-label': 'Setlist' });
  const stage = h('div', { class: 'stage' });
  replace(
    container,
    h(
      'section',
      { class: 'live', 'aria-label': 'Live performance' },
      setlist,
      stage,
      h('div', { class: 'kbd-area' }, keyboard.el),
    ),
  );
  requestAnimationFrame(() => keyboard.centre(60));

  let lastKey = '';
  function render(s) {
    const c = s.concert;
    const pid = s.session.activePatchId;
    const key = JSON.stringify([
      c?.id,
      c?.sets,
      pid,
      c && pid ? c.patches[pid] : null,
      s.runtime.audio.state,
      s.runtime.packs,
      c && orderedPatches(c).map((x) => x.patch.name),
    ]);
    if (key === lastKey) return;
    lastKey = key;
    if (!c) {
      replace(stage, h('p', { class: 'muted' }, 'Loading concert…'));
      return;
    }
    renderSetlist(c, pid);
    renderStage(s, c, pid);
  }

  function renderSetlist(c, pid) {
    let n = 0;
    replace(
      setlist,
      ...c.sets.map((set) =>
        h(
          'div',
          { class: 'set' },
          h('h2', { class: 'set-name' }, set.name),
          h(
            'ol',
            { class: 'set-patches' },
            set.patchIds.map((id) => {
              const p = c.patches[id];
              n++;
              return h(
                'li',
                null,
                h(
                  'button',
                  {
                    type: 'button',
                    class: `patch-btn${id === pid ? ' active' : ''}`,
                    'aria-current': id === pid ? 'true' : false,
                    'data-patch': id,
                    onclick: () => app.selectPatch(id),
                  },
                  h('span', { class: 'patch-num' }, String(n)),
                  h('span', { class: 'patch-label' }, p.name),
                  p.programChange ? h('span', { class: 'pc' }, `PC ${p.programChange}`) : null,
                ),
              );
            }),
          ),
        ),
      ),
    );
  }

  function renderStage(s, c, pid) {
    const patch = c.patches[pid];
    const nb = neighbours(c, pid);
    if (!patch) {
      replace(stage, h('p', null, 'No patch selected.'));
      return;
    }
    keyboard.setZones(
      patch.layers.map((l) => ({ low: l.zone.low, high: l.zone.high, muted: l.mute })),
    );

    const running = s.runtime.audio.state === 'running';
    const gate = running
      ? null
      : h(
          'div',
          { class: 'audio-gate' },
          h(
            'button',
            { class: 'btn btn-accent btn-xl', type: 'button', onclick: () => app.startAudio() },
            h('span', { html: icon('power', 20) }),
            'Start audio',
          ),
          h('p', { class: 'muted' }, 'Browsers need one click before they play sound.'),
        );

    replace(
      stage,
      h(
        'p',
        { class: 'eyebrow stage-pos', 'data-testid': 'patch-position' },
        `${nb.current?.set.name ?? ''} · ${nb.index + 1} of ${nb.total}`,
      ),
      h('h1', { class: 'patch-name', 'data-testid': 'patch-name' }, patch.name),
      h(
        'div',
        { class: 'nav-row' },
        h(
          'button',
          {
            class: 'btn nav-btn',
            type: 'button',
            disabled: !nb.prev,
            onclick: () => app.stepPatch(-1),
            'aria-label': nb.prev ? `Previous patch: ${nb.prev.patch.name}` : 'No previous patch',
          },
          h('span', { class: 'kbd-hint' }, '←'),
          h('span', null, nb.prev ? nb.prev.patch.name : 'Start of concert'),
        ),
        h(
          'button',
          {
            class: 'btn nav-btn next',
            type: 'button',
            disabled: !nb.next,
            onclick: () => app.stepPatch(1),
            'data-testid': 'next-patch',
            'aria-label': nb.next ? `Next patch: ${nb.next.patch.name}` : 'No next patch',
          },
          h('span', null, nb.next ? nb.next.patch.name : 'End of concert'),
          h('span', { class: 'kbd-hint' }, '→'),
        ),
      ),
      gate,
      h(
        'ul',
        { class: 'layer-chips', 'aria-label': 'Layers in this patch' },
        patch.layers.map((l, i) => layerChip(l, i, s)),
      ),
      patch.notes
        ? h('div', { class: 'cue' }, h('p', { class: 'eyebrow' }, 'Cue'), h('p', null, patch.notes))
        : null,
    );
  }

  function layerChip(l, i, s) {
    const meta = getInstrument(l.instrument.id);
    const preset = presetsFor(l.instrument.id).find((p) => p.id === l.instrument.presetId);
    const pack = meta?.pack ? s.runtime.packs[meta.pack] : null;
    let status = null;
    if (meta?.pack && s.runtime.audio.state === 'running') {
      if (!pack || pack.state === 'loading') {
        const pct = Math.round((pack?.progress ?? 0) * 100);
        status = h('span', { class: 'chip-status loading' }, `Loading ${pct}%`);
      } else if (pack.state === 'error') {
        status = h(
          'button',
          {
            class: 'chip-status bad',
            type: 'button',
            onclick: () => app.loadPackFor(l.instrument.id),
          },
          'Failed. Retry',
        );
      }
    }
    return h(
      'li',
      {
        class: `layer-chip${l.mute ? ' muted-layer' : ''}`,
        style: `--chip:var(--zone-${(i % 8) + 1})`,
      },
      h('span', { class: 'chip-swatch', 'aria-hidden': 'true' }),
      h(
        'span',
        { class: 'chip-text' },
        h('strong', null, l.name || meta?.name),
        h(
          'span',
          { class: 'muted' },
          `${preset?.name ?? ''} · ${noteName(l.zone.low)}–${noteName(l.zone.high)}${l.mute ? ' · muted' : ''}`,
        ),
      ),
      status,
    );
  }

  const unsub = store.subscribe(render);
  render(store.getState());
  keyboard.setActive(app.patchEngine.activeNotes());

  return () => {
    unsub();
    offNotes();
    keyboard.dispose();
  };
}
