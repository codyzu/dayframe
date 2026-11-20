import {alertsFixture} from '../fixtures/alerts.ts';
import {expect, test, photoOrigin} from '../fixtures/browser.ts';
import {
  defaultSettings,
  validateSettings,
} from '../../src/lib/dashboard/settings.ts';
import {
  dayOffSchedule,
  type OfficialCalendar,
} from '../../src/lib/dashboard/day-planning.ts';
import {weatherFixture} from '../fixtures/weather.ts';

test.use({ignoreHTTPSErrors: true});

const planning = {
  schoolCalendar: true,
  schedules: {dayOff: dayOffSchedule},
  checkpoints: {},
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

test('vacation and holiday appear beside six upcoming appointments and preserve day-off boundaries @mobile', async ({
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
  await expect(note).toContainText('La Toussaint');
  await expect(note).toContainText('Jour férié');
  await expect(note).toContainText('École fermée');
  await expect(note).toContainText('Vacances de la Toussaint');
  await expect(
    note.getByText('Vacances de la Toussaint').locator('..'),
  ).toHaveAttribute('title', /jusqu’au 1 novembre/v);
  await expect(
    page.locator('[data-agenda-events] [data-event-calendar]'),
  ).toHaveCount(6);
  if (info.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
  }

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
  await expect(note).not.toContainText('Jour férié');
  await page.clock.setSystemTime(new Date('2027-01-01T07:30:00Z'));
  await page.clock.runFor(1000);
  await expect(note).toContainText('Calendrier scolaire indisponible');
});

test('admin edits and persists separate day profiles without replacing base settings @mobile', async ({
  page,
}) => {
  await page.request.get(`${photoOrigin}/__test/reset`, {
    ignoreHTTPSErrors: true,
  });
  await page.request.get(`${photoOrigin}/__test/login`, {
    ignoreHTTPSErrors: true,
  });
  const checkpoints = {wednesday: [{time: '16:15', label: 'Ancien repère'}]};
  const seed = await page.request.patch(`${photoOrigin}/api/config`, {
    headers: {
      Origin: photoOrigin,
      'X-Dayframe-Request': '1',
      'Content-Type': 'application/json',
    },
    data: {
      ...defaultSettings,
      planning: {...defaultSettings.planning, checkpoints},
    },
  });
  expect(seed.ok()).toBe(true);
  await page.goto(`${photoOrigin}/admin/settings`);
  await expect(page.locator('[data-controls]')).toBeEnabled();
  await page.locator('[data-school-calendar]').check();
  await page.locator('[data-add-day-period]').click();
  await expect(
    page.locator('[data-day-schedule] [data-start]').first(),
  ).toHaveValue('08:00');
  await page.locator('[data-day-profile]').selectOption('wednesday');
  await page.locator('[data-add-day-period]').click();
  await page.locator('[data-day-schedule] [data-start]').first().fill('06:30');
  await page.locator('[data-day-profile]').selectOption('dayOff');
  await expect(
    page.locator('[data-day-schedule] [data-start]').first(),
  ).toHaveValue('08:00');
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click();
  await expect(page.locator('[data-settings-save-status]')).toHaveText(
    'Réglages enregistrés.',
  );
  await page.reload();
  await expect(page.locator('[data-school-calendar]')).toBeChecked();
  await page.locator('[data-day-profile]').selectOption('wednesday');
  await expect(
    page.locator('[data-day-schedule] [data-start]').first(),
  ).toHaveValue('06:30');
  await expect(page.getByText('Ancien repère')).toHaveCount(0);
  const stored = await page.request.get(`${photoOrigin}/api/config`);
  const storedSettings = validateSettings(await stored.json());
  expect(storedSettings.planning.checkpoints).toEqual(checkpoints);
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
