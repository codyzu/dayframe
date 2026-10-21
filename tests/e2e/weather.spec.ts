import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {cacheKey} from '../../src/lib/weather/adapter.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

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
  await expect(page.getByText('Maintenant', {exact: true})).toBeVisible();
  await expect(page.locator('table tbody tr')).toHaveCount(17);
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
    'Données anciennes',
  );
  await expect(page.locator('[data-rain]')).toContainText('Dernier relevé');
  await expect(page.locator('[data-weather-status]')).toContainText(
    'connexion interrompue',
  );
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await context.setOffline(true);
  await page.clock.fastForward(60_000);
  await expect(page.locator('[data-clock]').first()).toHaveText('09:16');
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(
    page.getByRole('heading', {name: 'Une place pour vos souvenirs.'}),
  ).toBeVisible();
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
    raw.current.temperature_2m = calls++ === 0 ? 12 : 20;
    await route.fulfill({json: raw});
  });
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  const curve = await page.locator('[data-chart] path').first().elementHandle();
  await page.getByRole('button', {name: 'Nuit', exact: true}).click();
  await page.clock.fastForward(1_800_000);
  await expect.poll(() => calls).toBe(2);
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  expect(await curve.evaluate((element) => element.isConnected)).toBe(true);
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-temperature]')).toHaveText('20°');
  expect(await curve.evaluate((element) => element.isConnected)).toBe(false);

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
