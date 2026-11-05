import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {cacheKey} from '../../src/lib/weather/adapter.ts';
import {
  fixtureNow,
  weatherFixture,
  sevenDayFixture,
} from '../fixtures/weather.ts';

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
});

test('live day/night data, accessible graph and 30-minute refresh @mobile', async ({
  page,
}, testInfo) => {
  let calls = 0;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    calls++;
    const raw = weatherFixture(fixtureNow + (calls - 1) * 1_800_000);
    raw.current.weather_code = 0;
    raw.current.is_day = calls === 1 ? 1 : 0;
    await route.fulfill({json: raw});
  });
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await expect(page.locator('[data-extremes]')).toHaveText(
    'Ressenti 10° · Max. 19° / Min. 8°',
  );
  await expect(page.locator('[data-current-icon]')).toHaveClass(/clear-day/v);
  await expect(
    page.getByRole('img', {
      name: 'Température et probabilité de précipitations',
    }),
  ).toBeVisible();
  await expect(page.locator('[data-weather-now-label]')).toBeVisible();
  await expect(page.locator('table tbody tr')).toHaveCount(17);
  const rainBars = page.locator('[data-chart-rain] rect');
  await expect(rainBars).toHaveCount(8);
  expect(
    await rainBars.evaluateAll((bars) =>
      bars.every((bar) => bar.namespaceURI === 'http://www.w3.org/2000/svg'),
    ),
  ).toBe(true);
  await expect(page.locator('[data-summary]')).toContainText('16h30');
  await expect(
    page.getByRole('link', {name: 'Météo : Open-Meteo · CC BY 4.0'}),
  ).toBeVisible();
  const icons = await page
    .locator('[data-checkpoints] [class*="i-meteocons-"]')
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).backgroundImage),
    );
  expect(icons.length).toBe(4);
  expect(icons.every((icon) => icon.includes('data:image/svg+xml'))).toBe(true);
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
  }

  await page.clock.fastForward(1_800_000);
  await expect(page.locator('[data-current-icon]')).toHaveClass(/clear-night/v);
  expect(calls).toBe(2);
  await expect(rainBars).toHaveCount(8);
  await expect(page.locator('table tbody tr')).toHaveCount(17);
  await expect(page.locator('[data-checkpoints] article')).toHaveCount(4);
  await expect(page.locator('[data-current-icon]')).toHaveCSS(
    'background-image',
    /data:image\/svg\+xml/v,
  );
});

test('cached weather survives reload offline, ages visibly and recovers @chromium @mobile', async ({
  page,
  context,
}) => {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({json: weatherFixture()});
  });
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await expect
    .poll(async () =>
      page.evaluate((key) => localStorage.getItem(key), cacheKey),
    )
    .not.toBeNull();
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.abort();
  });
  await page.clock.fastForward(2_700_000);
  await page.reload();
  await expect(page.locator('[data-weather-status]')).toContainText(
    'non actualisé',
  );
  await expect(page.locator('[data-rain]')).toHaveText(
    'Conditions non actualisées.',
  );
  await expect(page.locator('[data-weather-status]')).toContainText(
    'Actualisation automatique',
  );
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await context.setOffline(true);
  await page.clock.fastForward(60_000);
  await expect(page.locator('[data-clock]').first()).toHaveText('09:16');
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Vos photos'})).toBeVisible();
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await context.setOffline(false);
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({json: weatherFixture(fixtureNow + 3_060_000)});
  });
  await page.clock.fastForward(300_000);
  await expect(page.locator('[data-weather]')).toHaveAttribute(
    'data-stale',
    'false',
  );
});

test('initial failure and malformed response keep clock/navigation and retry', async ({
  page,
}) => {
  let calls = 0;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    calls++;
    await route.fulfill({
      json:
        calls === 1
          ? {current: {temperature_2m: '<script>bad</script>'}}
          : weatherFixture(fixtureNow + 60_000),
    });
  });
  await page.goto('/');
  await expect(page.locator('[data-condition]')).toHaveText(
    'Météo indisponible',
  );
  await expect(page.locator('[data-temperature]')).toHaveText('—°');
  await expect(page.locator('[data-clock]').first()).toHaveText('08:30');
  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Bonne nuit.'})).toBeVisible();
  await page.clock.fastForward(60_000);
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  expect(calls).toBe(2);
});

