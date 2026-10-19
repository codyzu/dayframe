import {expect, test} from '@playwright/test';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';
import {conditionFor} from '../../src/lib/weather/conditions.ts';

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
  await page.route('https://api.open-meteo.com/**', async (route) => {
    await route.fulfill({json: weatherFixture()});
  });
});

test('French weather shell, working modes and locally bundled assets', async ({
  page,
}, testInfo) => {
  const failures: string[] = [];
  const remoteRequests: string[] = [];
  page.on('pageerror', (error) => {
    failures.push(error.message);
  });
  page.on('request', (request) => {
    if (
      !/^(?:127\.0\.0\.1|localhost|api\.open-meteo\.com)$/v.test(
        new URL(request.url()).hostname,
      )
    ) {
      remoteRequests.push(request.url());
    }
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', {name: 'Bonjour, Annecy.'}),
  ).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('[data-clock]').first()).toHaveText(/\d{2}:\d{2}/v);
  await expect(page.getByText('Météo · Annecy')).toBeVisible();
  const icon = page.locator('.weather-icon');
  await expect(icon).toHaveCSS('background-image', /data:image\/svg\+xml/v);
  for (const [button, title] of [
    ['Photos', 'Une place pour vos souvenirs.'],
    ['Maison', 'Bienvenue à la maison.'],
    ['Nuit', 'Bonne nuit.'],
    ['Matin', 'Bonjour, Annecy.'],
  ]) {
    await page.getByRole('button', {name: button, exact: true}).click();
    await expect(page.getByRole('heading', {name: title})).toBeVisible();
    await expect(
      page.getByRole('button', {name: button, exact: true}),
    ).toHaveAttribute('aria-pressed', 'true');
    if (testInfo.project.name !== 'mobile') {
      expect(
        await page.evaluate(
          () => globalThis.document.documentElement.scrollHeight,
        ),
      ).toBeLessThanOrEqual(800);
    }
  }

  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  expect(remoteRequests).toEqual([]);
  expect(failures).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('dashboard.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('admin placeholder is responsive and cannot upload', async ({
  page,
}, testInfo) => {
  await page.goto('/admin/photos');
  await expect(page.getByRole('heading', {name: 'Vos photos'})).toBeVisible();
  await expect(
    page.getByRole('button', {name: 'Ajouter des photos'}),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath('admin.png'),
    fullPage: true,
    animations: 'disabled',
  });
});

test('Worker routing fails closed even for document navigations', async ({
  page,
  request,
}) => {
  const health = await request.get('/api/health');
  expect(await health.json()).toMatchObject({ok: true, stage: 'local'});
  for (const path of [
    '/api',
    '/api/photos',
    '/api/photos/example',
    '/api/config',
    '/api/missing',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    expect(response?.headers()['content-type']).toContain('application/json');
    expect(response?.headers()['cache-control']).toBe('no-store');
  }

  const missing = await page.goto('/nonexistent');
  expect(missing?.status()).toBe(404);
  await expect(
    page.getByRole('heading', {name: 'Cette page n’existe pas.'}),
  ).toBeVisible();
});

test('keyboard navigation and reduced motion', async ({page}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.goto('/');
  const photos = page.getByRole('button', {name: 'Photos', exact: true});
  await photos.focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('heading', {name: 'Une place pour vos souvenirs.'}),
  ).toBeVisible();
  await expect(photos).toHaveCSS('transition-duration', '0s');
  const css = await page
    .locator('.weather-icon')
    .evaluate((element) => getComputedStyle(element).backgroundImage);
  expect(decodeURIComponent(css)).not.toMatch(/<animate/v);
});

