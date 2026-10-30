import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {locationKey} from '../../src/lib/weather/location.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';
import {auditFocus} from '../fixtures/focus-audit.ts';
import {alertsFixture} from '../fixtures/alerts.ts';

const place = {
  name: 'New York',
  admin1: 'New York',
  country: 'États-Unis',
  latitude: 40.71,
  longitude: -74.01,
  timezone: 'America/New_York',
};

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const url = new URL(route.request().url());
    const raw = weatherFixture();
    raw.timezone =
      url.searchParams.get('timezone') === 'auto'
        ? 'America/New_York'
        : url.searchParams.get('timezone')!;
    raw.current.temperature_2m = raw.timezone === 'Europe/Paris' ? 12 : 24;
    await route.fulfill({json: raw});
  });
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) =>
    route.fulfill({json: {results: [place]}}),
  );
  await page.route('https://photon.komoot.io/**', async (route) =>
    route.fulfill({
      json: {
        features: [
          {
            properties: {
              osm_key: 'place',
              osm_value: 'city',
              name: 'New York',
            },
            geometry: {coordinates: [-74, 40.7]},
          },
        ],
      },
    }),
  );
});

test('search persists only on this device, keeps household time and resets to household', async ({
  page,
  browser,
}, testInfo) => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') {
      mutations.push(request.url());
    }
  });
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  const dialog = page.locator('[data-location-dialog]');
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel('Ville ou code postal')).toBeFocused();
  await page.getByLabel('Ville ou code postal').fill('New York');
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  await page.screenshot({
    path: testInfo.outputPath('location-search.png'),
    fullPage: false,
  });
  await dialog
    .getByRole('button', {name: 'New York, New York, États-Unis', exact: true})
    .click();
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
  await expect(page.locator('[data-clock]').first()).toHaveText('08:30');
  await expect(page.locator('[data-checkpoint-heading]')).toHaveText(
    'Les repères · heure du lieu',
  );
  await expect(page.locator('[data-alert-title]')).toHaveText(
    'Vigilance non configurée pour ce lieu',
  );
  await expect(dialog.locator('[data-location-current]')).toContainText(
    'America/New_York',
  );
  await page.screenshot({
    path: testInfo.outputPath('location-picker.png'),
    fullPage: true,
  });
  await dialog.getByRole('button', {name: 'Fermer', exact: true}).click();
  await expect(
    page.getByRole('button', {name: 'Changer le lieu météo'}),
  ).toBeFocused();
  await expect(page.locator('[data-location-scope]')).toBeVisible();
  if (testInfo.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
            globalThis.innerWidth &&
          globalThis.document.documentElement.scrollHeight <=
            globalThis.innerHeight,
      ),
    ).toBe(true);
  }

  await page.reload();
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
  await page.clock.fastForward(300_000);
  await expect(page.locator('[data-location]')).toContainText('New York');
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.route('https://api.open-meteo.com/**', async (route) =>
    route.abort(),
  );
  await otherPage.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
  await otherPage.route('**/api/weather-alerts', async (route) =>
    route.abort(),
  );
  await otherPage.goto('/');
  await expect(otherPage.locator('[data-location]')).toHaveText(
    'Météo · Annecy',
  );
  await other.close();
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page
    .getByRole('button', {name: 'Revenir au lieu de la maison'})
    .click();
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await expect(page.locator('[data-location]')).toHaveText('Météo · Annecy');
  expect(
    await page.evaluate((key) => localStorage.getItem(key), locationKey),
  ).toBeNull();
  expect(mutations).toEqual([]);
});

test('unavailable storage keeps the choice for this visit and reports it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error('Storage blocked');
    };
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page.getByLabel('Ville ou code postal').fill('New York');
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  await page.locator('[data-location-results] button').click();
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
  await expect(page.locator('[data-location-status]')).toContainText(
    'pour cette visite',
  );
  await page.reload();
  await expect(page.locator('[data-location]')).toHaveText('Météo · Annecy');
});

