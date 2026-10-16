import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
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
      use: {...devices['Desktop Chrome'], viewport: {width: 1280, height: 800}},
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: {width: 1280, height: 800},
      },
    },
    {
      name: 'webkit',
      use: {...devices['Desktop Safari'], viewport: {width: 1280, height: 800}},
    },
    {
      name: 'mobile',
      use: {...devices['iPhone 13'], defaultBrowserType: 'webkit'},
    },
  ],
});
