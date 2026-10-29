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

test('live day/night data, accessible graph and 30-minute refresh', async ({
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

  await page.screenshot({
    path: testInfo.outputPath('weather-day.png'),
    fullPage: true,
    animations: 'disabled',
  });
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
  await page.screenshot({
    path: testInfo.outputPath('weather-night.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('cached weather survives reload offline, ages visibly and recovers', async ({
  page,
  context,
}, testInfo) => {
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
  await page.screenshot({
    path: testInfo.outputPath('weather-stale.png'),
    fullPage: true,
    animations: 'disabled',
  });
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

test('blocked storage and unknown codes degrade safely', async ({page}) => {
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

for (const density of ['standard', 'large']) {
  test(`future browsing is bounded, accessible and fits ${density}`, async ({
    page,
  }, testInfo) => {
    let calls = 0;
    await page.route('https://api.open-meteo.com/**', async (route) => {
      calls++;
      await route.fulfill({json: sevenDayFixture()});
    });
    await page.goto(`/?density=${density}`);
    const open = page.getByRole('button', {name: 'Prévisions sur 7 jours'});
    await open.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', {name: 'Fermer'})).toBeFocused();
    await expect(dialog.locator('[data-future-days] button')).toHaveCount(7);
    const last = dialog.locator('[data-future-days] button').last();
    await last.click();
    await expect(last).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('button', {name: 'Fermer'})).toBeInViewport();
    await expect(dialog.locator('[data-future-heading]')).toContainText(
      '22 oct. 2026',
    );
    await expect(dialog.locator('tbody tr')).toHaveCount(24);
    await expect(dialog.locator('[data-future-coverage]')).toContainText(
      'Europe/Paris',
    );
    await expect(last.locator('[data-future-rain]')).toHaveText('Pluie : 65 %');
    await expect(last.locator('[data-future-icon]')).toHaveCSS(
      'background-image',
      /data:image\/svg\+xml/v,
    );
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    if (testInfo.project.name !== 'mobile') {
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollHeight,
        ),
      ).toBeLessThanOrEqual(800);
      expect(
        await dialog.evaluate(
          (element) => element.scrollHeight <= element.clientHeight,
        ),
      ).toBe(true);
    }

    await page.screenshot({
      path: testInfo.outputPath(`forecast-${density}.png`),
      fullPage: true,
      animations: 'disabled',
    });
    await dialog.getByRole('button', {name: 'Fermer'}).click();
    await expect(open).toBeFocused();
    await open.click();
    await expect(
      dialog.locator('[data-future-days] button').first(),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
    expect(calls).toBe(1);
    await open.click();
    // A scheduled mode transition closes the top-layer dialog.
    await page.clock.setSystemTime(new Date('2026-10-16T08:01:00Z'));
    await page.clock.fastForward(1000);
    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-dashboard]')).toHaveAttribute(
      'data-mode',
      'photos',
    );
  });
}

for (const density of ['standard', 'large']) {
  test(`partial old cache warns offline in both modes at ${density}`, async ({
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
    await page.goto(`/?density=${density}`);
    await expect(page.locator('[data-advice]')).toHaveText(
      'Relevé il y a 50 min · non actualisé',
    );
    await expect(page.locator('[data-summary]')).toHaveText(
      'Actualisation automatique en cours. Vérifiez la météo avant de partir.',
    );
    await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('[data-future-status]')).toContainText(
      'Prévisions non actualisées',
    );
    await dialog.locator('[data-future-days] button').last().click();
    await expect(
      dialog.locator('[data-future-days] button').last(),
    ).toContainText('Prévision indisponible');
    await expect(dialog.locator('[data-future-coverage]')).toContainText(
      'horaires indisponibles',
    );
    await expect(dialog.locator('tbody tr')).toHaveCount(0);
    await expect(dialog.locator('[data-future-chart]')).toBeHidden();
    await dialog.getByRole('button', {name: 'Fermer'}).click();
    await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
    await page.getByRole('button', {name: 'Photos', exact: true}).click();
    await expect(page.locator('[data-photo-weather-status]')).toHaveText(
      'Relevé il y a 50 min · non actualisé',
    );
    await page.screenshot({
      path: testInfo.outputPath('photos-dated-stale.png'),
      fullPage: true,
    });
    await page.getByRole('button', {name: 'Matin', exact: true}).click();
    await expect(page.locator('[data-dashboard]')).toHaveAttribute(
      'data-mode',
      'morning',
    );
    await expect(page.locator('[data-dashboard]')).not.toHaveAttribute(
      'data-transition',
    );
    await page.screenshot({
      path: testInfo.outputPath('morning-dated-stale.png'),
      fullPage: true,
    });
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
}

test('future dates use Paris across year change with a different browser timezone', async ({
  page,
}) => {
  const now = Date.parse('2026-12-31T23:30:00Z');
  await page.clock.setSystemTime(new Date(now));
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({json: sevenDayFixture(now)});
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  await expect(
    page.locator('[data-future-days] button').first(),
  ).toHaveAttribute('aria-label', /^ven\. 1 janv\. 2027/v);
  await expect(page.locator('[data-future-heading]')).toContainText(
    '1 janv. 2027',
  );
  await page.clock.fastForward(
    defaultSettings.overrideTimeoutSeconds * 1000 + 1000,
  );
  await expect(page.getByRole('dialog')).toBeHidden();
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
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  await expect(page.locator('[data-future-status]')).toContainText(
    'non actualisées',
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
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  await expect(page.locator('[data-future-status]')).toContainText(
    'Prévisions pour Annecy',
  );
  expect(calls).toBe(3);
});

test.describe('location timezone and DST', () => {
  test.use({timezoneId: 'America/Los_Angeles'});
  test('autumn detail distinguishes repeated local hours and keeps keyboard focus on refresh', async ({
    page,
  }) => {
    const now = Date.parse('2026-10-25T06:30:00Z');
    await page.clock.setSystemTime(new Date(now));
    await page.route('https://api.open-meteo.com/**', async (route) => {
      const time = await page.evaluate(() => Date.now());
      await route.fulfill({json: sevenDayFixture(time)});
    });
    await page.goto('/');
    await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
    const dialog = page.getByRole('dialog');
    const first = dialog.locator('[data-future-days] button').first();
    await first.focus();
    await page.keyboard.press('Enter');
    await expect(dialog.locator('tbody tr')).toHaveCount(25);
    const repeated = dialog.locator('tbody tr').filter({hasText: '02:00'});
    await expect(repeated).toHaveCount(2);
    await expect(repeated.first()).toContainText('UTC+2');
    await expect(repeated.last()).toContainText('UTC+1');
    const original = await first.elementHandle();
    // Keep browsing during the half-hour refresh without changing selection.
    for (let elapsed = 0; elapsed < 1_800_000; elapsed += 50_000) {
      await page.clock.fastForward(50_000);
      await page.keyboard.press('Shift');
    }

    await expect
      .poll(async () => original.evaluate((element) => element.isConnected))
      .toBe(false);
    await expect(first).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', {name: 'Prévisions sur 7 jours'}),
    ).toBeFocused();
  });
});

test('forecast loading and unavailable states never invent future data', async ({
  page,
}) => {
  let rejectRequest: (() => Promise<void>) | undefined;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    rejectRequest = async () => route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-future-status]')).toHaveText(
    'Chargement des prévisions…',
  );
  await expect(dialog.locator('[data-future-days] button')).toHaveCount(7);
  await rejectRequest!();
  await expect(dialog.locator('[data-future-status]')).toContainText(
    'Prévisions indisponibles',
  );
  await expect(
    dialog.locator('[data-future-days] button').first(),
  ).toContainText('Pluie : —');
  await expect(dialog.locator('tbody tr')).toHaveCount(0);
  await page.keyboard.press('Tab');
  expect(
    await dialog.evaluate((element) =>
      element.contains(globalThis.document.activeElement),
    ),
  ).toBe(true);
  const tomorrow = dialog.locator('[data-future-days] button').nth(1);
  await tomorrow.focus();
  await page.keyboard.press('Space');
  await expect(tomorrow).toHaveAttribute('aria-pressed', 'true');
});

for (const density of ['standard', 'large']) {
  test(`previous-year stale copy fits ${density} and override expiry closes within Morning`, async ({
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
    await page.goto(`/?density=${density}`);
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
    await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
    await page.clock.fastForward(
      defaultSettings.overrideTimeoutSeconds * 1000 + 1000,
    );
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.locator('[data-dashboard]')).toHaveAttribute(
      'data-mode',
      'morning',
    );
  });
}

test('reading age advances in both modes without counting the download as a new reading', async ({
  page,
}, testInfo) => {
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
  await page.screenshot({
    path: testInfo.outputPath('reading-age-recovered.png'),
    fullPage: true,
  });
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

test('forecast closes after 60 idle seconds, restores focus and reopens with a fresh timeout', async ({
  page,
}) => {
  await page.clock.pauseAt(fixtureNow + 60_000);
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: sevenDayFixture()}),
  );
  await page.goto('/');
  const open = page.getByRole('button', {name: 'Prévisions sur 7 jours'});
  const dialog = page.getByRole('dialog');
  await open.click();
  await page.clock.fastForward(59_999);
  await expect(dialog).toBeVisible();
  await page.clock.fastForward(1);
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'morning',
  );
  await page.clock.fastForward(20_000);
  await open.click();
  await page.clock.fastForward(59_999);
  await expect(dialog).toBeVisible();
  await page.clock.fastForward(1);
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test('pointer, keyboard, wheel and touch input reset the forecast idle timeout', async ({
  page,
}) => {
  await page.clock.pauseAt(fixtureNow + 60_000);
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: sevenDayFixture()}),
  );
  await page.goto('/');
  const open = page.getByRole('button', {name: 'Prévisions sur 7 jours'});
  const dialog = page.getByRole('dialog');
  await open.click();
  const card = dialog.locator('[data-future-days] button').last();
  for (const event of ['pointerdown', 'keydown', 'wheel', 'touchmove']) {
    await page.clock.fastForward(40_000);
    // Desktop Firefox has no TouchEvent constructor; exercise the shared input
    // listener without implying a physical touch-device acceptance check.
    await card.evaluate((element, eventName) => {
      element.dispatchEvent(new Event(eventName, {bubbles: true}));
    }, event);
    await page.clock.fastForward(10_000);
    await expect(dialog).toBeVisible();
  }

  await page.clock.fastForward(49_999);
  await expect(dialog).toBeVisible();
  await page.clock.fastForward(1);
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test('weather refresh and programmatic focus do not prolong forecast browsing', async ({
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
    await route.fulfill({json: sevenDayFixture(now)});
  });
  await page.goto('/');
  const open = page.getByRole('button', {name: 'Prévisions sur 7 jours'});
  await open.click();
  const dialog = page.getByRole('dialog');
  const card = dialog.locator('[data-future-days] button').last();
  await card.focus();
  expect(calls).toBe(0);
  await page.clock.fastForward(55_000);
  await expect
    .poll(async () =>
      page.evaluate((key) => {
        const cached = JSON.parse(localStorage.getItem(key) ?? '{}') as {
          fetchedAt?: number;
        };
        return cached.fetchedAt;
      }, cacheKey),
    )
    .toBe(start + 55_000);
  expect(calls).toBe(1);
  await expect(card).toBeFocused();
  await page.clock.fastForward(4999);
  await expect(dialog).toBeVisible();
  await page.clock.fastForward(1);
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test('selected-day graph leads the forecast, with exact hourly details on demand', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  let calls = 0;
  await page.route('https://api.open-meteo.com/**', async (route) => {
    calls++;
    await route.fulfill({json: sevenDayFixture()});
  });
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  const dialog = page.getByRole('dialog');
  const chart = dialog.locator('[data-future-chart]');
  await expect(chart).toBeVisible();
  await expect(dialog.locator('[data-future-chart-now-label]')).toBeVisible();
  await expect(dialog.locator('[data-future-chart-past]')).not.toHaveAttribute(
    'width',
    '0',
  );
  await expect(dialog.locator('[data-future-summary]')).toContainText(
    'À venir',
  );
  await expect(dialog.locator('[data-future-details]')).not.toHaveAttribute(
    'open',
  );
  await expect(dialog.getByRole('table')).toBeHidden();
  await expect(chart.locator('rect title')).toHaveCount(24);
  const originalPath = await chart.locator('path').first().getAttribute('d');
  const tomorrow = dialog.locator('[data-future-days] button').nth(1);
  await tomorrow.focus();
  await page.keyboard.press('Enter');
  await expect(tomorrow).toBeFocused();
  await expect(tomorrow).toBeInViewport();
  await expect(tomorrow).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.locator('[data-future-chart-now-label]')).toBeHidden();
  await expect(dialog.locator('[data-future-chart-past]')).toHaveAttribute(
    'width',
    '0',
  );
  await expect(chart.locator('path').first()).not.toHaveAttribute(
    'd',
    originalPath!,
  );
  await expect(chart).toBeInViewport();
  const chartBounds = await chart.boundingBox();
  const dialogBounds = await dialog.boundingBox();
  expect(chartBounds!.y + chartBounds!.height).toBeLessThanOrEqual(
    dialogBounds!.y + dialogBounds!.height,
  );
  await page.screenshot({
    path: testInfo.outputPath('forecast-graph.png'),
    fullPage: false,
    animations: 'disabled',
  });
  await dialog.locator('summary').click();
  await expect(dialog.getByRole('table')).toBeVisible();
  await expect(dialog.locator('[data-future-hours] tr')).toHaveCount(24);
  await dialog.locator('[data-future-days] button').last().click();
  await expect(dialog.locator('[data-future-details]')).not.toHaveAttribute(
    'open',
  );
  await expect(dialog.getByRole('table')).toBeHidden();
  await expect(dialog.locator('[data-future-chart]')).toBeVisible();
  await dialog.getByRole('button', {name: 'Fermer'}).click();
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  const today = dialog.locator('[data-future-days] button').first();
  await expect(today).toBeInViewport();
  await expect(today).toHaveAttribute('aria-pressed', 'true');
  await dialog.locator('summary').click();
  await expect(dialog.getByRole('table')).toBeVisible();
  await dialog.getByRole('button', {name: 'Fermer'}).click();
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  await expect(dialog.getByRole('table')).toBeHidden();
  await expect(dialog.locator('[data-future-details]')).not.toHaveAttribute(
    'open',
  );
  expect(calls).toBe(1);
});

test('evening advice describes the next morning and keeps the daily extremes in the overview', async ({
  page,
}, testInfo) => {
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
  await page.screenshot({
    path: testInfo.outputPath('evening-advice.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('partial hourly coverage is labeled without inventing earlier hours', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const raw = sevenDayFixture();
    // A contiguous forecast can begin partway through the first local day.
    for (const values of Object.values(raw.hourly)) {
      values.splice(0, 6);
    }

    await route.fulfill({json: raw});
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('[data-future-chart-note]')).toBeVisible();
  await expect(dialog.locator('[data-future-chart-note]')).toContainText(
    'partielle',
  );
  const path = await dialog
    .locator('[data-future-chart-curve]')
    .first()
    .getAttribute('d');
  expect(path!.match(/M/gv)).toHaveLength(1);
  await expect(dialog.locator('[data-future-chart-rain] rect')).toHaveCount(18);
  await expect(dialog.locator('[data-future-chart-times]')).toContainText(
    '06h',
  );
  await expect(dialog.locator('[data-future-chart-times]')).not.toContainText(
    '00h',
  );
  await dialog.locator('[data-future-days] button').nth(1).click();
  await expect(dialog.locator('[data-future-chart-note]')).toBeHidden();
  const fullPath = await dialog
    .locator('[data-future-chart-curve]')
    .first()
    .getAttribute('d');
  expect(fullPath!.match(/M/gv)).toHaveLength(1);
});

test('forecast day buttons keep their complete focus outlines inside the scrolling strip', async ({
  page,
}) => {
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: sevenDayFixture()}),
  );
  await page.goto('/');
  await page.getByRole('button', {name: 'Prévisions sur 7 jours'}).click();
  const dialog = page.getByRole('dialog');
  const strip = dialog.locator('[data-future-days]');
  // Establish keyboard modality; Safari's Tab cycle depends on platform preferences.
  await page.keyboard.press('Tab');
  for (const index of [0, 3, 6]) {
    const day = strip.locator('button').nth(index);
    await day.focus();
    await page.keyboard.press('Enter');
    await expect(day).toBeFocused();
    await expect(day).toHaveCSS('outline-style', 'solid');
    const bounds = await day.evaluate((button) => {
      const style = getComputedStyle(button);
      const inset =
        Number(style.outlineWidth.replace('px', '')) +
        Number(style.outlineOffset.replace('px', ''));
      const card = button.getBoundingClientRect();
      const parent = button.parentElement!.getBoundingClientRect();
      return {
        left: card.left - inset - parent.left,
        right: parent.right - card.right - inset,
        top: card.top - inset - parent.top,
        bottom: parent.bottom - card.bottom - inset,
      };
    });
    for (const clearance of Object.values(bounds)) {
      expect(clearance).toBeGreaterThanOrEqual(-1);
    }
  }
});
