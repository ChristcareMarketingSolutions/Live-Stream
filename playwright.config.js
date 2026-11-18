import { defineConfig, devices } from '@playwright/test';

// The e2e suite runs against the production build served under the same
// subpath GitHub Pages uses, so broken asset paths fail here first (T-003).
const BASE_PATH = '/Live-Stream/';
const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    env: { BASE_PATH },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