test('blocked storage and unknown codes degrade safely @mobile', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('Storage denied');
      },
    });
  });
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const raw = weatherFixture();
    raw.current.weather_code = 12_345;
    await route.fulfill({json: raw});
  });
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await expect(page.locator('[data-condition]')).toHaveText(
    'Conditions inconnues',
  );
  await expect(page.locator('[data-current-icon]')).toHaveCSS(
    'background-image',
    /data:image\/svg\+xml/v,
  );
  await expect(page.locator('[data-summary]')).toContainText('16h30');
});

test('unchanged clock and forecast nodes stay stable while the time marker advances', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  const curve = await page.locator('[data-chart] path').first().elementHandle();
  const checkpoint = await page
    .locator('[data-checkpoints] article')
    .first()
    .elementHandle();
  const marker = page.locator('[data-weather-now-line]');
  const initialPosition = await marker.getAttribute('x1');
  await page.evaluate(() => {
    const root =
      globalThis.document.querySelector<HTMLElement>('[data-dashboard]')!;
    root.dataset.clockWrites = '0';
    const {MutationObserver} = globalThis;
    const observer = new MutationObserver((records) => {
      root.dataset.clockWrites = String(
        Number(root.dataset.clockWrites) + records.length,
      );
    });
    globalThis.document
      .querySelectorAll('[data-clock], [data-date]')
      .forEach((element) => {
        observer.observe(element, {
          childList: true,
          characterData: true,
          attributes: true,
          subtree: true,
        });
      });
  });
  await page.clock.runFor(10_000);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-clock-writes',
    '0',
  );
  await page.clock.runFor(50_000);
  await expect(page.locator('[data-clock]').first()).toHaveText('08:31');
  await expect(marker).not.toHaveAttribute('x1', initialPosition!);
  expect(await curve.evaluate((element) => element.isConnected)).toBe(true);
  expect(await checkpoint.evaluate((element) => element.isConnected)).toBe(
    true,
  );
});

test('inactive weather keeps fetching and renders the latest data on return', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: {...defaultSettings, overrideTimeoutSeconds: 3600}}),
  );
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const raw = weatherFixture(fixtureNow + calls * 1_800_000);
    raw.hourly.temperature_2m = raw.hourly.temperature_2m.map(
      (temperature, index) => temperature + calls * (index % 3),
    );
    raw.current.temperature_2m = calls++ === 0 ? 12 : 20;
    await route.fulfill({json: raw});
  });
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  const curve = await page.locator('[data-chart] path').first().elementHandle();
  const initialCurve = await curve.getAttribute('d');
  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'night',
  );
  await expect(page.locator('[data-dashboard]')).not.toHaveAttribute(
    'data-transition',
  );
  await page.clock.fastForward(1_800_000);
  await expect.poll(() => calls).toBe(2);
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  expect(await curve.evaluate((element) => element.isConnected)).toBe(true);
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-temperature]')).toHaveText('20°');
  expect(await curve.evaluate((element) => element.isConnected)).toBe(true);
  expect(await curve.getAttribute('d')).not.toBe(initialCurve);

  await page.evaluate(() => {
    Object.defineProperty(globalThis.document, 'hidden', {
      configurable: true,
      value: true,
    });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(60_000);
  const position = await page
    .locator('[data-weather-now-line]')
    .getAttribute('x1');
  await page.clock.fastForward(60_000);
  await expect(page.locator('[data-weather-now-line]')).toHaveAttribute(
    'x1',
    position!,
  );
  await page.evaluate(() => {
    Object.defineProperty(globalThis.document, 'hidden', {
      configurable: true,
      value: false,
    });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('[data-weather-now-line]')).not.toHaveAttribute(
    'x1',
    position!,
  );
});

test('exhausted cached forecasts hide the chart and recover into the same shell', async ({
  page,
}) => {
  let isOffline = false;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    if (isOffline) {
      await route.abort();
      return;
    }

    const now = await page.evaluate(() => Date.now());
    await route.fulfill({json: weatherFixture(now)});
  });
  await page.goto('/');
  const graph = page.getByRole('img', {
    name: 'Température et probabilité de précipitations',
  });
  await expect(graph).toBeVisible();
  const shell = await graph.elementHandle();
  isOffline = true;
  await page.clock.setSystemTime(new Date(fixtureNow + 2 * 86_400_000));
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-chart-empty]')).toHaveText(
    'Prévisions de la journée indisponibles.',
  );
  await expect(page.locator('[data-chart-empty]')).toBeVisible();
  await expect(graph).toHaveCount(0);
  await expect(page.locator('[data-point-temperature]')).toHaveText([
    '—°',
    '—°',
    '—°',
    '—°',
  ]);

  isOffline = false;
  await page.clock.fastForward(60_000);
  await expect(graph).toBeVisible();
  await expect(page.locator('[data-chart-empty]')).toBeHidden();
  await expect(page.locator('[data-chart-hours] tr')).toHaveCount(17);
  await expect(page.locator('[data-chart-rain] rect')).toHaveCount(8);
  expect(await shell.evaluate((element) => element.isConnected)).toBe(true);
});

