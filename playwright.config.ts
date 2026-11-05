import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/navigation-fallback.spec.ts',
  workers: 1,
  outputDir: 'test-results/regular',
  reporter: [
    ['dot'],
    ['json', {outputFile: 'test-results/regular/results.json'}],
  ],
  use: {baseURL: 'http://127.0.0.1:8788', screenshot: 'only-on-failure'},
  webServer: [
    {
      command: 'pnpm preview --port 8788',
      url: 'http://127.0.0.1:8788/api/health',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command:
        'node --experimental-transform-types tests/fixtures/photo-server.ts',
      url: 'https://127.0.0.1:8789/api/health',
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      grep: /@(?:all-browsers|chromium(?:-only)?)\b/v,
      use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 800}},
    },
    {
      name: 'firefox',
      // Every ordinary scenario runs on the frame's engine unless it explicitly
      // targets another platform. Extra engines are selected by scenario tags.
      grepInvert: /@(?:chromium|mobile)-only\b/v,
      use: {
        ...devices['Desktop Firefox'],
        viewport: {width: 1280, height: 800},
      },
    },
    {
      name: 'webkit',
      grep: /@(?:all-browsers|webkit)\b/v,
      use: {...devices['Desktop Safari'], viewport: {width: 1280, height: 800}},
    },
    {
      name: 'mobile',
      grep: /@(?:all-browsers|mobile(?:-only)?)\b/v,
      use: {...devices['iPhone 13'], defaultBrowserType: 'webkit'},
    },
  ],
});
