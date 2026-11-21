import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {weatherFixture} from '../fixtures/weather.ts';

test('welcome hides Photos across appointment, pause, connection loss and the next booking', async ({
  page,
}) => {
  const now = Date.parse('2026-10-16T21:59:40Z');
  let isUnavailable = false;
  let isDismissed = false;
  const first = [now + 20_000, now + 130_000];
  const second = [now + 140_000, now + 200_000];
  await page.clock.install({time: now});
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({
      json: {
        ...defaultSettings,
        schedule: [
          {start: '00:00', end: '12:00', mode: 'photos'},
          {start: '12:00', end: '00:00', mode: 'photos'},
        ],
      },
    }),
  );
  await page.route('**/api/calendar/massage-welcome', async (route) =>
    route.fulfill({
      json: {
        enabled: true,
        ...(!isUnavailable && {
          snapshot: {
            fetchedAt: now,
            windows: isDismissed ? [second] : [first, second],
          },
        }),
      },
    }),
  );
  await page.goto('/?display=frame');
  const root = page.locator('[data-dashboard]');
  const panel = page.getByRole('region', {name: 'Accueil massages'});
  const photo = page.locator('[data-mode-panel="photos"]');
  const logo = page.getByRole('img', {name: /Les Mains de Sérénité/v});
  const pause = page.getByRole('button', {
    name: 'Masquer le logo pendant une minute',
  });
  await expect(root).toHaveAttribute('data-massage-welcome', 'off');
  await expect(photo).toBeVisible();

  await page.clock.fastForward(21_000);
  await expect(logo).toBeVisible();
  await expect
    .poll(async () =>
      logo.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(photo).toBeHidden();
  await expect(
    page.getByRole('navigation', {name: 'Modes d’affichage'}),
  ).toBeHidden();
  await expect(pause).toHaveCSS('opacity', '0');
  await panel.click();
  await expect(pause).toHaveCSS('opacity', '1');
  await pause.click();
  await expect(root).toHaveAttribute('data-massage-welcome', 'pause');
  await expect(logo).toBeHidden();
  await expect(panel.locator('time')).toHaveText(/^00:00$/v);
  await expect(photo).toBeHidden();
  await page.clock.fastForward(60_000);
  await expect(logo).toBeVisible();

  isUnavailable = true;
  await page.reload();
  await expect(root).toHaveAttribute('data-massage-welcome', 'neutral');
  await expect(photo).toBeHidden();
  isUnavailable = false;
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(logo).toBeVisible();

  isDismissed = true;
  await page.clock.fastForward(16_000);
  await expect(photo).toBeVisible();
  await page.clock.fastForward(45_000);
  await expect(logo).toBeVisible();
  await page.clock.fastForward(61_000);
  await expect(photo).toBeVisible();
});

test('phone admin confirms before ending the welcome screen @mobile-only', async ({
  page,
}) => {
  let endRequests = 0;
  await page.route('**/api/calendar/massage-welcome', async (route) => {
    if (route.request().method() === 'POST') {
      endRequests++;
    }

    await route.fulfill({json: {enabled: true}});
  });
  await page.goto('/admin/settings');
  const button = page.getByRole('button', {
    name: 'Terminer l’accueil sur le cadre',
  });
  page.once('dialog', async (dialog) => {
    expect(dialog.message()).toContain('photos de famille');
    await dialog.dismiss();
  });
  await button.click();
  expect(endRequests).toBe(0);
  page.once('dialog', async (dialog) => dialog.accept());
  await button.click();
  await expect(page.locator('[data-massage-status]')).toContainText(
    'Accueil en cours terminé',
  );
  expect(endRequests).toBe(1);
});
