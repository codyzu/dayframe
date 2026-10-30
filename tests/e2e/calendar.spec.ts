import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';
import {alertsFixture} from '../fixtures/alerts.ts';

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
});
test('Morning shows escaped, bounded events, stays within the frame and clears denied/offline data', async ({
  page,
}, info) => {
  let isDenied = false;
  const now = fixtureNow;
  await page.route('**/api/calendar/events', async (route) =>
    route.fulfill(
      isDenied
        ? {status: 401, json: {error: {message: 'Accès privé requis.'}}}
        : {
            json: {
              connected: true,
              massageConnected: true,
              timezone: 'Europe/Paris',
              fetchedAt: now,
              events: [
                ...[0, 1, 2].map((index) => ({
                  calendar: 'massages',
                  title: `Massage ${index + 1}`,
                  start: new Date(
                    now + (index === 0 ? 90_000 : (index + 1) * 3_600_000),
                  ).toISOString(),
                  end: new Date(now + (index + 2) * 3_600_000).toISOString(),
                  allDay: false,
                })),
                {
                  title: 'Journée familiale',
                  start: '2026-10-16',
                  end: '2026-10-17',
                  allDay: true,
                },
                {
                  title: '<img src=x onerror=alert(1)> Rendez-vous à l’école',
                  start: new Date(now + 60_000).toISOString(),
                  end: new Date(now + 3_600_000).toISOString(),
                  allDay: false,
                },
                {
                  title:
                    'Un titre assez long pour vérifier que les rendez-vous ne dépassent pas la carte du matin sur le cadre',
                  start: new Date(now + 120_000).toISOString(),
                  end: new Date(now + 3_600_000).toISOString(),
                  allDay: false,
                },
              ],
            },
          },
    ),
  );
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-agenda-events] li')).toHaveCount(6);
  await expect(page.locator('[data-event-calendar=massages]')).toHaveCount(3);
  expect(
    await page
      .locator('[data-event-calendar]')
      .evaluateAll((rows) => rows.map((row) => row.dataset.eventCalendar)),
  ).toEqual(['family', 'family', 'massages', 'family', 'massages', 'massages']);
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await page.evaluate(async () =>
    globalThis.document.fonts.ready.then(() => undefined),
  );
  await expect(page.locator('[data-event-time]').first()).toHaveText('Journée');
  await expect(page.locator('[data-event-title]').nth(1)).toContainText(
    '<img src=x',
  );
  await expect(page.locator('[data-agenda] img')).toHaveCount(0);
  if (info.project.name !== 'mobile') {
    await expect
      .poll(async () =>
        page.evaluate(() => globalThis.document.documentElement.scrollHeight),
      )
      .toBeLessThanOrEqual(800);
  }

  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('morning-calendar.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'Journée familiale',
  );
  await page.clock.fastForward(61_000);
  await expect(page.locator('[data-event-time]').nth(1)).toHaveText('En cours');
  isDenied = true;
  await page.clock.fastForward(180_000);
  await expect(page.locator('[data-agenda-events] li')).toHaveCount(0);
  await expect(page.locator('[data-agenda-status]')).toBeVisible();
  await page.unroute('**/api/calendar/events');
  await page.route('**/api/calendar/events', async (route) => route.abort());
  await page.clock.fastForward(300_000);
  await expect(page.locator('[data-agenda-events] li')).toHaveCount(0);
});

