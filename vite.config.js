import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

// BASE_PATH is set by the GitHub Pages workflow (e.g. "/Live-Stream/").
// Locally it defaults to "/". Use "./" for a relocatable build.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify((process.env.GITHUB_SHA ?? 'local').slice(0, 7)),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
