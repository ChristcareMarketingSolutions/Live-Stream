import { expect } from '@playwright/test';

/** Collect console errors/warnings, page errors and failed requests (T-001). */
export function watchConsole(page) {
  const problems = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  page.on('requestfailed', (req) => problems.push(`requestfailed: ${req.url()}`));
  return problems;
}

/** Open the app with the test hook and wait for the concert to load. */
export async function openApp(page, route = 'live') {
  await page.goto(`./?debug#/${route}`);
  await page.waitForFunction(() => window.__stagecraft?.state().concert);
}

/** Click Start audio (a real user gesture) and wait for the engine. */
export async function startAudio(page) {
  await page.getByTestId('start-audio').click();
  await page.waitForFunction(
    () =>
      window.__stagecraft.app.audio.fx &&
      window.__stagecraft.state().runtime.audio.state === 'running',
  );
}

export const inject = (page, bytes, source = 'debug') =>
  page.evaluate(([b, s]) => window.__stagecraft.injectMidi(b, s), [bytes, source]);

export const voices = (page) => page.evaluate(() => window.__stagecraft.voices());

export const render = (page, opts) =>
  page.evaluate((o) => window.__stagecraft.renderOffline(o), opts);

export async function expectVoices(page, n, timeout = 3000) {
  await expect.poll(() => voices(page), { timeout }).toBe(n);
}

export const db = (x) => 20 * Math.log10(Math.max(x, 1e-9));

/** Make the named patch active (synth patches need no sample download). */
export const selectPatch = (page, name) =>
  page.evaluate((n) => {
    const s = window.__stagecraft;
    const p = Object.values(s.state().concert.patches).find((x) => x.name === n);
    s.app.selectPatch(p.id);
  }, name);