test('admin selects the shared calendar, disconnects and starts Google authorization', async ({
  page,
}) => {
  await page.route('**/api/session', async (route) =>
    route.fulfill({json: {role: 'admin', subject: 'one@example.test'}}),
  );
  await page.route('**/api/config', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
  await page.route('**/api/display', async (route) =>
    route.fulfill({json: null}),
  );
  let isConnected = true;
  let selected: {id: string; name: string} | undefined;
  let massageSelected: {id: string; name: string} | undefined;
  await page.route('**/api/calendar', async (route) => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().headers()['x-dayframe-request']).toBe('1');
      expect(route.request().postDataJSON()).toEqual({
        id: 'family',
        massageId: 'massage',
      });
      selected = {id: 'family', name: 'Notre famille'};
      massageSelected = {id: 'massage', name: 'Cabinet'};
    }

    if (route.request().method() === 'DELETE') {
      isConnected = false;
    }

    await route.fulfill({
      json: {
        configured: true,
        connected: isConnected,
        selected,
        massageSelected,
      },
    });
  });
  await page.route('**/api/calendar/calendars', async (route) =>
    route.fulfill({
      json: {
        calendars: [
          {id: 'family', name: 'Notre famille'},
          {id: 'massage', name: 'Cabinet'},
        ],
      },
    }),
  );
  await page.route('**/api/calendar/connect', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      json: {
        url: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic',
      },
    });
  });
  await page.route('https://accounts.google.com/**', async (route) =>
    route.fulfill({
      body: 'Synthetic Google consent page',
      contentType: 'text/html',
    }),
  );
  await page.goto('/admin/settings');
  await page
    .getByLabel('Agenda à afficher', {exact: false})
    .selectOption('family');
  await page.getByLabel('Massages · violet').selectOption('massage');
  await page.getByRole('button', {name: 'Afficher ces agendas'}).click();
  await expect(page.locator('[data-calendar-status]')).toHaveText(
    'Agenda affiché : Notre famille · Massages : Cabinet',
  );
  await page.getByRole('button', {name: 'Déconnecter Google Calendar'}).click();
  await expect(page.locator('[data-calendar-status]')).toHaveText(
    'Aucun agenda connecté.',
  );
  await page
    .getByRole('button', {name: 'Connecter Google Calendar', exact: true})
    .click();
  await expect(page).toHaveURL(
    'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic',
  );
});

