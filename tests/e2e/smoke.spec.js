import { test, expect } from '@playwright/test';
import { watchConsole, openApp } from './helpers.js';

test('T-001 app loads the last concert without console errors', async ({ page }) => {
  const problems = watchConsole(page);
  await openApp(page);
  await expect(page.locator('.brand-name')).toHaveText('STAGECRAFT');
  await expect(page.getByTestId('patch-name')).toHaveText('Grand Piano');
  await expect(page).toHaveURL(/#\/live$/);
  expect(problems).toEqual([]);
});

test('T-002 hash routing works and survives a reload', async ({ page }) => {
  await openApp(page);
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await expect(page.locator('.nav-item.active')).toHaveAttribute('data-workspace', 'settings');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
  await page.goto('./#/does-not-exist');
  await expect(page).toHaveURL(/#\/live$/);
});

test('T-003 production build loads all assets under the Pages subpath', async ({ page }) => {
  const failed = [];
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url()}`);
  });
  await page.goto('./#/settings');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /^\/Live-Stream\//);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(14, 17, 22)');
  expect(failed).toEqual([]);
});

test('unbuilt workspaces are visibly disabled and say which phase delivers them', async ({
  page,
}) => {
  await openApp(page);
  const daw = page.locator('[data-workspace="daw"]');
  await expect(daw).toHaveAttribute('aria-disabled', 'true');
  await expect(daw).toHaveAttribute('title', 'Coming in Phase 8');
  await expect(page.locator('[data-workspace="mixer"]')).toHaveAttribute(
    'title',
    'Coming in Phase 6',
  );
});

test('system check lists Web Audio and Web MIDI as available in Chromium', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.locator('[data-capability="web-audio"] .pill')).toHaveText('Available');
  await expect(page.locator('[data-capability="web-midi"] .pill')).toHaveText('Available');
});

for (const route of ['live', 'edit', 'library', 'settings']) {
  test(`no horizontal page scroll at phone width: ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    await openApp(page, route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
