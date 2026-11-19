import { test, expect } from '@playwright/test';
import {
  openApp,
  startAudio,
  inject,
  expectVoices,
  render,
  db,
  watchConsole,
  selectPatch,
} from './helpers.js';

// Phase 1 acceptance (docs/03-roadmap.md): audio engine and first synth.

test('AUD-001/002 Start audio runs the context and reports latency', async ({ page }) => {
  const problems = watchConsole(page);
  await openApp(page);
  await expect(page.getByTestId('status-audio')).toContainText('click Start audio');
  await startAudio(page);
  await expect(page.getByTestId('start-audio')).toBeHidden();
  await expect(page.getByTestId('status-audio')).toContainText(/kHz/);
  await page.goto('./?debug#/settings');
  expect(problems).toEqual([]);
});

test('T-101 a note starts a voice and its note-off releases it', async ({ page }) => {
  await openApp(page);
  await startAudio(page);
  await page.evaluate(() =>
    window.__stagecraft.app.selectPatch(
      Object.values(window.__stagecraft.state().concert.patches).find(
        (p) => p.name === 'Church Organ',
      ).id,
    ),
  );
  await inject(page, [0x90, 60, 100]);
  await expectVoices(page, 1);
  await inject(page, [0x80, 60, 0]);
  await expectVoices(page, 0);
});

test('T-102 64 simultaneous voices render without NaN or clipping through the master bus', async ({
  page,
}) => {
  await openApp(page);
  await startAudio(page);
  const notes = Array.from({ length: 64 }, (_, i) => ({
    note: 36 + i,
    velocity: 127,
    start: 0.01,
    end: 1.0,
  }));
  for (const [instrument, preset] of [
    ['analog-synth', 'lead'],
    ['grand-piano', 'bright'],
    ['pads', 'worship'],
  ]) {
    const r = await render(page, { instrument, preset, notes, duration: 1.5, master: true });
    expect(r.nan, instrument).toBe(0);
    expect(r.peak, `${instrument} peak ${db(r.peak).toFixed(1)} dB`).toBeLessThan(1.0);
    expect(r.rms, instrument).toBeGreaterThan(0.001);
  }
});

test('T-104 Panic (button and Esc) silences everything immediately', async ({ page }) => {
  await openApp(page);
  await startAudio(page);
  await selectPatch(page, 'Church Organ');
  for (const n of [48, 52, 55, 60, 64]) await inject(page, [0x90, n, 100]);
  await expectVoices(page, 5);
  await page.keyboard.press('Escape');
  await expectVoices(page, 0, 100);
  for (const n of [48, 52]) await inject(page, [0x90, n, 100]);
  await page.getByTestId('panic').click();
  await expectVoices(page, 0, 100);
  // After panic the instrument plays normally again.
  await inject(page, [0x90, 60, 100]);
  await expectVoices(page, 1);
});

const PRESETS = {
  'grand-piano': ['concert', 'bright', 'mellow', 'worship'],
  'electric-piano': ['classic', 'tremolo', 'bell'],
  tonewheel: ['gospel', 'ballad', 'jazz', 'full', 'soft'],
  'pipe-organ': ['principal', 'flutes', 'full'],
  strings: ['warm', 'fast', 'swell'],
  choir: ['aah', 'ooh'],
  pads: ['warm', 'worship', 'shimmer', 'air', 'dark', 'swell'],
  'synth-bass': ['deep', 'round', 'punchy'],
  'analog-synth': ['lead', 'softsaw', 'bell'],
};

test('T-105/T-106 every preset: level ≈ -12 dBFS, no NaN, no clicks, release decays to silence', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await openApp(page);
  await startAudio(page);
  for (const [instrument, presets] of Object.entries(PRESETS)) {
    for (const preset of presets) {
      const note = instrument === 'synth-bass' ? 36 : 60;
      const r = await render(page, {
        instrument,
        preset,
        duration: 8,
        notes: [{ note, velocity: 100, start: 0.05, end: 2.0 }],
        windows: [[7.6, 8]],
      });
      const label = `${instrument}/${preset}`;
      expect(r.nan, label).toBe(0);
      expect(db(r.peak), label).toBeGreaterThan(-13.5);
      expect(db(r.peak), label).toBeLessThan(-10.5);
      expect(r.maxDelta, `${label} click`).toBeLessThan(0.2);
      expect(db(r.windows[0]), `${label} tail`).toBeLessThan(-80); // T-105
    }
  }
});

test('AUD-003 master volume and limiter settings persist across reload', async ({ page }) => {
  await openApp(page, 'settings');
  const slider = page.getByTestId('master-volume');
  await slider.fill('-12');
  await expect(page.getByTestId('audio-card')).toContainText('-12 dB');
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => window.__stagecraft?.state().settings.masterVolumeDb === -12);
});
