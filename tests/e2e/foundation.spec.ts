import {expect, test} from '../fixtures/browser.ts';
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
  await expect(
    page.getByRole('button', {name: 'Maison', exact: true}),
  ).toHaveCount(0);
  await expect(page.locator('[data-mode-panel="home"]')).toHaveCount(0);
  const icon = page.locator('.weather-icon');
  await expect(icon).toHaveCSS('background-image', /data:image\/svg\+xml/v);
  for (const [button, title] of [
    ['Photos', 'Une place pour vos souvenirs.'],
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
    page.getByRole('button', {name: 'Choisir des photos'}),
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

test('only current weather animates and all Meteocons respect motion preference', async ({
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
  for (const [index, image] of animated.entries()) {
    expect(image).toContain('<svg');
    if (index === 0) {
      expect(image).toMatch(/<animate/v);
    } else {
      expect(image).not.toMatch(/<animate/v);
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

test('built current icon visibly animates and becomes still with reduced motion', async ({
  page,
}) => {
  // Real image timelines must advance: markup containing <animate> is insufficient.
  const now = fixtureNow + 2 * 3_600_000;
  await page.clock.setSystemTime(now);
  await page.clock.resume();
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture(now)}),
  );
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('/?display=frame');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'photos',
  );
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  const icon = page.locator('[data-current-icon]');
  await expect(icon).toHaveClass(/partly-cloudy-day-fill/v);
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 600);
  });
  const first = await icon.screenshot({animations: 'allow'});
  await expect
    .poll(
      async () => {
        const frame = await icon.screenshot({animations: 'allow'});
        return frame.equals(first);
      },
      {
        timeout: 8000,
        intervals: [400, 800, 1200],
      },
    )
    .toBe(false);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect
    .poll(async () =>
      decodeURIComponent(
        await icon.evaluate(
          (element) => getComputedStyle(element).backgroundImage,
        ),
      ).includes('<animate'),
    )
    .toBe(false);
  const still = await icon.screenshot({animations: 'allow'});
  // An elapsed interval is intentional here: verify rendered stillness, not just SVG tags.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 900);
  });
  const after = await icon.screenshot({animations: 'allow'});
  expect(after.equals(still)).toBe(true);
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
  expect(await icon.locator('svg g[overflow]').count()).toBeGreaterThan(0);
  for (const time of [0, 3]) {
    await icon.evaluate((element, seconds) => {
      const svg = element.querySelector('svg')!;
      svg.pauseAnimations();
      svg.setCurrentTime(seconds);
    }, time);
    expect(
      await icon
        .locator('svg g[overflow]')
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

test('ordinary build publishes its matching public build ID and leaves worker activation gated', async ({
  page,
  request,
}) => {
  const response = await request.get('/version.json');
  const value = (await response.json()) as {build: string};
  await page.goto('/');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-build',
    value.build,
  );
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-ready',
    'true',
  );
  expect(
    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length;
    }),
  ).toBe(0);
});
