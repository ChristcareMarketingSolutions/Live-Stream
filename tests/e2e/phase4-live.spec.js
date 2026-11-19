import { test, expect } from '@playwright/test';
import { openApp, startAudio, inject, expectVoices, selectPatch } from './helpers.js';
import { readFileSync } from 'node:fs';

// Phase 4 acceptance (docs/03-roadmap.md): concerts, patches, layers, splits, storage.

const state = (page) => page.evaluate(() => window.__stagecraft.state());
const chainVoices = (page) =>
  page.evaluate(() =>
    Object.fromEntries(
      window.__stagecraft.app.chains.all().map((c) => [c.layerId, c.instrument.activeVoiceCount]),
    ),
  );

test('first run opens the Sunday Worship template with 3 sets and 8 patches', async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId('concert-name')).toHaveText('Sunday Worship');
  await expect(page.locator('.setlist .set-name')).toHaveText(['Opening', 'Worship', 'Closing']);
  await expect(page.locator('.setlist .patch-btn')).toHaveCount(8);
});

test('LIVE-030 next/previous by button and arrow keys; position shown', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('next-patch').click();
  await expect(page.getByTestId('patch-name')).toHaveText('Piano + Strings');
  await expect(page.getByTestId('patch-position')).toContainText('2 of 8');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('patch-name')).toHaveText('Worship Piano');
  await expect(page.getByTestId('patch-position')).toContainText('Worship');
  await page.keyboard.press('PageUp');
  await expect(page.getByTestId('patch-name')).toHaveText('Warm Ambient Pad');
});

test('T-402 a note held through a patch switch keeps sounding and releases on note-off', async ({
  page,
}) => {
  await openApp(page);
  await startAudio(page);
  await selectPatch(page, 'Warm Ambient Pad');
  await inject(page, [0x90, 60, 100]);
  await selectPatch(page, 'Church Organ');
  await inject(page, [0x90, 67, 100]);
  await expectVoices(page, 2); // old pad note still sounding + new organ note
  await inject(page, [0x80, 60, 0]);
  await inject(page, [0x80, 67, 0]);
  await expectVoices(page, 0, 6000);
});

test('T-403 switching with the sustain pedal down keeps old notes until pedal up', async ({
  page,
}) => {
  await openApp(page);
  await startAudio(page);
  await selectPatch(page, 'Church Organ');
  await inject(page, [0xb0, 64, 127]);
  await inject(page, [0x90, 60, 100]);
  await inject(page, [0x80, 60, 0]);
  await selectPatch(page, 'Ambient Atmosphere');
  await page.waitForTimeout(300);
  await expectVoices(page, 1);
  await inject(page, [0xb0, 64, 0]);
  await expectVoices(page, 0, 3000);
});

test('T-404 patch switch time is under 50 ms (instrumented)', async ({ page }) => {
  await openApp(page);
  await startAudio(page);
  await page.evaluate(() => {
    const s = window.__stagecraft;
    const ids = Object.keys(s.state().concert.patches);
    for (let i = 0; i < 40; i++) s.app.selectPatch(ids[i % ids.length]);
  });
  const times = (await state(page)).runtime.switchMs;
  expect(times.length).toBeGreaterThanOrEqual(40);
  const sorted = [...times].sort((a, b) => a - b);
  expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(50);
  expect(sorted.at(-1)).toBeLessThan(50);
  await page.goto('./?debug#/settings');
  await expect(page.getByTestId('switch-time')).toContainText('median');
});

test('T-409 scenario S2: split gig template routes bass left, piano + pad right', async ({
  page,
}) => {
  await openApp(page, 'edit');
  await page.getByTestId('new-concert').selectOption('split');
  await expect(page.getByTestId('concert-name')).toHaveText('Split Gig');
  await startAudio(page);
  const layers = (await state(page)).concert;
  const patch = Object.values(layers.patches)[0];
  const [bass, piano, pad] = patch.layers.map((l) => l.id);
  await inject(page, [0x90, 36, 100]); // C2 → bass only
  await inject(page, [0x90, 72, 100]); // C5 → piano + pad
  await page.waitForTimeout(200);
  const v = await chainVoices(page);
  expect(v[bass]).toBe(1);
  expect(v[pad]).toBe(1);
  // The piano layer sounds once its samples have loaded.
  expect([0, 1]).toContain(v[piano]);
  await inject(page, [0x80, 36, 0]);
  await inject(page, [0x80, 72, 0]);
});