test('picker controls retain complete focus outlines and modal scrolling', async ({
  page,
}, info) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page.getByLabel('Ville ou code postal').fill('New York');
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  const dialog = page.locator('[data-location-dialog]');
  await expect(dialog.locator('[data-location-results] button')).toBeVisible();
  expect(
    await auditFocus(page, dialog, info, {name: 'weather-location'}),
  ).toEqual([]);
  await dialog
    .getByRole('link', {name: 'Modifier le lieu de la maison (administration)'})
    .focus();
  await expect(
    dialog.getByRole('link', {
      name: 'Modifier le lieu de la maison (administration)',
    }),
  ).toBeInViewport();
});

test('reset follows the latest household settings while refresh preserves a device choice', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page.getByLabel('Ville ou code postal').fill('New York');
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  await page.locator('[data-location-results] button').click();
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({
      json: {
        ...defaultSettings,
        location: 'Lyon',
        latitude: 45.75,
        longitude: 4.85,
      },
    }),
  );
  await page.clock.fastForward(300_000);
  await expect(page.locator('[data-location]')).toHaveText('Météo · New York');
  await page
    .getByRole('button', {name: 'Revenir au lieu de la maison'})
    .click();
  await expect(page.locator('[data-location]')).toHaveText('Météo · Lyon');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
});

test('a late response from the previous location cannot paint or cache over the new one', async ({
  page,
}) => {
  const {promise: gate, resolve: release} = Promise.withResolvers<void>();
  let isWaiting = false;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const timezone = new URL(route.request().url()).searchParams.get(
      'timezone',
    );
    const raw = weatherFixture();
    if (timezone === 'Europe/Paris') {
      isWaiting = true;
      await gate;
    } else {
      raw.timezone = timezone!;
      raw.current.temperature_2m = 24;
    }

    await route.fulfill({json: raw});
  });
  await page.goto('/');
  await expect.poll(() => isWaiting).toBe(true);
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page.getByLabel('Ville ou code postal').fill('New York');
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  await page.locator('[data-location-results] button').click();
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
  release();
  await page.clock.runFor(1000);
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
  const raw = await page.evaluate(() =>
    localStorage.getItem('dayframe.weather.v1.40.71.-74.01.America/New_York'),
  );
  const cached = JSON.parse(raw!) as {raw: {current: {temperature_2m: number}}};
  expect(cached.raw.current.temperature_2m).toBe(24);
});

