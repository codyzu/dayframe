import {expect, test} from '../fixtures/browser.ts';
import {
  defaultSettings,
  type Settings,
} from '../../src/lib/dashboard/settings.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
});

test('schedule, inactivity, touch reveal, clock corrections and resume', async ({
  page,
}, info) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: {...defaultSettings, overrideTimeoutSeconds: 30}}),
  );
  await page.goto('/?display=frame');
  const root = page.locator('[data-dashboard]');
  await expect(root).toHaveAttribute('data-mode', 'morning');
  for (const [label, mode] of [
    ['Photos', 'photos'],
    ['Nuit', 'night'],
    ['Matin', 'morning'],
  ]) {
    await page.getByRole('button', {name: label, exact: true}).click();
    await expect(root).toHaveAttribute('data-mode', mode);
    await page.screenshot({
      path: info.outputPath(`${mode}.png`),
      fullPage: true,
    });
    if (mode === 'photos') {
      await expect(page.locator('[data-photo-temperature]')).toHaveText('12°');
      await expect(page.locator('[data-photo-condition]')).toHaveText(
        'Quelques éclaircies',
      );
      await expect(page.locator('[data-photo-weather-icon]')).toHaveClass(
        /i-meteocons-partly-cloudy-day-fill/v,
      );
      await expect(page.locator('[data-slideshow] [data-clock]')).toHaveText(
        /^\d{2}:\d{2}$/v,
      );
    } else if (mode === 'night') {
      const titleHeight = await page
        .locator('#night-title')
        .evaluate((element) => element.getBoundingClientRect().height);
      expect(titleHeight).toBeGreaterThan(50);
    }

    expect(
      await page.evaluate(
        () =>
          globalThis.document.documentElement.scrollWidth <=
          globalThis.innerWidth,
      ),
    ).toBe(true);
    if (info.project.name !== 'mobile') {
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollHeight,
        ),
      ).toBeLessThanOrEqual(800);
    }
  }

  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  await page.reload();
  await expect(root).toHaveAttribute('data-mode', 'morning');
  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  await page.clock.runFor(16_000);
  await expect(root).toHaveAttribute('data-navigation', 'hidden');
  await expect(
    page.getByRole('navigation', {name: 'Modes d’affichage'}),
  ).toBeHidden();
  if (info.project.name === 'mobile') {
    await page.locator('#night-title').tap();
  } else {
    await page.locator('#night-title').click();
  }

  await expect(root).toHaveAttribute('data-navigation', 'visible');
  await page.clock.runFor(29_000);
  await expect(root).toHaveAttribute('data-mode', 'night');
  await page.clock.runFor(1000);
  await expect(root).toHaveAttribute('data-mode', 'morning');
  await page.keyboard.press('Tab');
  await expect(root).toHaveAttribute('data-navigation', 'visible');
  // Simulated suspended-page return uses real controller lifecycle events.
  await page.evaluate(() => globalThis.dispatchEvent(new Event('pagehide')));
  await page.clock.setSystemTime(new Date('2026-10-16T19:00:00Z'));
  await page.evaluate(() => globalThis.dispatchEvent(new Event('pageshow')));
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await page.clock.setSystemTime(new Date('2026-10-16T20:59:59Z'));
  await page.evaluate(() => globalThis.dispatchEvent(new Event('pageshow')));
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await page.clock.setSystemTime(new Date('2026-10-16T21:00:00Z'));
  await page.evaluate(() => globalThis.dispatchEvent(new Event('pageshow')));
  await expect(root).toHaveAttribute('data-mode', 'night');
  await page.clock.setSystemTime(new Date('2026-10-16T08:00:00Z'));
  await page.clock.runFor(1000);
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await page.evaluate(() => {
    Object.defineProperty(globalThis.document, 'hidden', {
      configurable: true,
      value: true,
    });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.setSystemTime(new Date('2026-10-16T15:00:00Z'));
  await page.evaluate(() => {
    Object.defineProperty(globalThis.document, 'hidden', {
      configurable: true,
      value: false,
    });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(root).toHaveAttribute('data-mode', 'photos');
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/setup"]')).toHaveCount(0);
});

test('Photos weather refreshes without opening Morning and labels cached data', async ({
  page,
}) => {
  const fixture = weatherFixture();
  let isOffline = false;
  await page.route('https://api.open-meteo.com/**', async (route) =>
    isOffline ? route.abort() : route.fulfill({json: fixture}),
  );
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({
      json: {
        ...defaultSettings,
        schedule: [{start: '00:00', end: '23:59', mode: 'photos'}],
      },
    }),
  );
  await page.goto('/?display=frame');
  const condition = page.locator('[data-photo-condition]');
  const icon = page.locator('[data-photo-weather-icon]');
  const status = page.locator('[data-photo-weather-status]');
  await expect(condition).toHaveText('Quelques éclaircies');
  await expect(status).toBeHidden();
  fixture.current.weather_code = 66;
  fixture.current.is_day = 0;
  fixture.current.time += 30 * 60;
  await page.clock.fastForward(30 * 60_000);
  await expect(condition).toHaveText('Précipitations verglaçantes');
  await expect(icon).toHaveClass(/i-meteocons-partly-cloudy-night-sleet-fill/v);
  expect(
    await icon.evaluate((element) => getComputedStyle(element).backgroundImage),
  ).toContain('%3Csvg');
  expect(
    await page.evaluate(() => globalThis.document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  isOffline = true;
  await page.clock.fastForward(30 * 60_000);
  await expect(status).toBeVisible();
  await expect(condition).toHaveText('Précipitations verglaçantes');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(condition).toHaveText('Météo indisponible');
  await expect(page.locator('[data-photo-temperature]')).toHaveText('—°');
  await expect(icon).toHaveClass(/i-meteocons-not-available-fill/v);
  await expect(status).toBeHidden();
});

test('periodic configuration refresh, invalid response, outage and online recovery', async ({
  page,
}, info) => {
  let configuration: Settings = {
    ...defaultSettings,
    schedule: [{start: '00:00', end: '23:59', mode: 'photos'}],
  };
  let isOffline = false;
  let isInvalid = false;
  let requests = 0;
  const requestCount = () => requests;
  await page.route('**/api/config/display', async (route) => {
    requests++;
    if (isOffline) {
      await route.abort();
    } else {
      await route.fulfill({
        json: isInvalid ? {timezone: 'invalid'} : configuration,
      });
    }
  });
  await page.goto('/?display=frame');
  const root = page.locator('[data-dashboard]');
  await expect(root).toHaveAttribute('data-mode', 'photos');
  configuration = {
    ...configuration,
    timezone: 'America/New_York',
    location: 'Lieu synthétique',
    fit: 'cover',
  };
  await page.clock.fastForward(301_000);
  await expect(page.locator('[data-location]')).toHaveText(
    'Météo · Lieu synthétique',
  );
  await expect(page.locator('[data-photo-stage]')).toHaveAttribute(
    'data-fit',
    'cover',
  );
  await expect(page.locator('[data-clock]').first()).toHaveText('02:35');
  isInvalid = true;
  await page.clock.fastForward(301_000);
  await expect(root).toHaveAttribute('data-mode', 'photos');
  isOffline = true;
  await page.clock.fastForward(61_000);
  await expect(root).toHaveAttribute('data-mode', 'photos');
  isOffline = false;
  isInvalid = false;
  configuration = {
    ...defaultSettings,
    schedule: [{start: '00:00', end: '23:59', mode: 'night'}],
  };
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(root).toHaveAttribute('data-mode', 'night');
  // Repeated lifecycle wakes must not leave extra recurring refresh loops.
  for (const location of ['Retour 1', 'Retour 2', 'Retour 3', 'Retour 4']) {
    configuration = {...configuration, location};
    await page.evaluate(() => {
      globalThis.dispatchEvent(new Event('pagehide'));
      globalThis.dispatchEvent(new Event('pageshow'));
    });
    await expect(page.locator('[data-location]')).toHaveText(
      `Météo · ${location}`,
    );
  }

  const before = requests;
  await page.clock.fastForward(301_000);
  await expect.poll(requestCount).toBe(before + 1);
  await page.screenshot({
    path: info.outputPath('recovered-night.png'),
    fullPage: true,
  });
});

test('saved Home periods display Photos without losing household settings', async ({
  page,
}) => {
  await page.clock.setSystemTime(new Date('2026-10-16T15:00:00Z'));
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({
      json: {
        ...defaultSettings,
        location: 'Ancien planning',
        fit: 'contain',
        schedule: [
          {start: '06:00', end: '10:00', mode: 'morning'},
          {start: '10:00', end: '17:00', mode: 'photos'},
          {start: '17:00', end: '21:00', mode: 'home'},
          {start: '21:00', end: '06:00', mode: 'night'},
        ],
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'photos',
  );
  await expect(page.locator('[data-location]')).toHaveText(
    'Météo · Ancien planning',
  );
  await expect(page.locator('[data-photo-stage]')).toHaveAttribute(
    'data-fit',
    'contain',
  );
  await expect(
    page.getByRole('button', {name: 'Maison', exact: true}),
  ).toHaveCount(0);
});