for (const count of [0, 2, 4, 6]) {
  test(`Morning previews tomorrow within spare rows after ${count} events today`, async ({
    page,
  }, info) => {
    let isDenied = false;
    if (count === 4) {
      await page.route('**/api/weather-alerts', async (route) =>
        route.fulfill({
          contentType: 'application/atom+xml',
          body: alertsFixture(
            [{start: fixtureNow, end: fixtureNow + 8 * 3_600_000}],
            fixtureNow,
          ),
        }),
      );
      await page.route('**/api/config/display', async (route) =>
        route.fulfill({
          json: {
            ...defaultSettings,
            planning: {...defaultSettings.planning, schoolCalendar: true},
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
              knownUntil: '2027-01-01',
              vacations: [],
              holidays: {'2026-10-16': 'Journée synthétique'},
            },
          },
        }),
      );
    }

    const today = Array.from({length: count}, (_, index) => ({
      title: `Aujourd’hui ${index + 1}`,
      calendar: index < 3 ? 'family' : 'massages',
      start: new Date(fixtureNow + (index + 1) * 3_600_000).toISOString(),
      end: new Date(fixtureNow + (index + 2) * 3_600_000).toISOString(),
      allDay: false,
    }));
    const tomorrow = Array.from({length: 6}, (_, index) => ({
      title: index === 0 ? '<img src=x> Demain' : `Demain ${index + 1}`,
      calendar: index < 3 ? 'family' : 'massages',
      start: `2026-10-17T${String(index + 8).padStart(2, '0')}:00:00Z`,
      end: `2026-10-17T${String(index + 9).padStart(2, '0')}:00:00Z`,
      allDay: false,
    }));
    await page.route('**/api/calendar/events', async (route) =>
      route.fulfill(
        isDenied
          ? {status: 401, json: {error: {message: 'Accès privé requis.'}}}
          : {
              json: {
                connected: true,
                timezone: 'Europe/Paris',
                fetchedAt: fixtureNow,
                events: [...tomorrow.toReversed(), ...today],
              },
            },
      ),
    );
    await page.goto('/?display=frame');
    await page.getByRole('button', {name: 'Matin', exact: true}).click();
    await expect(page.locator('[data-agenda-events] li')).toHaveCount(count);
    if (count === 4) {
      await expect(page.locator('[data-day-observance]')).toContainText(
        'Journée synthétique',
      );
      await expect(page.locator('[data-weather-alerts]')).toBeVisible();
    }

    const capacity = count > 4 ? 0 : 5 - Math.max(1, count);
    await expect(page.locator('[data-agenda-tomorrow-events] li')).toHaveCount(
      capacity,
    );
    if (capacity > 0) {
      await expect(page.locator('[data-agenda-tomorrow-title]')).toHaveText(
        'Demain · samedi',
      );
      await expect(
        page
          .locator('[data-agenda-tomorrow-events] [data-event-title]')
          .first(),
      ).toHaveText('<img src=x> Demain');
      await expect(
        page.locator('[data-agenda-tomorrow-events] [data-event-time]').first(),
      ).toHaveText('10:00');
      await expect(page.locator('[data-agenda-tomorrow] img')).toHaveCount(0);
    } else {
      await expect(page.locator('[data-agenda-tomorrow]')).toBeHidden();
    }

    await page.clock.fastForward(16_000);
    await page.evaluate(async () =>
      globalThis.document.fonts.ready.then(() => undefined),
    );
    if (info.project.name !== 'mobile') {
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollHeight,
        ),
      ).toBeLessThanOrEqual(800);
    }

    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth,
      ),
    ).toBeLessThanOrEqual(await page.evaluate(() => globalThis.innerWidth));
    if (count === 2 || count === 4) {
      await page.screenshot({
        path: info.outputPath(`tomorrow-${count}.png`),
        fullPage: true,
      });
    }

    expect(
      await page.evaluate(() => JSON.stringify(localStorage)),
    ).not.toContain('Demain 2');
    isDenied = true;
    await page.clock.fastForward(241_000);
    await expect(page.locator('[data-agenda] [data-event-title]')).toHaveCount(
      0,
    );
    await expect(page.locator('[data-agenda-tomorrow]')).toBeHidden();
  });
}

test('Morning keeps an empty tomorrow explicit and reclassifies dates at midnight', async ({
  page,
}) => {
  let events: Array<{
    title: string;
    start: string;
    end: string;
    allDay: boolean;
  }> = [];
  let fetchedAt = fixtureNow;
  await page.route('**/api/calendar/events', async (route) =>
    route.fulfill({
      json: {
        connected: true,
        timezone: 'Europe/Paris',
        fetchedAt,
        events,
      },
    }),
  );
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-agenda-tomorrow-empty]')).toBeVisible();
  await expect(page.locator('[data-agenda-status]')).toHaveText(
    'Aucun autre événement aujourd’hui.',
  );
  events = [
    {title: 'Samedi', start: '2026-10-17', end: '2026-10-18', allDay: true},
  ];
  fetchedAt += 240_000;
  await page.clock.fastForward(240_000);
  await expect(
    page.locator('[data-agenda-tomorrow-events] [data-event-time]'),
  ).toHaveText('Journée');
  await page.clock.setSystemTime(new Date('2026-10-16T21:59:59Z'));
  fetchedAt = Date.parse('2026-10-16T21:59:59Z');
  await page.clock.fastForward(1000);
  fetchedAt += 1000;
  // Reveal navigation after the household's scheduled night transition.
  await page.locator('#night-title').click();
  await page
    .getByRole('button', {name: 'Matin', exact: true})
    .click({force: true});
  await page.clock.fastForward(1000);
  await expect(
    page.locator('[data-agenda-events] [data-event-title]'),
  ).toHaveText('Samedi');
  await expect(page.locator('[data-agenda-tomorrow-title]')).toHaveText(
    'Demain · dimanche',
  );
  await expect(page.locator('[data-agenda-tomorrow-empty]')).toBeVisible();
});
