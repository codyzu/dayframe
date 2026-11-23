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
test('Morning escapes titles in the agenda and advice, fits the frame and clears denied data @mobile', async ({
  page,
}, info) => {
  let isDenied = false;
  const now = fixtureNow;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const raw = weatherFixture();
    raw.hourly.precipitation_probability.fill(80);
    await route.fulfill({json: raw});
  });
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
              observances: [
                {
                  title: 'Fête synthétique',
                  start: '2026-10-16',
                  end: '2026-10-17',
                  tentative: true,
                },
              ],
              events: [
                ...[0, 1, 2].map((index) => ({
                  calendar: 'massages',
                  title:
                    index === 0
                      ? 'Massage 60 minutes VIP entre Studio Exemple et Camille Martin'
                      : `Massage ${index + 1}`,
                  start: new Date(
                    now + (index === 0 ? 90_000 : (index + 1) * 3_600_000),
                  ).toISOString(),
                  end: new Date(
                    now + (index === 0 ? 3_690_000 : (index + 2) * 3_600_000),
                  ).toISOString(),
                  allDay: false,
                })),
                {
                  title: 'Camille · Anniversaire',
                  start: '2026-10-16',
                  end: '2026-10-17',
                  allDay: true,
                },
                {
                  title: '<img src=x onerror=alert(1)> Rendez-vous à l’école',
                  start: new Date(now + 60_000).toISOString(),
                  end: new Date(now + 3_600_000).toISOString(),
                  allDay: false,
                  weatherRelevant: true,
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
  await expect(
    page.locator('[data-agenda-events] [data-event-calendar]'),
  ).toHaveCount(6);
  await expect(page.locator('[data-event-calendar=massages]')).toHaveCount(3);
  const massage = page.locator('[data-event-calendar=massages]').first();
  await expect(massage.locator('[data-event-title]')).toHaveText(
    'Camille Martin',
  );
  await expect(massage.locator('[data-event-duration]')).toHaveText('60 min');
  await expect(massage.locator('[data-event-source]')).toHaveText('Massages');
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
  await expect(page.getByRole('img', {name: 'Anniversaire'})).toBeVisible();
  await expect(
    page.locator('[data-event-calendar] [data-event-title]').nth(1),
  ).toContainText('<img src=x');
  const next = page.locator('[data-event-title][data-next]');
  await expect(next).toHaveText(
    '<img src=x onerror=alert(1)> Rendez-vous à l’école',
  );
  await expect(next).toHaveCSS('font-weight', '700');
  await expect(page.locator('[data-agenda] img')).toHaveCount(0);
  const summary = page.locator('[data-summary]');
  await expect(summary).toContainText('<img src=x');
  await expect(summary.locator('img')).toHaveCount(0);
  const observance = page.locator('[data-day-observance]');
  await expect(observance).toContainText('Fête synthétique');
  await expect(observance).toContainText('Fête observée');
  await expect(observance).toContainText('Date à confirmer');
  await expect(observance).not.toContainText('École fermée');
  await expect(page.locator('[data-lake-window]')).toHaveAttribute(
    'data-lake-accent',
    'lantern',
  );
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
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'Camille · Anniversaire',
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    'Fête synthétique',
  );
  isDenied = true;
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(summary).not.toContainText('<img src=x');
  await expect(
    page.locator('[data-agenda-events] [data-event-calendar]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-agenda-status]')).toBeVisible();
  await expect(observance).not.toContainText('Fête synthétique');
  await expect(page.getByRole('img', {name: 'Anniversaire'})).toHaveCount(0);
});

