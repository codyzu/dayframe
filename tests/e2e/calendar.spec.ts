import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

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
