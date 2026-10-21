import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {alertsFixture} from '../fixtures/alerts.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
});

test('official warnings have severity, departmental coverage and periods; cards fill the frame with six appointments', async ({
  page,
}, info) => {
  await page.route('**/api/weather-alerts', async (route) =>
    route.fulfill({
      contentType: 'application/atom+xml',
      body: alertsFixture([
        {severity: 'Moderate', event: 'Moderate wind warning'},
        {severity: 'Extreme', event: 'Extreme rain-flood warning'},
        {},
        {area: 'Savoie', severity: 'Extreme', event: 'Extreme snow warning'},
        {status: 'Test', event: 'Test warning'},
      ]),
    }),
  );
  await page.route('**/api/calendar/events', async (route) =>
    route.fulfill({
      json: {
        connected: true,
        events: Array.from({length: 6}, (_, index) => ({
          calendar: index < 3 ? 'family' : 'massages',
          title: `Rendez-vous synthétique ${index + 1}`,
          allDay: false,
          start: `2026-10-16T${String(10 + index).padStart(2, '0')}:00:00Z`,
          end: `2026-10-16T${String(11 + index).padStart(2, '0')}:00:00Z`,
        })),
        timezone: 'Europe/Paris',
        fetchedAt: fixtureNow,
      },
    }),
  );
  await page.goto('/?display=frame');
  const banner = page.locator('[data-weather-alerts]');
  await expect(banner).toHaveAttribute('data-level', 'red');
  await expect(banner).toContainText(
    'Vigilance rouge · Pluie-inondation · Haute-Savoie',
  );
  await expect(banner).toContainText('Orages (orange)');
  await expect(banner).toContainText('Vent (jaune)');
  await expect(banner).toContainText('Pluie-inondation (rouge)');
  await expect(banner).not.toContainText('Neige');
  await expect(banner).toContainText('09:30');
  await expect(page.locator('[data-agenda-events] li')).toHaveCount(6);
  await page.clock.fastForward(16_000);
  if (info.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
    const agenda = await page.locator('[data-agenda]').boundingBox();
    expect(agenda!.y + agenda!.height).toBeGreaterThan(735);
  }

  await page.screenshot({
    path: info.outputPath('alerts-six-events.png'),
    fullPage: true,
  });
});

test('clear feed hides the banner; failures, stale feeds and expiry never imply an all-clear', async ({
  page,
}) => {
  let body = alertsFixture([]);
  let isFailed = false;
  await page.route('**/api/weather-alerts', async (route) =>
    isFailed
      ? route.abort()
      : route.fulfill({contentType: 'application/atom+xml', body}),
  );
  await page.goto('/?display=frame');
  const banner = page.locator('[data-weather-alerts]');
  await expect(banner).toBeHidden();
  body = alertsFixture([
    {
      severity: 'Moderate',
      event: 'Moderate wind warning',
      start: fixtureNow,
      end: fixtureNow + 480_000,
    },
  ]);
  await page.clock.fastForward(121_000);
  await expect(banner).toHaveAttribute('data-level', 'yellow');
  isFailed = true;
  await page.clock.fastForward(121_000);
  await expect(banner).toContainText('actualisation interrompue');
  await page.clock.fastForward(241_000);
  await expect(banner).toContainText('Vigilance indisponible');
  isFailed = false;
  body = alertsFixture([{}], fixtureNow - 600_000);
  await page.clock.fastForward(61_000);
  await expect(banner).toContainText('Vigilance indisponible');
  body = '<feed>broken';
  await page.clock.fastForward(121_000);
  await expect(banner).toContainText('Vigilance indisponible');
});

test('larger Photos overlay fits long conditions and Night has no technical copy', async ({
  page,
}, info) => {
  const fixture = weatherFixture();
  fixture.current.weather_code = 67;
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: fixture}),
  );
  await page.route('**/api/weather-alerts', async (route) =>
    route.fulfill({contentType: 'application/atom+xml', body: alertsFixture()}),
  );
  await page.goto('/');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  const overlay = page.locator('.photo-at-a-glance');
  const clock = await overlay.locator('[data-clock]').boundingBox();
  expect(clock!.height).toBeGreaterThanOrEqual(
    info.project.name === 'mobile' ? 72 : 96,
  );
  const icon = await overlay.locator('[data-photo-weather-icon]').boundingBox();
  expect(icon!.width).toBeGreaterThanOrEqual(
    info.project.name === 'mobile' ? 64 : 80,
  );
  expect(
    await overlay.evaluate((element) => element.scrollWidth),
  ).toBeLessThanOrEqual((await overlay.boundingBox())!.width + 1);
  await page.screenshot({
    path: info.outputPath('photos-large-overlay.png'),
    fullPage: true,
  });
  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Bonne nuit.'})).toBeVisible();
  await expect(
    page.getByText('Luminosité de l’appareil inchangée'),
  ).toHaveCount(0);
});

test('Morning cards use the bottom space and navigation visibility does not move them', async ({
  page,
}, info) => {
  await page.goto('/?display=frame');
  await expect(page.locator('[data-weather-alerts]')).toBeHidden();
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  if (info.project.name === 'mobile') {
    return;
  }

  const before = await page.locator('[data-agenda]').boundingBox();
  expect(before!.y + before!.height).toBeGreaterThan(750);
  await page.clock.fastForward(16_000);
  const after = await page.locator('[data-agenda]').boundingBox();
  expect(after).toEqual(before);
  expect(
    await page.evaluate(() => globalThis.document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(800);
});
