import {Buffer} from 'node:buffer';
import {expect, test} from '../fixtures/browser.ts';
import {auditFocus} from '../fixtures/focus-audit.ts';
import {fixtureNow, sevenDayFixture} from '../fixtures/weather.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';

const origin = 'https://127.0.0.1:8789';
const photo = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
  'base64',
);
test.use({baseURL: origin, ignoreHTTPSErrors: true});
test.beforeEach(async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.clock.install({time: fixtureNow});
  // Leave a future deadline so installation latency cannot make pauseAt go backwards.
  await page.clock.pauseAt(fixtureNow + 60_000);
  await page.request.get('/__test/reset');
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: sevenDayFixture()}),
  );
});

test('dashboard vacation layout, all modes and forecast controls have complete focus rings', async ({
  page,
}, info) => {
  await page.request.get('/__test/login');
  await page.route('**/api/calendar/events', async (route) =>
    route.fulfill({
      json: {
        connected: false,
        events: [],
        timezone: 'Europe/Paris',
        fetchedAt: fixtureNow,
      },
    }),
  );
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({
      json: {
        ...defaultSettings,
        planning: {schoolCalendar: true, schedules: {}, checkpoints: {}},
      },
    }),
  );
  await page.route('**/api/day-context', async (route) =>
    route.fulfill({
      json: {
        calendar: {
          year: 2026,
          fetchedAt: fixtureNow,
          knownFrom: '2026-01-01',
          knownUntil: '2026-12-31',
          vacations: [
            {
              start: '2026-10-15',
              end: '2026-10-19',
              label: 'Vacances de la Toussaint',
            },
          ],
          holidays: {},
        },
      },
    }),
  );
  await page.route('**/api/photos**', async (route) =>
    route.fulfill(
      new URL(route.request().url()).pathname === '/api/photos'
        ? {
            json: {
              photos: ['a', 'b'].map((id) => ({
                id: id.repeat(64),
                width: 1,
                height: 1,
                size: photo.length,
                contentType: 'image/webp',
              })),
              cursor: null,
            },
          }
        : {contentType: 'image/webp', body: photo},
    ),
  );
  await page.goto('/?display=frame');
  await expect(page.locator('[data-checkpoint-heading]')).toContainText(
    /calendrier à confirmer|Toussaint/v,
  );
  await page.clock.fastForward(1000);
  await expect(page.locator('[data-checkpoint-heading]')).toContainText(
    'Toussaint',
  );
  const failures = await auditFocus(page, page.locator('body'), info, {
    name: 'morning',
  });
  await page.evaluate(() => {
    globalThis.scrollTo(0, 0);
  });
  failures.push(
    ...(await auditFocus(page, page.locator('.weather-notes'), info, {
      name: 'morning-native-focus',
      scroll: false,
    })),
  );
  if (info.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
  }

  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  failures.push(
    ...(await auditFocus(page, page.getByRole('dialog'), info, {
      name: 'forecast',
    })),
  );
  await page.getByRole('dialog').locator('summary').click();
  await page.getByRole('dialog').evaluate((dialog) => {
    dialog.scrollTop = dialog.scrollHeight;
  });
  failures.push(
    ...(await auditFocus(
      page,
      page.getByRole('dialog').locator('.sticky'),
      info,
      {name: 'forecast-sticky', scroll: false},
    )),
  );
  await page.getByRole('button', {name: 'Fermer'}).click();
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-controls]')).toBeVisible();
  await page.getByRole('button', {name: 'Suivante', exact: true}).click();
  await expect(
    page.getByRole('button', {name: 'Précédente', exact: true}),
  ).toBeEnabled();
  failures.push(
    ...(await auditFocus(page, page.locator('body'), info, {name: 'photos'})),
  );
  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  failures.push(
    ...(await auditFocus(page, page.locator('body'), info, {name: 'night'})),
  );
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.abort(),
  );
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page.locator('[data-display-retry]')).toBeVisible();
  failures.push(
    ...(await auditFocus(page, page.locator('body'), info, {
      name: 'display-retry',
    })),
  );
  await page.evaluate(() => {
    globalThis.scrollTo(0, 0);
  });
  failures.push(
    ...(await auditFocus(page, page.locator('.weather-notes'), info, {
      name: 'retry-native-focus',
      scroll: false,
    })),
  );
  expect(failures).toEqual([]);
});

