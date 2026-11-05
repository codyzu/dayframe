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
  // Navigation/storage contracts need all three engines. Mobile WebKit covers
  // WebKit here; this suite has no desktop/phone-specific interaction variants.
  projects: base
    .projects!.filter((project) => project.name !== 'webkit')
    .map((project) => ({...project, grep: /.*/v, grepInvert: []})),
  use: {...base.use, baseURL: 'http://127.0.0.1:8790'},
  webServer: {
    command:
      'node --experimental-transform-types tests/fixtures/offline-server.ts',
    url: 'http://127.0.0.1:8790/api/health',
    reuseExistingServer: false,
  },
});