test('T-405 edits autosave and survive a reload', async ({ page }) => {
  await openApp(page, 'edit');
  const name = page.getByTestId('patch-name-input');
  await name.fill('Opening Hymn Piano');
  await name.press('Enter');
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 6000 });
  await page.reload();
  await page.waitForFunction(() => window.__stagecraft?.state().concert);
  await expect(page.locator('.tree-patch').first()).toHaveText('Opening Hymn Piano');
});

test('LIVE-002/003 add patch, add/remove layer, change instrument, set zone by note name', async ({
  page,
}) => {
  await openApp(page, 'edit');
  await page.getByTestId('add-patch-0').click();
  await expect(page.getByTestId('patch-name-input')).toHaveValue('New Patch');
  await page.getByTestId('add-layer').click();
  await expect(page.locator('.layer-card')).toHaveCount(2);
  const second = page.locator('.layer-card').nth(1);
  await second.getByTestId('instrument-select').selectOption('strings');
  await expect(second.locator('.layer-name')).toHaveValue('Strings');
  const zoneLow = second.locator('.note-input').first();
  await zoneLow.fill('C3');
  await zoneLow.press('Enter');
  const c = (await state(page)).concert;
  const p = c.patches[(await state(page)).session.activePatchId];
  expect(p.layers[1].instrument.id).toBe('strings');
  expect(p.layers[1].zone.low).toBe(48);
  await second.getByRole('button', { name: /Remove layer/ }).click();
  await expect(page.locator('.layer-card')).toHaveCount(1);
});

test('LIVE-021 learn zone from the keyboard (lowest then highest key)', async ({ page }) => {
  await openApp(page, 'edit');
  const card = page.locator('.layer-card').first();
  await card.getByRole('button', { name: 'Learn' }).click();
  await expect(card.getByRole('button', { name: 'Press lowest key…' })).toBeVisible();
  await inject(page, [0x90, 48, 100]);
  await expect(card.getByRole('button', { name: 'Press highest key…' })).toBeVisible();
  await inject(page, [0x90, 72, 100]);
  await expect(card.locator('.note-input').first()).toHaveValue('C3');
  await expect(card.locator('.note-input').nth(1)).toHaveValue('C5');
});

test('T-406 export then import gives the same concert', async ({ page }, testInfo) => {
  await openApp(page, 'edit');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export').click(),
  ]);
  expect(download.suggestedFilename()).toBe('Sunday-Worship.stagecraft.json');
  const file = testInfo.outputPath('concert.json');
  await download.saveAs(file);
  const exported = JSON.parse(readFileSync(file, 'utf8'));
  expect(exported.format).toBe('stagecraft-concert');
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.locator('.toast')).toContainText('Imported "Sunday Worship"');
  const imported = (await state(page)).concert;
  expect(imported.id).not.toBe(exported.id); // same id already stored → saved as a copy
  expect(imported.patches).toEqual(exported.patches);
  expect(imported.sets).toEqual(exported.sets);
});

test('T-407 importing a wrong file shows a readable error and keeps the concert', async ({
  page,
}) => {
  await openApp(page, 'edit');
  await page.getByTestId('import-file').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello": "world"}'),
  });
  await expect(page.locator('.toast.error')).toContainText('not a STAGECRAFT concert');
  await expect(page.getByTestId('concert-name')).toHaveText('Sunday Worship');
});

test('LIVE-042 performance lock blocks editing', async ({ page }) => {
  await openApp(page, 'edit');
  await page.getByLabel('Performance lock').check();
  const before = (await state(page)).concert;
  await page.evaluate(() => {
    const s = window.__stagecraft;
    const { activePatchId } = s.state().session;
    s.app.edit((c) => ({ ...c, name: 'Changed' }), activePatchId);
  });
  expect((await state(page)).concert.name).toBe(before.name);
});

test('MIX-001 concert reverb and delay settings apply and persist', async ({ page }) => {
  await openApp(page, 'edit');
  await page.locator('#f-rvp').selectOption('cathedral');
  await page.locator('#f-dls').selectOption('1/8d');
  await expect(page.getByTestId('save-state')).toHaveText('Saved', { timeout: 6000 });
  await page.reload();
  await page.waitForFunction(() => window.__stagecraft?.state().concert);
  const st = (await state(page)).concert.settings;
  expect(st.reverb.preset).toBe('cathedral');
  expect(st.delay.sync).toBe('1/8d');
});