test('current location is opt-in, preserves coordinates, estimates a city, and permission denial can recover', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    let calls = 0;
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition(
          success: PositionCallback,
          fail: PositionErrorCallback,
        ) {
          calls++;
          if (calls === 1) {
            fail({code: 1} as GeolocationPositionError);
          } else {
            success({
              coords: {latitude: 40.712345, longitude: -74.012345},
            } as GeolocationPosition);
          }
        },
      },
    });
  });
  const requests: string[] = [];
  const forecasts: string[] = [];
  page.on('request', (request) => {
    if (
      new URL(request.url()).searchParams.get('timezone') === 'America/New_York'
    ) {
      forecasts.push(request.url());
    }

    if (
      request.url().includes('timezone=auto') ||
      request.url().startsWith('https://photon.komoot.io/')
    ) {
      requests.push(request.url());
    }
  });
  await page.goto('/');
  expect(requests).toEqual([]);
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page.getByRole('button', {name: 'Utiliser ma position'}).click();
  await expect(page.locator('[data-location-status]')).toContainText('refusée');
  await page.getByRole('button', {name: 'Utiliser ma position'}).click();
  await page
    .locator('[data-location-results]')
    .getByRole('button', {
      name: 'Près de New York · ville estimée',
      exact: true,
    })
    .click();
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
  expect(requests).toHaveLength(2);
  for (const request of requests) {
    const url = new URL(request);
    expect(
      url.searchParams.get('latitude') ?? url.searchParams.get('lat'),
    ).toBe('40.712345');
    expect(
      url.searchParams.get('longitude') ?? url.searchParams.get('lon'),
    ).toBe('-74.012345');
  }

  const stored = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!) as unknown,
    locationKey,
  );
  expect(stored).toEqual({
    location: 'Près de New York',
    latitude: 40.712345,
    longitude: -74.012345,
    timezone: 'America/New_York',
    source: 'geolocation',
  });
  await page.getByRole('button', {name: 'Fermer', exact: true}).click();
  await expect(page.locator('[data-location-greeting]')).toHaveText('Bonjour.');
  await expect(page.locator('[data-location-label]')).toHaveText(
    'Près de New York',
  );
  await expect(
    page.getByRole('button', {name: 'Changer le lieu météo'}),
  ).toHaveAccessibleDescription(/Météo · Près de New York.*Sur cet appareil/sv);
  const header = page.locator('[data-dashboard-header]');
  const geometry = await header.evaluate((element) => {
    const brand = element.querySelector('a')!.getBoundingClientRect();
    const pill = element
      .querySelector('[data-location-open]')!
      .getBoundingClientRect();
    const label = element
      .querySelector('[data-location-label]')!
      .getBoundingClientRect();
    return {
      gap: pill.left - brand.right,
      height: pill.height,
      labelHeight: label.height,
    };
  });
  expect(geometry.gap).toBeGreaterThanOrEqual(8);
  expect(geometry.height).toBeGreaterThanOrEqual(44);
  expect(geometry.labelHeight).toBeLessThan(32);
  await page.screenshot({path: info.outputPath('current-location-header.png')});
  await page.reload();
  await expect(page.locator('[data-location-greeting]')).toHaveText('Bonjour.');
  await expect(page.locator('[data-location-label]')).toHaveText(
    'Près de New York',
  );
  expect(requests).toHaveLength(2);
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
  // Reload may use the valid cache. Advance to the scheduled forecast refresh.
  await page.clock.fastForward(30 * 60_000);
  await expect.poll(() => forecasts.length).toBeGreaterThanOrEqual(2);
  expect(requests).toHaveLength(2);
  for (const request of forecasts) {
    const url = new URL(request);
    expect(url.searchParams.get('latitude')).toBe('40.712345');
    expect(url.searchParams.get('longitude')).toBe('-74.012345');
  }
});

for (const failure of [
  'empty',
  'malformed',
  'unavailable',
  'timeout',
] as const) {
  test(`GPS weather survives ${failure} city lookup`, async ({page}) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition(success: PositionCallback) {
            success({
              coords: {latitude: 40.712345, longitude: -74.012345},
            } as GeolocationPosition);
          },
        },
      });
    });
    await page.route('https://photon.komoot.io/**', async (route) => {
      if (failure === 'timeout') {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 4500);
        });
        await route.abort().catch(() => undefined);
      } else if (failure === 'unavailable') {
        await route.fulfill({status: 503});
      } else {
        await route.fulfill({
          json: {
            features:
              failure === 'empty'
                ? []
                : [
                    {
                      properties: {
                        name: '\u{202E}invalid',
                        osm_key: 'place',
                        osm_value: 'city',
                      },
                    },
                  ],
          },
        });
      }
    });
    await page.goto('/');
    await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
    await page.getByRole('button', {name: 'Utiliser ma position'}).click();
    await page
      .getByRole('button', {
        name: 'Ma position · ville indisponible',
        exact: true,
      })
      .click();
    await expect(page.locator('[data-temperature]')).toHaveText('24°');
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!) as unknown,
        locationKey,
      ),
    ).toEqual({
      location: 'Ma position',
      latitude: 40.712345,
      longitude: -74.012345,
      timezone: 'America/New_York',
      source: 'geolocation',
    });
  });
}

