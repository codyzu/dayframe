import {test as base} from '@playwright/test';
import {alertsFixture} from './alerts.ts';

// Every browser scenario owns its warning data; ordinary UI checks never call
// the live national feed. A test's later route can replace this clear bulletin.
const test = base.extend<{officialWarnings: void}>({
  officialWarnings: [
    async ({page}, use) => {
      await page.route('**/api/weather-alerts', async (route) => {
        const now = await page.evaluate(() => Date.now());
        await route.fulfill({
          contentType: 'application/atom+xml',
          body: alertsFixture([], now),
        });
      });
      await use();
    },
    {auto: true},
  ],
});

export {test};

export {expect} from '@playwright/test';
