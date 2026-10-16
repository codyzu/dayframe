import {expect, test} from '@playwright/test';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

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

test('weather icons switch between animated and static images with motion preference', async ({
  page,
}) => {
  await page.emulateMedia({reducedMotion: 'no-preference'});
  await page.goto('/');
  await expect(page.locator('[data-current-icon]')).toHaveClass(
    /i-meteocons-partly-cloudy-day-fill/v,
  );
  const icons = page.locator('[data-weather] [class*="i-meteocons-"]');
  await expect(
    page.locator('[data-chart] [class*="i-meteocons-"]').first(),
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
  }

  await page.emulateMedia({reducedMotion: 'reduce'});
  for (const image of await images()) {
    expect(image).toContain('<svg');
    expect(image).not.toMatch(/<animate/v);
    expect(image).not.toContain(' opacity="0"');
  }

  await page.emulateMedia({reducedMotion: 'no-preference'});
  expect(await images()).toEqual(animated);
});
