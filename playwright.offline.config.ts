import {defineConfig} from '@playwright/test';
import base from './playwright.config.ts';

export default defineConfig({
  ...base,
  outputDir: 'test-results/navigation',
  reporter: [
    ['dot'],
    ['json', {outputFile: 'test-results/navigation/results.json'}],
  ],
  testMatch: '**/navigation-fallback.spec.ts',
  testIgnore: [],
  use: {...base.use, baseURL: 'http://127.0.0.1:8790'},
  webServer: {
    command:
      'node --experimental-transform-types tests/fixtures/offline-server.ts',
    url: 'http://127.0.0.1:8790/api/health',
    reuseExistingServer: false,
  },
});