test('partial old cache warns offline in both modes at large @mobile', async ({
  page,
}, testInfo) => {
  const raw = weatherFixture(fixtureNow - 50 * 60_000);
  await page.addInitScript(
    ({key, raw: cachedRaw, now}) => {
      localStorage.setItem(
        key,
        JSON.stringify({raw: cachedRaw, fetchedAt: now}),
      );
    },
    {key: cacheKey, raw, now: fixtureNow},
  );
  let calls = 0;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    calls++;
    await route.abort();
  });
  await page.goto('/?display=frame');
  await expect(page.locator('[data-advice]')).toHaveText(
    'Relevé il y a 50 min · non actualisé',
  );
  await expect(page.locator('[data-summary]')).toHaveText(
    'Actualisation automatique en cours. Vérifiez la météo avant de partir.',
  );
  await page.locator('[data-future-days] button').last().click();
  await expect(page.locator('[data-temperature]')).toHaveText('—°');
  await expect(page.locator('[data-condition]')).toHaveText(
    'Prévision indisponible',
  );
  await expect(page.locator('[data-chart-empty]')).toBeVisible();
  await expect(page.locator('[data-chart-hours] tr')).toHaveCount(0);
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-weather-status]')).toHaveText(
    'Relevé il y a 50 min · non actualisé',
  );
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'morning',
  );
  await expect(page.locator('[data-dashboard]')).not.toHaveAttribute(
    'data-transition',
  );
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  if (testInfo.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
  }

  for (let index = 0; index < 5; index++) {
    await page.evaluate(() => {
      globalThis.dispatchEvent(new Event('online'));
      globalThis.document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  expect(calls).toBe(1);
});

test('stale successful responses follow backoff and recover without extra browse requests', async ({
  page,
}) => {
  const start = fixtureNow + 60_000;
  await page.clock.pauseAt(start);
  let calls = 0;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    calls++;
    await route.fulfill({
      json: sevenDayFixture(
        calls < 3 ? start - 50 * 60_000 : start + 6 * 60_000,
      ),
    });
  });
  await page.goto('/');
  await expect(page.locator('[data-weather]')).toHaveAttribute(
    'data-stale',
    'true',
  );
  await page.clock.fastForward(60_000);
  await expect.poll(() => calls).toBe(2);
  // Route entry precedes response processing. Wait for acceptance before moving
  // the paused clock, so the five-minute deadline starts at the intended time.
  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const cached = JSON.parse(localStorage.getItem(key) ?? '{}') as {
          fetchedAt?: number;
        };
        return cached.fetchedAt;
      }, cacheKey),
    )
    .toBe(start + 60_000);
  await page.clock.fastForward(299_000);
  expect(calls).toBe(2);
  await page.clock.fastForward(1000);
  await expect(page.locator('[data-weather]')).toHaveAttribute(
    'data-stale',
    'false',
  );
  expect(calls).toBe(3);
});