test('closing the picker discards a late city response and saved legacy GPS stays compatible', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        location: 'Ma position',
        latitude: 40.71,
        longitude: -74.01,
        timezone: 'America/New_York',
      }),
    );
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({
            coords: {latitude: 45.899234, longitude: 6.129456},
          } as GeolocationPosition);
        },
      },
    });
  }, locationKey);
  const {promise: gate, resolve: release} = Promise.withResolvers<void>();
  let isWaiting = false;
  await page.route('https://photon.komoot.io/**', async (route) => {
    isWaiting = true;
    await gate;
    await route
      .fulfill({
        json: {
          features: [
            {properties: {name: 'Annecy', osm_key: 'place', osm_value: 'city'}},
          ],
        },
      })
      .catch(() => undefined);
  });
  await page.goto('/');
  await expect(page.locator('[data-location-greeting]')).toHaveText('Bonjour.');
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page.getByRole('button', {name: 'Utiliser ma position'}).click();
  await expect.poll(() => isWaiting).toBe(true);
  await page.getByRole('button', {name: 'Fermer', exact: true}).click();
  release();
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await expect(page.locator('[data-location-results] button')).toHaveCount(0);
  await expect(page.locator('[data-location-label]')).toHaveText('Ma position');
});

test('a long town name keeps the header on one line at narrow phone widths', async ({
  page,
}) => {
  await page.setViewportSize({width: 320, height: 800});
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        location: 'Saint-Rémy-en-Bouzemont-Saint-Genest-et-Isson',
        latitude: 48.63,
        longitude: 4.65,
        timezone: 'Europe/Paris',
      }),
    );
  }, locationKey);
  await page.goto('/');
  const label = page.locator('[data-location-label]');
  await expect(label).toHaveText(
    'Saint-Rémy-en-Bouzemont-Saint-Genest-et-Isson',
  );
  expect(
    await page.locator('[data-dashboard-header]').evaluate((element) => {
      const brand = element.querySelector('a')!.getBoundingClientRect();
      const pill = element
        .querySelector('[data-location-open]')!
        .getBoundingClientRect();
      return (
        pill.left >= brand.right + 8 &&
        pill.right <= innerWidth - 8 &&
        document.documentElement.scrollWidth <= innerWidth
      );
    }),
  ).toBe(true);
});

test('empty search, provider failure, cancellation and corrupt preference leave weather usable', async ({
  page,
}) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, '{broken');
  }, locationKey);
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page.getByLabel('Ville ou code postal').fill('Nowhere');
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) =>
    route.fulfill({json: {}}),
  );
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  await expect(page.locator('[data-location-status]')).toContainText(
    'Aucun lieu',
  );
  await page.route('https://geocoding-api.open-meteo.com/**', async (route) =>
    route.fulfill({status: 503}),
  );
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  await expect(page.locator('[data-location-status]')).toContainText(
    'indisponible',
  );
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-location-dialog]')).toBeHidden();
  await expect(
    page.getByRole('button', {name: 'Changer le lieu météo'}),
  ).toBeFocused();
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
});

test('switching location clears old readings when the new request fails', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({status: 503}),
  );
  await page.getByRole('button', {name: 'Changer le lieu météo'}).click();
  await page.getByLabel('Ville ou code postal').fill('New York');
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  await page.locator('[data-location-results] button').click();
  await expect(page.locator('[data-temperature]')).toHaveText('—°');
  await expect(page.locator('[data-condition]')).toHaveText(
    'Météo indisponible',
  );
  await expect(page.locator('[data-chart-content]')).toBeHidden();
  await expect(page.locator('[data-extremes]')).not.toContainText('19°');
});

test('vigilance details retain a location entry point when the compact frame hides the header', async ({
  page,
}) => {
  await page.route('**/api/weather-alerts', async (route) =>
    route.fulfill({
      contentType: 'application/atom+xml',
      body: alertsFixture([{}]),
    }),
  );
  await page.goto('/?display=frame');
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await expect(page.locator('[data-alert-title]')).toContainText(
    'Vigilance orange',
  );
  await page.locator('[data-weather-alerts] summary').click();
  await page
    .locator('[data-weather-alerts]')
    .getByRole('button', {name: 'Changer le lieu météo'})
    .click();
  await expect(page.locator('[data-location-dialog]')).toBeVisible();
  await page.getByLabel('Ville ou code postal').fill('New York');
  await page.getByRole('button', {name: 'Rechercher', exact: true}).click();
  await page.locator('[data-location-results] button').click();
  await expect(page.locator('[data-temperature]')).toHaveText('24°');
});
