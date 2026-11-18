import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'playwright-report/', 'test-results/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: { ...globals.browser, __APP_VERSION__: 'readonly', __BUILD_SHA__: 'readonly' },
    },
  },
  {
    files: ['*.config.js', 'tests/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
