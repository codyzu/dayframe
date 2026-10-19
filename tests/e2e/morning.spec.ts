import {expect, test} from '@playwright/test';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
});

test('four usable checkpoints, full-day chart, advice and an honest empty agenda', async ({
  page,
}) => {
  await page.goto('/?display=frame');
  await expect(page.locator('[data-checkpoints] article')).toHaveCount(4);
  for (const time of ['08h00', '11h30', '16h30', '18h00']) {
    await expect(page.getByRole('heading', {name: time})).toBeVisible();
  }

  await expect(page.locator('[data-chart] rect')).toHaveCount(8);
  await expect(page.locator('[data-chart] table tbody tr')).toHaveCount(17);
  await expect(page.locator('[data-advice]')).toHaveText(
    'Prenez un parapluie.',
  );
  await expect(page.getByText('Aucun agenda connecté.')).toBeVisible();
  await expect(page.locator('[data-weather-status]')).toBeHidden();
  await expect(
    page.getByRole('button', {name: 'Réessayer la connexion'}),
  ).toBeHidden();
  const icon = await page.locator('[data-current-icon]').boundingBox();
  expect(icon!.width).toBeGreaterThanOrEqual(120);
  // Opaque cards keep primary text independent of the decorative landscape.
  const contrast = await page
    .locator('[data-condition]')
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const surface = getComputedStyle(element.closest('section')!);
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const luminance = (color: string) => {
        // Resolve computed color(srgb), rgb and color-mix output consistently.
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const rgb = [...context.getImageData(0, 0, 1, 1).data]
          .slice(0, 3)
          .map((value) => {
            const channel = value / 255;
            return channel <= 0.04045
              ? channel / 12.92
              : ((channel + 0.055) / 1.055) ** 2.4;
          });
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };

      const values = [
        luminance(style.color),
        luminance(surface.backgroundColor),
      ].toSorted((a, b) => b - a);
      return (values[0] + 0.05) / (values[1] + 0.05);
    });
  expect(contrast).toBeGreaterThanOrEqual(7);
  await page.getByText('À propos des prévisions', {exact: true}).click();
  await expect(
    page.getByText(
      /^Barres de pluie : maximum des probabilités horaires de chaque tranche/v,
    ),
  ).toBeVisible();
});

test('stale and unavailable weather keep essential content within the frame', async ({
  page,
}, info) => {
  test.skip(info.project.name === 'mobile');
  await page.goto('/?display=frame');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  await page.unroute('https://api.open-meteo.com/**');
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.abort(),
  );
  await page.clock.fastForward(2_700_000);
  await page.reload();
  await expect(page.locator('[data-weather]')).toHaveAttribute(
    'data-stale',
    'true',
  );
  await expect(page.locator('[data-advice]')).toHaveText(
    'Vérifiez la météo avant de partir.',
  );
  expect(
    await page.evaluate(() => globalThis.document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(800);
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  await expect(page.locator('[data-condition]')).toHaveText(
    'Météo indisponible',
  );
  await expect(
    page.getByRole('button', {name: 'Réessayer la connexion'}),
  ).toBeVisible();
  expect(
    await page.evaluate(() => globalThis.document.documentElement.scrollHeight),
  ).toBeLessThanOrEqual(800);
});
