import { h, replace } from '../dom.js';
import { createKeyboard } from '../components/keyboard.js';
import { noteName, parseNoteName, clamp } from '../../core/math.js';
import * as C from '../../performance/concert-model.js';
import {
  INSTRUMENTS,
  presetsFor,
  defaultPreset,
  getInstrument,
} from '../../instruments/registry.js';
import { REVERB_PRESETS, DELAY_DIVISIONS } from '../../audio/fx-buses.js';
import { downloadConcert, readConcertFile } from '../../storage/file-io.js';

/**
 * Patch editor (LIVE-001..003, LIVE-010/011/020/021/041/042, STO-003).
 * Re-renders only when structure changes so sliders keep working while dragged.
 */
export function renderEditView(container, { app }) {
  const { store, bus } = app;
  const S = () => store.getState();
  const keyboard = createKeyboard({
    onNoteOn: (n, v) => app.sendBytes([0x90, n, v], 'screen'),
    onNoteOff: (n) => app.sendBytes([0x80, n, 64], 'screen'),
  });
  const offNotes = bus.on('notes:active', (m) => keyboard.setActive(m));

  const bar = h('div', { class: 'edit-bar' });
  const tree = h('nav', { class: 'tree', 'aria-label': 'Sets and patches' });
  const inspector = h('div', { class: 'inspector' });
  replace(
    container,
    h(
      'section',
      { class: 'edit', 'aria-label': 'Edit concert' },
      bar,
      h('div', { class: 'edit-grid' }, tree, inspector),
      h('div', { class: 'kbd-area' }, keyboard.el),
    ),
  );
  requestAnimationFrame(() => keyboard.centre(60));

  // ---------------------------------------------------------------- helpers
  const edit = (...args) => app.edit(...args);
  const pid = () => S().session.activePatchId;
  const layerEdit = (layerId, changes) => edit(C.updateLayer, pid(), layerId, changes);

  const fid = (...parts) => parts.join(':');
  function field(label, control, hint) {
    return h(
      'label',
      { class: 'field' },
      h('span', { class: 'field-label' }, label),
      control,
      hint ? h('span', { class: 'field-hint' }, hint) : null,
    );
  }
  function select(id, options, value, onChange, attrs = {}) {
    return h(
      'select',
      { 'data-fid': id, id: `f-${id}`, onchange: (e) => onChange(e.target.value), ...attrs },
      options.map(([v, label]) =>
        h('option', { value: v, selected: String(v) === String(value) }, label),
      ),
    );
  }
  function text(id, value, onChange, attrs = {}) {
    return h('input', {
      type: 'text',
      'data-fid': id,
      id: `f-${id}`,
      value: value ?? '',
      onchange: (e) => onChange(e.target.value),
      ...attrs,
    });
  }
  function num(id, value, min, max, onChange, attrs = {}) {
    return h('input', {
      type: 'number',
      'data-fid': id,
      id: `f-${id}`,
      value: value ?? '',
      min,
      max,
      step: 1,
      onchange: (e) => {
        if (e.target.value === '') return onChange(null);
        const v = clamp(Math.round(Number(e.target.value)), min, max);
        e.target.value = v;
        onChange(v);
      },
      ...attrs,
    });
  }
  /** Slider that edits live while dragging and shows its value. */
  function slider(id, value, min, max, step, format, onInput) {
    const out = h('output', { class: 'slider-val', for: `f-${id}` }, format(value));
    const input = h('input', {
      type: 'range',
      'data-fid': id,
      id: `f-${id}`,
      min,
      max,
      step,
      value,
      oninput: (e) => {
        const v = Number(e.target.value);
        out.textContent = format(v);
        onInput(v);
      },
    });
    return h('span', { class: 'slider' }, input, out);
  }
  function check(id, label, value, onChange) {
    return h(
      'label',
      { class: 'check' },
      h('input', {
        type: 'checkbox',
        'data-fid': id,
        id: `f-${id}`,
        checked: !!value,
        onchange: (e) => onChange(e.target.checked),
      }),
      label,
    );
  }
  function noteInput(id, value, onChange) {
    return h('input', {
      type: 'text',
      class: 'note-input',
      'data-fid': id,
      id: `f-${id}`,
      value: noteName(value),
      'aria-label': 'Note name, for example C4',
      onchange: (e) => {
        const n = parseNoteName(e.target.value);
        if (n === null) {
          e.target.value = noteName(value);
          bus.emit('toast', { message: 'Type a note name such as C4, F#2 or Bb5.' });
          return;
        }
        onChange(n);
      },
    });
  }
  const dbFmt = (v) => (v <= -60 ? 'Off' : `${v > 0 ? '+' : ''}${v} dB`);
  const panFmt = (v) =>
    v === 0 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`;
  const btn = (label, onclick, attrs = {}) =>
    h('button', { type: 'button', class: 'btn btn-sm', onclick, ...attrs }, label);

  // ---------------------------------------------------------------- top bar
  let confirmDelete = false;
  function renderBar(s) {
    const c = s.concert;
    const fileInput = h('input', {
      type: 'file',
      accept: '.json,application/json',
      class: 'visually-hidden',
      id: 'import-file',
      'data-testid': 'import-file',
      onchange: async (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        const r = await readConcertFile(file);
        if (!r.ok) {
          bus.emit('error', {
            code: 'import-failed',
            message: `Import failed: ${r.errors.slice(0, 3).join(' ')}`,
          });
          return;
        }
        let concert = r.concert;
        if (s.session.concertList.some((x) => x.id === concert.id))
          concert = { ...concert, id: C.newId('c') };
        await app.openConcert(concert, { save: true });
        bus.emit('toast', { message: `Imported "${concert.name}".` });
      },
    });
    const list = s.session.concertList.length
      ? s.session.concertList
      : c
        ? [{ id: c.id, name: c.name }]
        : [];
    replace(
      bar,
      field(
        'Concert',
        select(
          'concert',
          list.map((x) => [x.id, x.name]),
          c?.id,
          (id) => app.switchConcert(id),
          { 'data-testid': 'concert-select' },
        ),
      ),
      field(
        'Name',
        text('concert-name', c?.name, (v) => v.trim() && edit((cc) => ({ ...cc, name: v.trim() }))),
      ),
      h(
        'div',
        { class: 'bar-actions' },
        select(
          'new',
          [
            ['', 'New…'],
            ['empty', 'Empty concert'],
            ['worship', 'Sunday Worship template'],
            ['split', 'Split gig template'],
          ],
          '',
          (v) => {
            const make = {
              empty: C.emptyConcert,
              worship: C.sundayWorshipTemplate,
              split: C.splitGigTemplate,
            }[v];
            if (make) app.openConcert(make(), { save: true });
          },
          { 'aria-label': 'New concert', 'data-testid': 'new-concert' },
        ),
        btn('Duplicate', () => app.openConcert(C.duplicateConcert(S().concert), { save: true })),
        btn(
          confirmDelete ? 'Confirm delete' : 'Delete',
          () => {
            if (!confirmDelete) {
              confirmDelete = true;
              renderBar(S());
              setTimeout(() => {
                confirmDelete = false;
                renderBar(S());
              }, 4000);
              return;
            }
            confirmDelete = false;
            app.deleteConcert(S().concert.id);
          },
          { class: `btn btn-sm${confirmDelete ? ' btn-danger' : ''}` },
        ),
        h(
          'label',
          {
            class: 'btn btn-sm',
            for: 'import-file',
            tabindex: '0',
            role: 'button',
            onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && fileInput.click(),
          },
          'Import',
        ),
        fileInput,
        btn('Export', () => downloadConcert(S().concert), { 'data-testid': 'export' }),
        btn('Save now', () => app.saveNow(), { title: 'Ctrl+S' }),
        check('lock', 'Performance lock', s.session.locked, (v) => app.setSession({ locked: v })),
      ),
    );
  }

  // ---------------------------------------------------------------- tree
  function renderTree(s) {
    const c = s.concert;
    const active = s.session.activePatchId;
    replace(
      tree,
      ...c.sets.map((set, si) =>
        h(
          'div',
          { class: 'tree-set' },
          h(
            'div',
            { class: 'tree-set-head' },
            text(
              fid('set', set.id),
              set.name,
              (v) => edit(C.renameSet, set.id, v.trim() || set.name),
              {
                'aria-label': 'Set name',
                class: 'set-name-input',
              },
            ),
            btn('↑', () => edit(C.moveSet, set.id, -1), {
              disabled: si === 0,
              'aria-label': `Move set ${set.name} up`,
            }),
            btn('↓', () => edit(C.moveSet, set.id, 1), {
              disabled: si === c.sets.length - 1,
              'aria-label': `Move set ${set.name} down`,
            }),
            btn('✕', () => edit(C.removeSet, set.id), {
              disabled: c.sets.length <= 1,
              'aria-label': `Delete set ${set.name} and its patches`,
              title: 'Delete set and its patches',
            }),
          ),
          h(
            'ol',
            { class: 'tree-patches' },
            set.patchIds.map((id) =>
              h(
                'li',
                { class: id === active ? 'active' : '' },
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'tree-patch',
                    'data-patch': id,
                    onclick: () => app.selectPatch(id),
                    'aria-current': id === active ? 'true' : false,
                  },
                  c.patches[id].name,
                ),
                btn('↑', () => edit(C.movePatch, id, -1), {
                  'aria-label': `Move ${c.patches[id].name} up`,
                }),
                btn('↓', () => edit(C.movePatch, id, 1), {
                  'aria-label': `Move ${c.patches[id].name} down`,
                }),
              ),
            ),
          ),
          btn(
            '+ Patch',
            () => {
              const p = C.defaultPatch();
              edit(C.addPatch, set.id, p);
              app.selectPatch(p.id);
            },
            { class: 'btn btn-sm btn-ghost', 'data-testid': `add-patch-${si}` },
          ),
        ),
      ),
      btn('+ Set', () => edit(C.addSet), { class: 'btn btn-sm btn-ghost' }),
    );
  }

  // ---------------------------------------------------------------- inspector
  function renderInspector(s) {
    const c = s.concert;
    const p = c.patches[s.session.activePatchId];
    if (!p) {
      replace(inspector, h('p', null, 'Select a patch.'));
      return;
    }
    keyboard.setZones(p.layers.map((l) => ({ low: l.zone.low, high: l.zone.high, muted: l.mute })));
    const learn = s.session.learnZone;

    replace(
      inspector,
      h(
        'div',
        { class: 'card patch-card' },
        h(
          'div',
          { class: 'card-head' },
          h('h2', null, 'Patch'),
          h(
            'div',
            { class: 'row' },
            btn('Duplicate patch', () => {
              let newId = null;
              edit((cc) => {
                const r = C.duplicatePatch(cc, p.id);
                newId = r.patchId;
                return r.concert;
              });
              if (newId) app.selectPatch(newId);
            }),
            btn(
              'Delete patch',
              () => {
                const n = C.neighbours(c, p.id);
                const nextId = (n.next ?? n.prev)?.patch.id;
                edit(C.removePatch, p.id);
                if (nextId) app.selectPatch(nextId);
              },
              { disabled: Object.keys(c.patches).length <= 1 },
            ),
          ),
        ),
        h(
          'div',
          { class: 'fields' },
          field(
            'Name',
            text(
              fid('pname', p.id),
              p.name,
              (v) => edit(C.updatePatch, p.id, { name: v.trim() || p.name }),
              { 'data-testid': 'patch-name-input' },
            ),
          ),
          field(
            'Program change',
            num(fid('pc', p.id), p.programChange, 1, 128, (v) =>
              edit(C.updatePatch, p.id, { programChange: v }),
            ),
            '1–128, blank for none',
          ),
          field(
            'Tempo (BPM)',
            num(fid('tempo', p.id), p.tempo, 30, 300, (v) =>
              edit(C.updatePatch, p.id, { tempo: v }),
            ),
            `Blank uses concert tempo (${c.settings.tempo})`,
          ),
        ),
        field(
          'Cue notes',
          h(
            'textarea',
            {
              rows: 2,
              'data-fid': fid('notes', p.id),
              onchange: (e) => edit(C.updatePatch, p.id, { notes: e.target.value }),
            },
            p.notes ?? '',
          ),
        ),
      ),
      h(
        'div',
        { class: 'layers-head' },
        h('h2', null, `Layers (${p.layers.length}/${C.MAX_LAYERS})`),
        btn(
          '+ Add layer',
          () => {
            const inst = 'pads';
            edit(
              C.addLayer,
              p.id,
              C.defaultLayer({
                name: 'Pad',
                instrument: { id: inst, presetId: defaultPreset(inst) },
                volumeDb: -8,
              }),
            );
          },
          { disabled: p.layers.length >= C.MAX_LAYERS, 'data-testid': 'add-layer' },
        ),
      ),
      h(
        'div',
        { class: 'layers' },
        p.layers.map((l, i) => layerCard(p, l, i, learn)),
      ),
      concertSettings(c),
    );
  }

  function layerCard(p, l, i, learn) {
    const learning = learn && learn.layerId === l.id;
    const lid = l.id;
    return h(
      'article',
      { class: 'card layer-card', style: `--chip:var(--zone-${(i % 8) + 1})`, 'data-layer': lid },
      h(
        'div',
        { class: 'card-head' },
        h('span', { class: 'chip-swatch', 'aria-hidden': 'true' }),
        text(fid('lname', lid), l.name, (v) => layerEdit(lid, { name: v }), {
          'aria-label': 'Layer name',
          class: 'layer-name',
        }),
        check(fid('mute', lid), 'Mute', l.mute, (v) => layerEdit(lid, { mute: v })),
        check(fid('solo', lid), 'Solo', l.solo, (v) => layerEdit(lid, { solo: v })),
        btn('Remove', () => edit(C.removeLayer, p.id, lid), {
          disabled: p.layers.length <= 1,
          'aria-label': `Remove layer ${l.name}`,
        }),
      ),
      h(
        'div',
        { class: 'fields' },
        field(
          'Instrument',
          select(
            fid('inst', lid),
            INSTRUMENTS.map((x) => [
              x.id,
              `${x.name}${x.engine === 'sampler' ? ' (sampled)' : ''}`,
            ]),
            l.instrument.id,
            (v) =>
              layerEdit(lid, {
                name: getInstrument(v).name,
                instrument: { id: v, presetId: defaultPreset(v) },
              }),
            { 'data-testid': 'instrument-select' },
          ),
        ),
        field(
          'Sound',
          select(
            fid('preset', lid),
            presetsFor(l.instrument.id).map((x) => [x.id, x.name]),
            l.instrument.presetId,
            (v) => layerEdit(lid, { instrument: { presetId: v } }),
          ),
        ),
        field(
          'Volume',
          slider(fid('vol', lid), l.volumeDb, -40, 6, 1, dbFmt, (v) =>
            layerEdit(lid, { volumeDb: v }),
          ),
        ),
        field(
          'Pan',
          slider(fid('pan', lid), l.pan, -1, 1, 0.05, panFmt, (v) => layerEdit(lid, { pan: v })),
        ),
        field(
          'Reverb send',
          slider(fid('rev', lid), l.sends.reverb, -60, 0, 1, dbFmt, (v) =>
            layerEdit(lid, { sends: { reverb: v } }),
          ),
        ),
        field(
          'Delay send',
          slider(fid('dly', lid), l.sends.delay, -60, 0, 1, dbFmt, (v) =>
            layerEdit(lid, { sends: { delay: v } }),
          ),
        ),
      ),
      h(
        'div',
        { class: 'fields' },
        field(
          'Key zone',
          h(
            'span',
            { class: 'row' },
            noteInput(fid('zlo', lid), l.zone.low, (n) =>
              layerEdit(lid, { zone: { low: Math.min(n, l.zone.high) } }),
            ),
            h('span', { class: 'muted' }, 'to'),
            noteInput(fid('zhi', lid), l.zone.high, (n) =>
              layerEdit(lid, { zone: { high: Math.max(n, l.zone.low) } }),
            ),
            btn(
              learning
                ? learn.low === undefined
                  ? 'Press lowest key…'
                  : 'Press highest key…'
                : 'Learn',
              () =>
                app.setSession({ learnZone: learning ? null : { patchId: p.id, layerId: lid } }),
              {
                class: `btn btn-sm${learning ? ' btn-accent' : ''}`,
                title: 'Press the lowest then the highest key on your keyboard',
              },
            ),
          ),
        ),
        field(
          'Transpose',
          num(fid('tr', lid), l.transpose, -24, 24, (v) => layerEdit(lid, { transpose: v ?? 0 })),
          'semitones',
        ),
        field(
          'Octave',
          num(fid('oct', lid), l.octave, -3, 3, (v) => layerEdit(lid, { octave: v ?? 0 })),
        ),
        field(
          'MIDI channel',
          select(
            fid('ch', lid),
            [
              [0, 'Omni (all)'],
              ...Array.from({ length: 16 }, (_, k) => [k + 1, `Channel ${k + 1}`]),
            ],
            l.channel,
            (v) => layerEdit(lid, { channel: Number(v) }),
          ),
        ),
        field(
          'Velocity range',
          h(
            'span',
            { class: 'row' },
            num(
              fid('vlo', lid),
              l.velocity.low,
              1,
              127,
              (v) => layerEdit(lid, { velocity: { low: Math.min(v ?? 1, l.velocity.high) } }),
              { 'aria-label': 'Lowest velocity' },
            ),
            h('span', { class: 'muted' }, 'to'),
            num(
              fid('vhi', lid),
              l.velocity.high,
              1,
              127,
              (v) => layerEdit(lid, { velocity: { high: Math.max(v ?? 127, l.velocity.low) } }),
              { 'aria-label': 'Highest velocity' },
            ),
          ),
        ),
        field(
          'Bend range',
          num(fid('bend', lid), l.respond.bendRange, 0, 24, (v) =>
            layerEdit(lid, { respond: { bendRange: v ?? 2 } }),
          ),
          'semitones',
        ),
      ),
      h(
        'div',
        { class: 'row responds' },
        h('span', { class: 'field-label' }, 'Responds to'),
        check(fid('rs', lid), 'Sustain', l.respond.sustain, (v) =>
          layerEdit(lid, { respond: { sustain: v } }),
        ),
        check(fid('rx', lid), 'Expression', l.respond.expression, (v) =>
          layerEdit(lid, { respond: { expression: v } }),
        ),
        check(fid('rm', lid), 'Mod wheel', l.respond.modWheel, (v) =>
          layerEdit(lid, { respond: { modWheel: v } }),
        ),
        check(fid('rp', lid), 'Pitch bend', l.respond.pitchBend, (v) =>
          layerEdit(lid, { respond: { pitchBend: v } }),
        ),
      ),
    );
  }

  function concertSettings(c) {
    const st = c.settings;
    const set = (changes) => edit(C.updateSettings, changes);
    return h(
      'div',
      { class: 'card' },
      h('h2', null, 'Concert sound'),
      h(
        'div',
        { class: 'fields' },
        field(
          'Concert tempo (BPM)',
          num('ctempo', st.tempo, 30, 300, (v) => v && set({ tempo: v })),
        ),
        field(
          'Reverb',
          select(
            'rvp',
            Object.entries(REVERB_PRESETS).map(([k, v]) => [k, v.label]),
            st.reverb.preset,
            (v) => set({ reverb: { preset: v } }),
          ),
        ),
        field(
          'Reverb level',
          slider('rvl', st.reverb.returnDb, -40, 0, 1, dbFmt, (v) =>
            set({ reverb: { returnDb: v } }),
          ),
        ),
        field(
          'Delay time',
          select(
            'dls',
            Object.keys(DELAY_DIVISIONS).map((k) => [k, `${k} note`]),
            st.delay.sync,
            (v) => set({ delay: { sync: v } }),
          ),
        ),
        field(
          'Delay feedback',
          slider(
            'dlf',
            st.delay.feedback,
            0,
            0.9,
            0.05,
            (v) => `${Math.round(v * 100)}%`,
            (v) => set({ delay: { feedback: v } }),
          ),
        ),
        field(
          'Delay level',
          slider('dll', st.delay.returnDb, -40, 0, 1, dbFmt, (v) =>
            set({ delay: { returnDb: v } }),
          ),
        ),
      ),
    );
  }

  // ---------------------------------------------------------------- render
  let lastKey = '';
  function render(s) {
    const c = s.concert;
    if (!c) return;
    const p = c.patches[s.session.activePatchId];
    const key = JSON.stringify([
      c.id,
      c.name,
      c.sets,
      Object.values(c.patches).map((x) => [x.id, x.name]),
      s.session.activePatchId,
      p && { ...p, layers: p.layers.map((l) => ({ ...l, volumeDb: 0, pan: 0, sends: 0 })) },
      { ...c.settings, reverb: c.settings.reverb.preset, delay: [c.settings.delay.sync] },
      s.session.concertList,
      s.session.locked,
      s.session.learnZone,
    ]);
    if (key === lastKey) return;
    lastKey = key;
    const focused = document.activeElement?.dataset?.fid;
    renderBar(s);
    renderTree(s);
    renderInspector(s);
    container.querySelector('.edit').classList.toggle('locked', s.session.locked);
    if (focused) container.querySelector(`[data-fid="${CSS.escape(focused)}"]`)?.focus();
  }

  const unsub = store.subscribe(render);
  render(S());
  keyboard.setActive(app.patchEngine.activeNotes());
  return () => {
    unsub();
    offNotes();
    keyboard.dispose();
    if (S().session.learnZone) app.setSession({ learnZone: null });
  };
}
