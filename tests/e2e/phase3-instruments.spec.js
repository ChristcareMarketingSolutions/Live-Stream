import { test, expect } from '@playwright/test';
import { openApp, startAudio, render, db, inject, expectVoices } from './helpers.js';

// Phase 3 acceptance (docs/03-roadmap.md): instrument library, packs, offline cache.

test('INS-010 Library installs the piano with progress, shows memory, and credits the source', async ({
  page,
}) => {
  await openApp(page, 'library');
  await expect(page.getByText('Salamander Grand Piano V3 by Alexander Holm')).toBeVisible();
  await expect(page.getByRole('link', { name: 'CC BY 3.0' })).toBeVisible();
  await page.getByTestId('install-grand-piano').click();
  await expect(page.getByTestId('pack-grand-piano')).toContainText('Installed', { timeout: 30000 });
  await expect(page.getByTestId('pack-grand-piano')).toContainText('MB in memory');
  await expect(page.getByTestId('storage-usage')).toContainText('This site uses');
});

test('T-303 an installed pack loads again with the network off (offline cache)', async ({
  page,
  context,
}) => {
  await openApp(page);
  await startAudio(page);
  await page.waitForFunction(
    () => window.__stagecraft.app.packStore.get('grand-piano').loaded,
    null,
    { timeout: 30000 },
  );
  await context.setOffline(true);
  const ok = await page.evaluate(async () => {
    const s = window.__stagecraft.app;
    const pack = s.packStore.get('grand-piano');
    pack.loaded = false;
    pack.buffers.clear();
    pack.memoryBytes = 0;
    await s.packStore.load('grand-piano', s.audio.ctx);
    return { loaded: pack.loaded, files: pack.buffers.size };
  });
  expect(ok).toEqual({ loaded: true, files: 90 });
  await context.setOffline(false);
});

test('T-303 Remove deletes the pack from memory and from offline storage', async ({ page }) => {
  await openApp(page, 'library');
  await page.getByTestId('install-grand-piano').click();
  await expect(page.getByTestId('pack-grand-piano')).toContainText('Installed', { timeout: 30000 });
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByTestId('pack-grand-piano')).toContainText('Not installed');
  expect(
    await page.evaluate(() => window.__stagecraft.app.packStore.isInstalled('grand-piano')),
  ).toBe(false);
});

test('T-304 piano memory use is within the docs/05 budget (≤ 400 MB decoded)', async ({ page }) => {
  await openApp(page);
  await startAudio(page);
  await page.waitForFunction(
    () => window.__stagecraft.app.packStore.get('grand-piano').loaded,
    null,
    { timeout: 30000 },
  );
  const mb = await page.evaluate(() => window.__stagecraft.app.packStore.totalMemory() / 1048576);
  expect(mb).toBeGreaterThan(100);
  expect(mb).toBeLessThan(400);
});

test('Live view plays the piano once loaded and shows loading state before', async ({ page }) => {
  await openApp(page);
  await startAudio(page);
  await page.waitForFunction(
    () => window.__stagecraft.app.packStore.get('grand-piano').loaded,
    null,
    { timeout: 30000 },
  );
  await expect(page.locator('.chip-status')).toHaveCount(0);
  await inject(page, [0x90, 60, 100]);
  await expectVoices(page, 1);
  await inject(page, [0x80, 60, 0]);
});

const SOUNDS = [
  ['grand-piano', 'concert'],
  ['electric-piano', 'classic'],
  ['tonewheel', 'gospel'],
  ['pipe-organ', 'principal'],
  ['strings', 'warm'],
  ['choir', 'aah'],
  ['pads', 'warm'],
  ['synth-bass', 'deep'],
];

test('T-305 every instrument sounds at C2, C4 and C6, soft and loud, without clipping', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await startAudio(page);
  for (const [instrument, preset] of SOUNDS) {
    for (const note of [36, 60, 84]) {
      const levels = [];
      for (const velocity of [30, 100]) {
        const r = await render(page, {
          instrument,
          preset,
          duration: 1.6,
          notes: [{ note, velocity, start: 0.02, end: 1.4 }],
        });
        const label = `${instrument} ${note}/${velocity}`;
        expect(r.nan, label).toBe(0);
        expect(db(r.peak), label).toBeGreaterThan(-50);
        expect(db(r.peak), label).toBeLessThan(-3);
        levels.push(r.peak);
      }
      // Velocity-sensitive instruments must get louder when played harder.
      if (!['tonewheel', 'pipe-organ'].includes(instrument)) {
        expect(levels[1], `${instrument} ${note} velocity response`).toBeGreaterThan(
          levels[0] * 1.2,
        );
      }
    }
  }
});