test('calendar weather follows timed events and tagged advice expires with the private agenda', async ({
  page,
}) => {
  let shouldStall = false;
  const stalled = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  await page.route('**/api/calendar/events', async (route) => {
    if (shouldStall) {
      stalled.resolve();
      await release.promise;
      await route.abort();
      return;
    }

    await route.fulfill({
      json: {
        connected: true,
        timezone: 'Europe/Paris',
        fetchedAt: fixtureNow,
        events: [
          {
            title: 'Sortie d’école',
            calendar: 'routines',
            start: '2026-10-16T14:30:00Z',
            end: '2026-10-16T15:00:00Z',
            allDay: false,
            weatherRelevant: true,
          },
          {
            title: 'Sortie au cinéma',
            calendar: 'family',
            start: '2026-10-16T06:00:00Z',
            end: '2026-10-16T08:00:00Z',
            allDay: false,
          },
          {
            title: 'Salle de sport',
            calendar: 'routines',
            start: '2026-10-17T04:00:00Z',
            end: '2026-10-17T22:30:00Z',
            allDay: false,
          },
        ],
      },
    });
  });
  await page.goto('/?display=frame');
  await expect(page.getByRole('heading', {name: 'Aujourd’hui'})).toBeVisible();
  const today = page.locator('[data-agenda-events]');
  const pickup = today
    .locator('[data-event-calendar]')
    .filter({hasText: 'Sortie d’école'});
  const cinema = today
    .locator('[data-event-calendar]')
    .filter({hasText: 'Sortie au cinéma'});
  await expect(pickup.locator('[data-event-time]')).toHaveText('16:30');
  await expect(pickup.locator('[data-event-source]')).toHaveText('Routines');
  await expect(pickup.locator('[data-event-title]')).toHaveCSS(
    'font-weight',
    '700',
  );
  await expect(
    pickup.getByRole('img', {
      name: /Probabilité de pluie : maximum horaire 65 %/v,
    }),
  ).toBeVisible();
  await expect(cinema.locator('[data-event-ongoing]')).toHaveText('En cours.');
  await expect(cinema.locator('[data-event-time]')).toHaveText('08:00');
  await expect(cinema.locator('[data-event-time]')).toHaveCSS(
    'font-weight',
    '600',
  );
  await expect(cinema.locator('[data-event-end]')).toHaveText('10:00');
  await expect(cinema.locator('[data-event-end]')).toHaveCSS(
    'font-weight',
    '700',
  );
  await expect(cinema.locator('[data-event-weather]')).toBeVisible();
  await expect(today.locator('li')).toHaveCount(2);
  const summary = page.locator('[data-summary]');
  await expect(summary).toContainText(
    'Pour « Sortie d’école » à 16h30, prévoyez un parapluie.',
  );
  await expect(summary).not.toContainText('Sortie au cinéma');
  const gym = page.locator('[data-agenda-tomorrow-events] li').filter({
    hasText: 'Salle de sport',
  });
  await expect(gym.locator('[data-event-time]')).toHaveText('06:00');
  await expect(gym.locator('[data-event-end-clock]')).toHaveText('00:30');
  await expect(gym.locator('[data-event-end-date]')).toHaveText('(18/10)');
  await expect(gym.getByRole('img', {name: /source 06:00/v})).toBeVisible();
  try {
    shouldStall = true;
    await page.clock.fastForward(241_000);
    await stalled.promise;
    await page.clock.fastForward(60_000);
    await expect(today.locator('li')).toHaveCount(0);
    await expect(summary).not.toContainText('Sortie d’école');
    await expect(summary).toContainText('Pluie possible');
  } finally {
    release.resolve();
  }
});