test('settings buttons including generated rows and calendar actions have complete rings', async ({
  page,
}, info) => {
  await page.request.get('/__test/login');
  await page.route('**/api/calendar', async (route) =>
    route.fulfill({
      json: {
        configured: true,
        connected: true,
        selected: {id: 'family', name: 'Famille'},
      },
    }),
  );
  await page.route('**/api/calendar/calendars', async (route) =>
    route.fulfill({json: {calendars: [{id: 'family', name: 'Famille'}]}}),
  );
  await page.goto('/admin/settings');
  await expect(page.locator('[data-issue]')).toBeEnabled();
  await page.locator('[data-add-day-period]').click();
  await page.locator('[data-add-checkpoint]').click();
  page.once('dialog', async (dialog) => dialog.accept());
  await page.locator('[data-issue]').click();
  await expect(page.locator('[data-hide-token]')).toBeVisible();
  await expect(page.locator('[data-calendar-save]')).toBeEnabled();
  await expect(page.locator('[data-calendar-disconnect]')).toBeVisible();
  expect(
    await auditFocus(page, page.locator('body'), info, {name: 'settings'}),
  ).toEqual([]);
});

test('setup and clipboard experiment buttons have complete rings', async ({
  page,
}, info) => {
  await page.goto('/setup/');
  const failures = await auditFocus(page, page.locator('body'), info, {
    name: 'setup',
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async read() {
          const canvas = globalThis.document.createElement('canvas');
          canvas.width = 32;
          canvas.height = 32;
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((image) => {
              resolve(image!);
            }, 'image/png');
          });
          return [
            {
              types: ['image/png'],
              async getType() {
                return blob;
              },
            },
          ];
        },
      },
    });
  });
  await page.goto('/experiments/photo-paste/');
  await page.locator('[data-paste]').click();
  await expect(page.locator('[data-process]')).toBeEnabled();
  failures.push(
    ...(await auditFocus(page, page.locator('body'), info, {name: 'paste'})),
  );
  expect(failures).toEqual([]);
});

test('photo administration controls, gallery and import previews have complete rings', async ({
  page,
}, info) => {
  await page.request.get('/__test/login');
  await page.goto('/admin/photos');
  await expect(page.locator('[data-choose-files]')).toBeEnabled();
  const png = await page.evaluate(() => {
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    canvas.getContext('2d')!.fillRect(0, 0, 64, 32);
    return canvas.toDataURL('image/png').split(',', 2)[1];
  });
  await page.locator('[data-photo-files]').setInputFiles({
    name: 'audit.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.locator('[data-import-add]')).toBeEnabled();
  const failures = await auditFocus(page, page.locator('body'), info, {
    name: 'photo-import',
  });
  await page.route('**/api/photos', async (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 503,
          json: {error: {message: 'Synthetic upload failure'}},
        })
      : route.continue(),
  );
  await page.locator('[data-import-add]').click();
  await expect(page.locator('[data-upload-retry]')).toBeVisible();
  failures.push(
    ...(await auditFocus(page, page.locator('body'), info, {
      name: 'photo-retry',
    })),
  );
  await page.unroute('**/api/photos');
  await page.locator('[data-upload-retry]').click();
  await expect(page.locator('[data-delete]')).toBeVisible();
  failures.push(
    ...(await auditFocus(page, page.locator('body'), info, {
      name: 'photo-gallery',
    })),
  );
  await page.locator('[data-photo-files]').setInputFiles({
    name: 'similar-audit.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([
      Buffer.from(png, 'base64'),
      Buffer.from('synthetic-variation'),
    ]),
  });
  await page.locator('[data-import-add]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  failures.push(
    ...(await auditFocus(page, page.getByRole('dialog'), info, {
      name: 'photo-similar',
    })),
  );
  expect(failures).toEqual([]);
});