test('previous-year stale copy fits large and override expiry closes within Morning @mobile', async ({
  page,
}, testInfo) => {
  const now = Date.parse('2027-01-01T07:30:00Z');
  const time = Date.parse('2026-12-31T22:45:00Z');
  await page.clock.setSystemTime(new Date(now));
  await page.addInitScript(
    ({key, cached, fetchedAt}) => {
      localStorage.setItem(key, JSON.stringify({raw: cached, fetchedAt}));
    },
    {key: cacheKey, cached: weatherFixture(time), fetchedAt: time},
  );
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.abort(),
  );
  await page.goto('/?display=frame');
  await expect(page.locator('[data-advice]')).toHaveText(
    'Relevé du 31 déc. 2026 à 23:45 · non actualisé',
  );
  if (testInfo.project.name !== 'mobile') {
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollHeight,
      ),
    ).toBeLessThanOrEqual(800);
  }

  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await page.clock.fastForward(
    defaultSettings.overrideTimeoutSeconds * 1000 + 1000,
  );
  await expect(page.locator('[data-weather]')).toHaveAttribute(
    'data-forecast',
    'false',
  );
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'morning',
  );
});

test('reading age advances in both modes without counting the download as a new reading', async ({
  page,
}) => {
  let calls = 0;
  let hasRecovered = false;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    calls++;
    const now = await page.evaluate(() => Date.now());
    await route.fulfill({
      json: weatherFixture(hasRecovered ? now : fixtureNow - 15 * 60_000),
    });
  });
  await page.goto('/?display=frame');
  const age = page.locator('[data-reading-age]');
  await expect(age).toHaveText('Relevé il y a 15 min');
  await expect(age).toHaveAttribute('datetime', '2026-10-16T06:15:00.000Z');
  await expect(age).toHaveAttribute(
    'title',
    /16 oct\. 2026(?:,| à) 08:15 \(Europe\/Paris\)/v,
  );
  await expect(page.locator('[data-summary]')).not.toContainText(
    'Vérifiez la météo',
  );
  await page.clock.fastForward(60_000);
  await expect(age).toHaveText('Relevé il y a 16 min');
  expect(calls).toBe(1);
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  const photoAge = page.locator('[data-photo-weather-status]');
  await expect(photoAge).toHaveText('Relevé il y a 16 min');
  await expect(photoAge).toHaveAttribute(
    'datetime',
    '2026-10-16T06:15:00.000Z',
  );
  await page.clock.fastForward(29 * 60_000);
  await expect(photoAge).toHaveText('Relevé il y a 45 min · non actualisé');
  await expect.poll(() => calls).toBe(2);
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(age).toHaveText('Relevé il y a 45 min · non actualisé');
  await expect(page.locator('[data-summary]')).toContainText(
    'Vérifiez la météo avant de partir',
  );
  hasRecovered = true;
  await page.clock.fastForward(60_000);
  await expect(age).toHaveText('Relevé à l’instant');
  await expect(age).toHaveAttribute('data-stale', 'false');
  expect(calls).toBe(3);
});

test('a location change hides the previous reading age until validated weather is available', async ({
  page,
}) => {
  let {timezone} = defaultSettings;
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: {...defaultSettings, timezone}}),
  );
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await page.goto('/');
  const age = page.locator('[data-reading-age]');
  await expect(age).toHaveText('Relevé à l’instant');
  await expect(age).toBeVisible();
  timezone = 'America/New_York';
  await page.clock.fastForward(301_000);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'night',
  );
  await expect(age).toHaveAttribute('hidden', '');
  await expect(page.locator('[data-photo-weather-status]')).toHaveAttribute(
    'hidden',
    '',
  );
  timezone = defaultSettings.timezone;
  await page.clock.fastForward(301_000);
  await expect(age).toHaveText('Relevé il y a 10 min');
  await expect(age).toBeVisible();
  await expect(age).toHaveAttribute(
    'datetime',
    new Date(fixtureNow).toISOString(),
  );
});