test('admin selects shared calendars including routines and observances, disconnects and starts Google authorization @mobile', async ({
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
  let routineSelected: {id: string; name: string} | undefined;
  let observanceSelected: {id: string; name: string} | undefined;
  let secondObservanceSelected: {id: string; name: string} | undefined;
  await page.route('**/api/calendar', async (route) => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().headers()['x-dayframe-request']).toBe('1');
      expect(route.request().postDataJSON()).toEqual({
        id: 'family',
        massageId: 'massage',
        routineId: 'routines',
        observanceId: 'observances',
        secondObservanceId: 'other-observances',
      });
      selected = {id: 'family', name: 'Notre famille'};
      massageSelected = {id: 'massage', name: 'Cabinet'};
      routineSelected = {id: 'routines', name: 'Routines du foyer'};
      observanceSelected = {id: 'observances', name: 'Fêtes du foyer'};
      secondObservanceSelected = {
        id: 'other-observances',
        name: 'Autres fêtes',
      };
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
        routineSelected,
        observanceSelected,
        secondObservanceSelected,
      },
    });
  });
  await page.route('**/api/calendar/calendars', async (route) =>
    route.fulfill({
      json: {
        calendars: [
          {id: 'family', name: 'Notre famille'},
          {id: 'massage', name: 'Cabinet'},
          {id: 'routines', name: 'Routines du foyer'},
          {id: 'observances', name: 'Fêtes du foyer'},
          {id: 'other-observances', name: 'Autres fêtes'},
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
  const routines = page.getByLabel('Routines · facultatif');
  await routines.selectOption('routines');
  await page
    .getByLabel(/Fêtes observées · agenda 1/v)
    .selectOption('observances');
  const secondObservance = page.getByLabel(/Fêtes observées · agenda 2/v);
  const status = page.locator('[data-calendar-status]');
  await secondObservance.selectOption('other-observances');
  await expect(status).toHaveText('Modifications non enregistrées.');
  await page.getByRole('button', {name: 'Recharger la liste Google'}).click();
  await expect(secondObservance).toHaveValue('other-observances');
  await expect(status).toHaveText('Modifications non enregistrées.');
  await page.getByRole('button', {name: 'Enregistrer les agendas'}).click();
  await expect(status).toContainText('Agendas enregistrés.');
  await expect(status).toContainText(
    'Fêtes observées : Fêtes du foyer, Autres fêtes',
  );
  await page.reload();
  await expect(secondObservance).toHaveValue('other-observances');
  await expect(routines).toHaveValue('routines');
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

// Render empty today, a mix with notices, and a full today on the frame and phone.
for (const [count, tomorrowCount] of [
  [0, 14],
  [7, 11],
  [13, 5],
]) {
  test(`Morning previews tomorrow within spare rows after ${count} events today @mobile`, async ({
    page,
  }, info) => {
    let isDenied = false;
    if (count === 7) {
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

    const calendar = (index: number) =>
      ['family', 'massages', 'routines'][Math.floor(index / 3)];
    const today = Array.from({length: count}, (_, index) => ({
      title: `Aujourd’hui ${index + 1}`,
      calendar: calendar(index) ?? 'family',
      start: new Date(fixtureNow + (index + 1) * 3_600_000).toISOString(),
      end: new Date(fixtureNow + (index + 2) * 3_600_000).toISOString(),
      allDay: false,
    }));
    const tomorrow = Array.from({length: tomorrowCount}, (_, index) => ({
      title: index === 0 ? '<img src=x> Demain' : `Demain ${index + 1}`,
      calendar: 'family',
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
    const todayRows = page.locator('[data-agenda-events] li:visible');
    const tomorrowRows = page.locator(
      '[data-agenda-tomorrow-events] li:visible',
    );
    const isMobile = info.project.name === 'mobile';
    if (isMobile || count < 13) {
      await expect(todayRows).toHaveCount(count);
    } else {
      await expect.poll(async () => todayRows.count()).toBeGreaterThan(9);
      expect(await todayRows.count()).toBeLessThan(count);
      const nextRow = page.locator('[data-agenda-events] li[hidden]').first();
      expect(
        await nextRow.evaluate((row) => {
          row.removeAttribute('hidden');
          const {bottom} = row.getBoundingClientRect();
          row.setAttribute('hidden', '');
          return bottom;
        }),
      ).toBeGreaterThan(796); // The agenda keeps a 4px bottom inset.
    }

    if (count === 7) {
      await expect(
        page.locator('[data-event-calendar=routines]').first(),
      ).toContainText('Aujourd’hui 7');
      await expect(page.locator('[data-day-observance]')).toContainText(
        'Journée synthétique',
      );
      await expect(page.locator('[data-weather-alerts]')).toBeVisible();
    }

    if (isMobile) {
      await expect(tomorrowRows).toHaveCount(tomorrowCount);
    }

    if (isMobile || count < 13) {
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
      if (count === 0 && !isMobile) {
        await expect.poll(async () => tomorrowRows.count()).toBeGreaterThan(8);
        expect(await tomorrowRows.count()).toBeLessThan(tomorrowCount);
      }
    } else {
      await expect(page.locator('[data-agenda-tomorrow]')).toBeHidden();
    }

    await page.evaluate(async () =>
      globalThis.document.fonts.ready.then(() => undefined),
    );
    const visibleRows = page.locator(
      '[data-agenda] li[data-event-calendar]:visible',
    );
    const beforeDockHides = await visibleRows.count();
    await page.clock.fastForward(16_000);
    await expect(visibleRows).toHaveCount(beforeDockHides);
    if (!isMobile) {
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollHeight,
        ),
      ).toBeLessThanOrEqual(800);
    }

    if (count === 7 && !isMobile) {
      const alert = page.locator('[data-weather-alerts]');
      await alert.evaluate((element) => {
        element.style.minHeight = '130px';
      });
      await expect
        .poll(async () => visibleRows.count())
        .toBeLessThan(beforeDockHides);
      await alert.evaluate((element) => {
        element.style.minHeight = '';
      });
      await expect(visibleRows).toHaveCount(beforeDockHides);
    }

    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth,
      ),
    ).toBeLessThanOrEqual(await page.evaluate(() => globalThis.innerWidth));

    expect(
      await page.evaluate(() => JSON.stringify(localStorage)),
    ).not.toContain('Demain 2');
    isDenied = true;
    await page.clock.fastForward(241_000);
    await expect(
      page.locator('[data-agenda] [data-event-calendar] [data-event-title]'),
    ).toHaveCount(0);
    await expect(page.locator('[data-agenda-tomorrow]')).toBeHidden();
  });
}

test('Morning keeps an empty tomorrow explicit and reclassifies dates at midnight @mobile', async ({
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
    page.locator(
      '[data-agenda-events] [data-event-calendar] [data-event-title]',
    ),
  ).toHaveText('Samedi');
  await expect(page.locator('[data-agenda-tomorrow-title]')).toHaveText(
    'Demain · dimanche',
  );
  await expect(page.locator('[data-agenda-tomorrow-empty]')).toBeVisible();
});
