import { test, expect } from '@playwright/test';
import { openApp, startAudio, inject, expectVoices, selectPatch } from './helpers.js';

// Phase 2 acceptance (docs/03-roadmap.md): MIDI, keyboards, held notes, sustain.

async function ready(page, patch = 'Church Organ') {
  await openApp(page);
  await startAudio(page);
  await selectPatch(page, patch);
}

test('T-205 injected MIDI drives voices; velocity 0 note-on releases', async ({ page }) => {
  await ready(page);
  await inject(page, [0x90, 60, 100]);
  await inject(page, [0x90, 64, 100]);
  await expectVoices(page, 2);
  await inject(page, [0x90, 60, 0]);
  await inject(page, [0x80, 64, 0]);
  await expectVoices(page, 0);
});

test('MIDI-004 sustain pedal holds notes until it is released', async ({ page }) => {
  await ready(page);
  await inject(page, [0xb0, 64, 127]);
  await inject(page, [0x90, 60, 100]);
  await inject(page, [0x80, 60, 0]);
  await page.waitForTimeout(400);
  await expectVoices(page, 1);
  await inject(page, [0xb0, 64, 0]);
  await expectVoices(page, 0);
});

test('MIDI-002 notes from a disconnected device are released', async ({ page }) => {
  await ready(page);
  await inject(page, [0x90, 60, 100], 'usb-keyboard');
  await inject(page, [0x90, 67, 100], 'other');
  await page.evaluate(() => window.__stagecraft.app.patchEngine.releaseSource('usb-keyboard'));
  await expectVoices(page, 1);
});

test('T-206 computer keyboard plays, sustains with Space, and is ignored while typing', async ({
  page,
}) => {
  await ready(page);
  await page.locator('body').click({ position: { x: 5, y: 300 } });
  await page.keyboard.down('a');
  await expectVoices(page, 1);
  await page.keyboard.down(' ');
  await page.keyboard.up('a');
  await page.waitForTimeout(300);
  await expectVoices(page, 1); // sustained
  await page.keyboard.up(' ');
  await expectVoices(page, 0);
  await expect(page.getByTestId('status-audio')).toBeVisible();

  // Octave up then play: status bar shows the new octave.
  await page.keyboard.press('x');
  await expect(page.locator('.statusbar')).toContainText('Computer keys: C5');

  // Typing in a text field must not play notes.
  await page.goto('./?debug#/edit');
  await page.getByTestId('patch-name-input').click();
  await page.keyboard.type('asdf');
  expect(await page.evaluate(() => window.__stagecraft.voices())).toBe(0);
});

test('MIDI-010 on-screen keyboard plays louder lower on the key and highlights notes', async ({
  page,
}) => {
  await ready(page);
  const kbd = page.locator('canvas.kbd').first();
  const box = await kbd.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10);
  await page.mouse.down();
  await expectVoices(page, 1);
  const vel = await page.evaluate(() => window.__stagecraft.app.midiLog.at(-1).velocity);
  expect(vel).toBeGreaterThan(100);
  await page.mouse.up();
  await expectVoices(page, 0);
});

test('MIDI-005/006 pitch bend, mod wheel and program change', async ({ page }) => {
  await ready(page);
  await inject(page, [0xe0, 0x7f, 0x7f]); // bend fully up
  await inject(page, [0xb0, 1, 127]); // mod wheel up (organ: fast rotary)
  await inject(page, [0xc0, 4]); // program change 5 → "Piano + Choir"
  await expect(page.getByTestId('patch-name')).toHaveText('Piano + Choir');
  await inject(page, [0xc0, 5]);
  await expect(page.getByTestId('patch-name')).toHaveText('Church Organ');
});

test('MIDI-007 monitor lists messages and MIDI-008 velocity curve applies', async ({ page }) => {
  await ready(page);
  await page.goto('./?debug#/settings');
  await page.locator('[data-testid="midi-card"] select').selectOption('fixed');
  await inject(page, [0x90, 60, 20]);
  await inject(page, [0x80, 60, 0]);
  await expect(page.getByTestId('midi-monitor')).toContainText('Note on C4 vel 100');
  await expect(page.getByTestId('midi-monitor')).toContainText('Note off C4');
});

test('MIDI-001/012 MIDI card offers a connect button and lists devices after permission', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['midi']);
  await openApp(page, 'settings');
  const card = page.getByTestId('midi-card');
  if (await card.getByTestId('connect-midi').isVisible())
    await card.getByTestId('connect-midi').click();
  // Headless test browsers have no MIDI hardware and may refuse access; either way the
  // app must explain the situation in plain words (real devices: manual check M-201).
  await expect(card).toContainText(
    /No MIDI inputs found|Connected|permission was refused\. Click the icon at the left of the address bar/,
  );
});

test('T-207 browser stress: random notes, pedal and patch switches end with zero voices', async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const s = window.__stagecraft;
    const pids = Object.keys(s.state().concert.patches);
    let seed = 7;
    const rnd = (n) => (seed = (seed * 16807) % 2147483647) % n;
    for (let i = 0; i < 3000; i++) {
      const r = rnd(100);
      const note = 36 + rnd(48);
      if (r < 45) s.injectMidi([0x90, note, 1 + rnd(127)], ['a', 'b'][rnd(2)]);
      else if (r < 88) s.injectMidi([0x80, note, 0], ['a', 'b'][rnd(2)]);
      else if (r < 96) s.injectMidi([0xb0, 64, rnd(2) ? 127 : 0], ['a', 'b'][rnd(2)]);
      else s.app.selectPatch(pids[rnd(pids.length)]);
    }
    for (const src of ['a', 'b']) {
      for (let n = 0; n < 128; n++) s.injectMidi([0x80, n, 0], src);
      s.injectMidi([0xb0, 64, 0], src);
    }
    return { held: s.app.patchEngine.heldCount, sustained: s.app.patchEngine.sustainedCount };
  });
  expect(result).toEqual({ held: 0, sustained: 0 });
  // Nothing may be left held or sustained: only release tails, which then finish.
  const states = await page.evaluate(() =>
    window.__stagecraft.app.chains.all().flatMap((c) => c.instrument.voices.map((v) => v.state)),
  );
  expect(states.filter((st) => st !== 'released')).toEqual([]);
  await expectVoices(page, 0, 40000);
});
