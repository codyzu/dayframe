import {alertsFixture} from '../fixtures/alerts.ts';
import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {
  dayOffSchedule,
  type OfficialCalendar,
} from '../../src/lib/dashboard/day-planning.ts';
import {weatherFixture} from '../fixtures/weather.ts';

test.use({ignoreHTTPSErrors: true});

const wednesday = Date.parse('2026-11-04T07:30:00Z');
const planning = {
  schoolCalendar: true,
  schedules: {dayOff: dayOffSchedule},
  checkpoints: {
    wednesday: [
      {time: '09:30', label: 'Matin synthétique'},
      {time: '12:30', label: 'Après-midi synthétique'},
      {time: '16:15', label: 'Retour'},
      {time: '19:00', label: '<img src=x onerror=alert(1)>'},
    ],
  },
};
const official = (now: number): OfficialCalendar => ({
  year: 2026,
  fetchedAt: now,
  knownFrom: '2026-09-01',
  knownUntil: '2027-07-03',
  vacations: [
    {start: '2026-10-17', end: '2026-11-02', label: 'Vacances de la Toussaint'},
  ],
  holidays: {'2026-11-01': 'La Toussaint', '2026-11-11': 'Armistice 1918'},
});

test('Wednesday private routines, quarter-hour weather and escaped labels fit the frame', async ({
  page,
}, info) => {
  await page.clock.install({time: wednesday});
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: {...defaultSettings, planning}}),
  );
  await page.route('**/api/day-context', async (route) =>
    route.fulfill({json: {calendar: official(wednesday)}}),
  );
  await page.route('**/api/calendar/events', async (route) =>
    route.fulfill({
      json: {
        connected: false,
        events: [],
        timezone: 'Europe/Paris',
        fetchedAt: wednesday,
      },
    }),
  );
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture(wednesday)}),
  );
  await page.goto('/?display=frame');
  await expect(page.locator('[data-checkpoint-heading]')).toHaveText(
    'Les repères · Mercredi',
  );
  await expect(page.locator('[data-checkpoints] article')).toHaveCount(4);
  await expect(page.getByRole('heading', {name: '16h15'})).toBeVisible();
  await expect(page.locator('[data-checkpoints] img')).toHaveCount(0);
  await expect(page.locator('[data-checkpoints]')).toContainText(
    '<img src=x onerror=alert(1)>',
  );
  if (info.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
  }

  // An authorization denial removes private habit labels as well as events.
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({status: 401, json: {error: {message: 'Denied'}}}),
  );
  await page.clock.fastForward(301_000);
  await expect(page.locator('[data-checkpoints]')).not.toContainText(
    'Matin synthétique',
  );
});

test('vacation and holiday appear beside six upcoming appointments, suppress routines and preserve day-off boundaries', async ({
  page,
}, info) => {
  const now = Date.parse('2026-11-01T07:00:00Z');
  await page.route('**/api/weather-alerts', async (route) =>
    route.fulfill({
      contentType: 'application/atom+xml',
      body: alertsFixture(
        [{start: now + 3_600_000, end: now + 8 * 3_600_000}],
        now,
      ),
    }),
  );
  await page.clock.install({time: now});
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: {...defaultSettings, planning}}),
  );
  let isOffline = false;
  await page.route('**/api/day-context', async (route) =>
    isOffline
      ? route.abort()
      : route.fulfill({json: {calendar: official(now)}}),
  );
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture(now)}),
  );
  await page.route('**/api/calendar/events', async (route) =>
    route.fulfill({
      json: {
        connected: true,
        events: Array.from({length: 6}, (_, index) => ({
          calendar: index < 3 ? 'family' : 'massages',
          title: `Rendez-vous synthétique ${index + 1}`,
          allDay: false,
          start: `2026-11-01T${String(10 + index).padStart(2, '0')}:00:00Z`,
          end: `2026-11-01T${String(11 + index).padStart(2, '0')}:00:00Z`,
        })),
        timezone: 'Europe/Paris',
        fetchedAt: now,
      },
    }),
  );
  await page.goto('/?display=frame');
  const note = page.locator('[data-agenda] [data-day-observance]');
  await expect(note).toContainText('Férié : La Toussaint');
  await expect(note).toContainText(
    'Vacances de la Toussaint · jusqu’au 1 novembre',
  );
  await expect(page.locator('[data-agenda-events] li')).toHaveCount(6);
  await expect(page.locator('[data-checkpoints]')).not.toContainText(
    'Matin synthétique',
  );
  if (info.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
  }

  await page.screenshot({
    path: info.outputPath('holiday-vacation.png'),
    fullPage: true,
  });
  isOffline = true;
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(note).toContainText('Vacances de la Toussaint');
  await page.clock.setSystemTime(new Date('2026-11-01T09:59:59Z'));
  await page.clock.runFor(1000);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'photos',
  );
  await page.clock.setSystemTime(new Date('2026-11-02T07:30:00Z'));
  await page.clock.runFor(1000);
  await expect(note).not.toContainText('Vacances de la Toussaint');
  await expect(note).not.toContainText('Férié :');
  await page.clock.setSystemTime(new Date('2027-01-01T07:30:00Z'));
  await page.clock.runFor(1000);
  await expect(note).toContainText('Calendrier scolaire indisponible');
});

test('admin edits and persists separate day profiles without replacing base settings', async ({
  page,
}) => {
  await page.request.get('https://127.0.0.1:8789/__test/reset', {
    ignoreHTTPSErrors: true,
  });
  await page.request.get('https://127.0.0.1:8789/__test/login', {
    ignoreHTTPSErrors: true,
  });
  await page.goto('https://127.0.0.1:8789/admin/settings');
  await expect(page.locator('[data-controls]')).toBeEnabled();
  await page.locator('[data-school-calendar]').check();
  await page.locator('[data-add-day-period]').click();
  await expect(
    page.locator('[data-day-schedule] [data-start]').first(),
  ).toHaveValue('08:00');
  await page.locator('[data-day-profile]').selectOption('wednesday');
  await page.locator('[data-add-checkpoint]').click();
  await page.locator('[data-point-time]').fill('16:15');
  await page.locator('[data-point-label]').fill('Retour synthétique');
  await page.locator('[data-day-profile]').selectOption('dayOff');
  await expect(
    page.locator('[data-day-schedule] [data-start]').first(),
  ).toHaveValue('08:00');
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click();
  await expect(page.locator('[data-status]')).toHaveText(
    'Réglages enregistrés.',
  );
  await page.reload();
  await expect(page.locator('[data-school-calendar]')).toBeChecked();
  await page.locator('[data-day-profile]').selectOption('wednesday');
  await expect(page.locator('[data-point-time]')).toHaveValue('16:15');
  await expect(page.locator('[data-point-label]')).toHaveValue(
    'Retour synthétique',
  );
  await expect(
    page.locator('[data-schedule] [data-start]').first(),
  ).toHaveValue('06:00');
  // Native selects have different intrinsic widths on Linux WebKit and macOS.
  // Check the populated editor on a narrow phone and report overflowing nodes.
  await page.setViewportSize({width: 320, height: 800});
  const overflow = await page.locator('main').evaluate((main) =>
    [...main.querySelectorAll('*')].flatMap((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 &&
        box.height > 0 &&
        box.right > globalThis.innerWidth + 0.5
        ? [{tag: element.tagName, right: box.right}]
        : [];
    }),
  );
  expect(overflow).toEqual([]);
});