test('evening advice describes the next morning and keeps the daily extremes in the overview', async ({
  page,
}) => {
  const now = Date.parse('2026-10-16T20:05:00Z');
  await page.clock.setSystemTime(new Date(now));
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const raw = weatherFixture(now);
    raw.current.temperature_2m = 10;
    raw.hourly.temperature_2m = raw.hourly.time.map(() => 7);
    raw.hourly.precipitation_probability = raw.hourly.time.map(() => 0);
    await route.fulfill({json: raw});
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-summary]')).toHaveText(
    '10° maintenant, autour de 7° demain matin vers 07h00.',
  );
  await expect(page.locator('[data-extremes]')).toContainText(
    'Max. 19° / Min. 8°',
  );
});

// The old modal journeys are replaced here; pure advice/date permutations live
// in Vitest, while Firefox and mobile own selection wiring and responsive fit.
test('day strip synchronizes weather, graph and advice without changing the real date @mobile', async ({
  page,
}, info) => {
  let calls = 0;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    calls++;
    const raw = sevenDayFixture();
    raw.daily.temperature_2m_max[1] = 6;
    raw.daily.temperature_2m_min[1] = 2;
    raw.daily.precipitation_probability_max[1] = 0;
    raw.hourly.temperature_2m.splice(
      24,
      24,
      ...Array.from({length: 24}, () => 2),
    );
    raw.hourly.precipitation_probability.splice(
      24,
      24,
      ...Array.from({length: 24}, () => 0),
    );
    raw.hourly.weather_code.splice(
      24,
      24,
      ...Array.from({length: 24}, () => 3),
    );
    await route.fulfill({json: raw});
  });
  await page.goto('/?display=frame');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  const days = page.locator('[data-future-days] button');
  await expect(days).toHaveCount(7);
  await expect(days.first()).toContainText('Aujourd’hui');
  await expect(days.first()).toContainText('Max 19° · Min 8°');
  await expect(days.first()).toContainText('Pluie 65 %');
  await days.nth(1).focus();
  await page.keyboard.press('Enter');
  await expect(days.nth(1)).toBeFocused();
  await expect(days.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-weather-heading]')).toHaveText(
    'Prévisions · demain',
  );
  await expect(page.locator('[data-forecast-date]')).toContainText(
    '17 oct. 2026',
  );
  await expect(page.locator('[data-temperature]')).toHaveText('6°');
  await expect(page.locator('[data-temperature-label]')).toBeVisible();
  await expect(page.locator('[data-extremes]')).not.toContainText('Ressenti');
  await expect(page.locator('[data-advice-heading]')).toHaveText(
    'Conseil pour demain',
  );
  await expect(page.locator('[data-advice]')).toHaveText(
    'Habillez-vous chaudement.',
  );
  await expect(page.locator('[data-point-temperature]').first()).toHaveText(
    '2°',
  );
  await expect(page.locator('[data-point-label]').first()).toHaveText('Matin');
  await expect(page.locator('[data-chart-range]')).toHaveText(
    'Température · 2° à 2°C',
  );
  await expect(page.locator('[data-weather-now-label]')).toBeHidden();
  await expect(page.locator('[data-date]')).toHaveText('vendredi 16 octobre');
  await expect(page.locator('[data-current-icon]')).toHaveCSS(
    'background-image',
    /data:image\/svg\+xml/v,
  );
  await days.last().click();
  await expect(page.locator('[data-forecast-date]')).toContainText(
    '22 oct. 2026',
  );
  await expect(page.locator('[data-chart-hours] tr')).toHaveCount(17);
  await days.first().click();
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await expect(page.locator('[data-weather-heading]')).toHaveText(
    'En ce moment',
  );
  await expect(page.locator('[data-temperature-label]')).toBeHidden();
  await expect(page.locator('[data-weather-now-label]')).toBeVisible();
  await expect(page.locator('[data-advice-heading]')).toHaveText(
    'Conseil du jour',
  );
  expect(calls).toBe(1);
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

  await page
    .getByRole('button', {name: 'Changer le lieu météo', exact: true})
    .click();
  await expect(page.locator('[data-location-dialog]')).toBeVisible();
});

