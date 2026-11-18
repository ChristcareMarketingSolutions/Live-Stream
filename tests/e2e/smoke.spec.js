import { test, expect } from '@playwright/test';

/** Collect console errors/warnings and page errors for T-001. */
function watchConsole(page) {
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));
  return problems;
}

test('T-001 app shell loads without console errors', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'No concert loaded' })).toBeVisible();
  await expect(page.locator('.brand-name')).toHaveText('STAGECRAFT');
  await expect(page).toHaveURL(/#\/live$/);
  expect(problems).toEqual([]);
});

test('T-002 hash routing works and survives a reload', async ({ page }) => {
  await page.goto('./');
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
  const css = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(css).toBe('rgb(14, 17, 22)');
  expect(failed).toEqual([]);
});

test('unbuilt workspaces are visibly disabled and say which phase delivers them', async ({
  page,
}) => {
  await page.goto('./');
  const daw = page.locator('[data-workspace="daw"]');
  await expect(daw).toHaveAttribute('aria-disabled', 'true');
  await expect(daw).toHaveAttribute('title', 'Coming in Phase 8');
  await expect(page.getByRole('button', { name: 'Panic' })).toBeDisabled();
});

test('system check lists Web Audio and Web MIDI as available in Chromium', async ({ page }) => {
  await page.goto('./#/settings');
  await expect(page.locator('[data-capability="web-audio"] .pill')).toHaveText('Available');
  await expect(page.locator('[data-capability="web-midi"] .pill')).toHaveText('Available');
  await page.goto('./#/live');
  await expect(page.getByTestId('readiness')).toContainText('everything STAGECRAFT needs');
});

test('layout has no horizontal scroll at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto('./#/settings');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