test('current weather and checkpoint Meteocons animate and respect motion preference', async ({
  page,
}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('/');
  await expect(page.locator('[data-current-icon]')).toHaveClass(
    /i-meteocons-partly-cloudy-day-fill/v,
  );
  const icons = page.locator('[data-weather] [class*="i-meteocons-"]');
  await expect(
    page.locator('[data-checkpoints] [class*="i-meteocons-"]').first(),
  ).toBeVisible();
  const images = async () =>
    icons.evaluateAll((elements) =>
      elements.map((element) =>
        decodeURIComponent(getComputedStyle(element).backgroundImage),
      ),
    );
  const animated = await images();
  expect(animated.length).toBeGreaterThan(1);
  for (const image of animated) {
    expect(image).toContain('<svg');
    expect(image).toMatch(/<animate/v);

    for (const symbol of image.matchAll(/<symbol\b[^>]*>/gv)) {
      expect(symbol[0]).toMatch(/overflow=["']visible["']/v);
    }
  }

  await page.emulateMedia({reducedMotion: 'reduce'});
  const reduced = await images();
  for (const image of reduced) {
    expect(image).toContain('<svg');
    expect(image).not.toMatch(/<animate/v);
    expect(image).not.toContain(' opacity="0"');
  }

  await page.emulateMedia({reducedMotion: 'no-preference'});
  expect(await images()).toEqual(animated);
});

test('overcast cloud stays visible at both animation extremes', async ({
  page,
}, testInfo) => {
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', async (route) => {
    const raw = weatherFixture();
    raw.current.weather_code = 3;
    await route.fulfill({json: raw});
  });
  await page.goto('/?density=large');
  const icon = page.locator('[data-current-icon]');
  await expect(icon).toHaveClass(/overcast-day/v);
  // Inline the exact bundled image only in this test so SMIL time can be set
  // deterministically; CSS background images do not expose setCurrentTime().
  await icon.evaluate((element) => {
    const image = decodeURIComponent(getComputedStyle(element).backgroundImage);
    const markup = image.slice(
      image.indexOf('<svg'),
      image.lastIndexOf('</svg>') + 6,
    );
    const svg = new DOMParser().parseFromString(
      markup,
      'image/svg+xml',
    ).documentElement;
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    element.replaceChildren(document.importNode(svg, true));
    (element as HTMLElement).style.backgroundImage = 'none';
  });
  expect(await icon.locator('symbol').count()).toBeGreaterThan(0);
  for (const time of [0, 3]) {
    await icon.evaluate((element, seconds) => {
      const svg = element.querySelector('svg')!;
      svg.pauseAnimations();
      svg.setCurrentTime(seconds);
    }, time);
    expect(
      await icon
        .locator('symbol')
        .evaluateAll((symbols) =>
          symbols.every(
            (symbol) => getComputedStyle(symbol).overflow === 'visible',
          ),
        ),
    ).toBe(true);
    await icon.screenshot({path: testInfo.outputPath(`overcast-${time}s.png`)});
  }
});

test('precipitation and lightning keep repeating in the bundled current icon', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.clock.resume();
  await page.addInitScript(() => {
    localStorage.clear();
  });
  // Sleet combines the two-second drizzle and three-second snow loops.
  for (const [code, period] of [
    [51, 2],
    [56, 6],
    [61, 1],
    [71, 3],
    [80, 1],
    [95, 2],
    [96, 1],
  ]) {
    for (const isDay of [1, 0]) {
      await page.unroute('https://api.open-meteo.com/**');
      await page.route('https://api.open-meteo.com/**', async (route) => {
        const raw = weatherFixture();
        raw.current.weather_code = code;
        raw.current.is_day = isDay;
        await route.fulfill({json: raw});
      });
      await page.goto('/');
      const icon = page.locator('[data-current-icon]');
      await expect(icon).toHaveClass(
        new RegExp(conditionFor(code, isDay === 1).icon, 'v'),
      );
      // Use the exact production CSS image, inlined only to seek SMIL time.
      const markup = await icon.evaluate((element) => {
        const image = decodeURIComponent(
          getComputedStyle(element).backgroundImage,
        );
        return image.slice(
          image.indexOf('<svg'),
          image.lastIndexOf('</svg>') + 6,
        );
      });
      const readAt = async (seconds: number) => {
        // Start each sample with a fresh timeline: WebKit retains syncbase
        // event history across seeks, which differs from ordinary playback.
        await icon.evaluate(
          async (element, {source, time}) => {
            const svg = document.importNode(
              new DOMParser().parseFromString(source, 'image/svg+xml')
                .documentElement,
              true,
            ) as unknown as SVGSVGElement;
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            element.replaceChildren(svg);
            (element as HTMLElement).style.backgroundImage = 'none';
            svg.pauseAnimations();
            svg.setCurrentTime(time);
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  resolve();
                });
              });
            });
          },
          {source: markup, time: seconds},
        );
        // Read the sampled SMIL value rather than just checking for elements.
        return icon
          .locator('animate[attributeName="opacity"]')
          .evaluateAll((animations) =>
            animations.map((animation) =>
              Number(getComputedStyle(animation.parentElement!).opacity),
            ),
          );
      };

      const phases = [await readAt(0.4), await readAt(1)];
      expect(phases[0].length).toBeGreaterThan(0);
      for (const cycle of [3, 10]) {
        for (const [index, phase] of [0.4, 1].entries()) {
          const repeated = await readAt(cycle * period + phase);
          expect(
            repeated,
            `${code}/${isDay} at ${cycle * period + phase}s`,
          ).toEqual(phases[index].map((opacity) => expect.closeTo(opacity, 3)));
        }
      }

      expect(phases[0]).not.toEqual(phases[1]);
      expect(phases.flat().some((opacity) => opacity > 0)).toBe(true);

      await icon.screenshot({
        path: testInfo.outputPath(`repeated-${code}-${isDay}.png`),
      });
    }
  }
});