test('future selection returns after idle, Escape and mode changes while real input extends it', async ({
  page,
}) => {
  await page.clock.pauseAt(fixtureNow + 60_000);
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: sevenDayFixture()}),
  );
  await page.goto('/');
  const days = page.locator('[data-future-days] button');
  await days.nth(1).click();
  for (const event of ['pointerdown', 'keydown', 'wheel', 'touchmove']) {
    await page.clock.fastForward(50_000);
    await days
      .nth(1)
      .evaluate(
        (element, eventName) =>
          element.dispatchEvent(new Event(eventName, {bubbles: true})),
        event,
      );
    await expect(page.locator('[data-weather]')).toHaveAttribute(
      'data-forecast',
      'true',
    );
  }

  await page.clock.fastForward(59_999);
  await expect(page.locator('[data-weather]')).toHaveAttribute(
    'data-forecast',
    'true',
  );
  await page.clock.fastForward(1);
  await expect(days.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-weather-heading]')).toHaveText(
    'En ce moment',
  );
  await days.last().click();
  await page.keyboard.press('Escape');
  await expect(days.first()).toHaveAttribute('aria-pressed', 'true');
  await days.last().click();
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(days.first()).toHaveAttribute('aria-pressed', 'true');
  await days.last().click();
  await page.clock.setSystemTime(new Date(fixtureNow + 86_400_000));
  await page.clock.fastForward(1000);
  await expect(days.first()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-weather]')).toHaveAttribute(
    'data-forecast',
    'false',
  );
});

test('refresh retains selection and focus without extending the idle deadline', async ({
  page,
}) => {
  const start = fixtureNow + 60_000;
  await page.clock.pauseAt(start);
  await page.addInitScript(
    ({key, cached, fetchedAt}) => {
      localStorage.setItem(key, JSON.stringify({raw: cached, fetchedAt}));
    },
    {
      key: cacheKey,
      cached: sevenDayFixture(start - (45 * 60_000 - 55_000)),
      fetchedAt: start,
    },
  );
  let calls = 0;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    calls++;
    const now = await page.evaluate(() => Date.now());
    const raw = sevenDayFixture(now);
    raw.daily.temperature_2m_max[1] = 25;
    await route.fulfill({json: raw});
  });
  await page.goto('/');
  const tomorrow = page.locator('[data-future-days] button').nth(1);
  await tomorrow.click();
  await tomorrow.focus();
  expect(calls).toBe(0);
  await page.clock.fastForward(55_000);
  await expect(page.locator('[data-temperature]')).toHaveText('25°');
  await expect(tomorrow).toBeFocused();
  await expect(tomorrow).toHaveAttribute('aria-pressed', 'true');
  expect(calls).toBe(1);
  await page.clock.fastForward(5000);
  await expect(
    page.locator('[data-future-days] button').first(),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('unavailable initial forecasts keep seven usable dates without invented values', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.abort(),
  );
  await page.goto('/');
  const days = page.locator('[data-future-days] button');
  await expect(days).toHaveCount(7);
  await expect(days.first()).toContainText('Max — · Min —');
  await expect(days.first()).toContainText('Pluie —');
  await days.nth(1).click();
  await expect(page.locator('[data-weather-heading]')).toHaveText(
    'Prévisions · demain',
  );
  await expect(page.locator('[data-temperature]')).toHaveText('—°');
  await expect(page.locator('[data-condition]')).toHaveText(
    'Météo indisponible',
  );
  await expect(page.locator('[data-chart-hours] tr')).toHaveCount(0);
});
