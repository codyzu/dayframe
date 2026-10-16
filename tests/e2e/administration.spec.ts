/* eslint-disable unicorn/no-await-expression-member -- Keep browser response assertions inline for the role matrix. */
import {Buffer} from 'node:buffer';
import {expect, test} from '@playwright/test';
import {weatherFixture} from '../fixtures/weather.ts';

const origin = 'https://127.0.0.1:8789';
test.use({baseURL: origin, ignoreHTTPSErrors: true});
test.beforeEach(async ({page}) => {
  await page.request.get('/__test/reset');
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
});

test('both administrators persist settings, export, validate schedules and recover access', async ({
  page,
}, info) => {
  await page.request.get('/__test/login');
  await page.goto('/admin/settings');
  await expect(page.locator('[data-status]')).toContainText('one@example.test');
  await page.getByLabel('Lieu', {exact: true}).fill('Maison de test');
  await page.getByLabel('Durée d’une photo').fill('45');
  await page.getByLabel('Cadrage par défaut').selectOption('cover');
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click();
  await expect(page.locator('[data-status]')).toHaveText(
    'Réglages enregistrés.',
  );
  const {promise: configurationGate, resolve: releaseConfiguration} =
    Promise.withResolvers<void>();
  await page.route('**/api/config/display', async (route) => {
    await configurationGate;
    await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'photos',
  );
  releaseConfiguration();
  await expect(page.locator('[data-location]')).toHaveText(
    'Météo · Maison de test',
  );
  await expect(page.locator('[data-photo-stage]')).toHaveAttribute(
    'data-fit',
    'cover',
  );
  await expect(page.locator('[data-location-greeting]')).toHaveText(
    'Bonjour, Maison de test.',
  );
  await page.unroute('**/api/config/display');
  await page.request.get('/__test/login?admin=two');
  await page.goto('/admin/settings');
  await expect(page.locator('[data-status]')).toContainText('two@example.test');
  await expect(page.getByLabel('Lieu', {exact: true})).toHaveValue(
    'Maison de test',
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Exporter les réglages'}).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    'dayframe-settings.json',
  );
  await page.locator('[data-start]').nth(1).fill('09:59');
  await page.getByRole('button', {name: 'Enregistrer les réglages'}).click();
  await expect(page.locator('[data-status]')).toContainText('chevauchement');
  await page.screenshot({
    path: `docs/evidence/m4/settings-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  await page.context().clearCookies();
  await page.getByRole('button', {name: 'Actualiser l’accès'}).click();
  await expect(page.getByLabel('Lieu', {exact: true})).toBeDisabled();
  await page.request.get('/__test/login?admin=two');
  await page.getByRole('button', {name: 'Actualiser l’accès'}).click();
  await expect(page.getByLabel('Lieu', {exact: true})).toBeEnabled();
});

test('frame provisioning persists across browser contexts, rejects off-network reads and revokes the old key', async ({
  page,
  browser,
}, info) => {
  await page.request.get('/__test/login');
  await page.goto('/admin/photos');
  await expect(page.locator('[data-choose-files]')).toBeEnabled();
  const png = await page.evaluate(() => {
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 32;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#537f78';
    context.fillRect(0, 0, 64, 32);
    return canvas.toDataURL('image/png').split(',', 2)[1];
  });
  await page.locator('[data-photo-files]').setInputFiles({
    name: 'restart.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await expect(page.locator('[data-photo-gallery] img')).toHaveJSProperty(
    'naturalWidth',
    64,
  );
  const imagePath = await page
    .locator('[data-photo-gallery] img')
    .getAttribute('src');
  await page.goto('/admin/settings');
  await expect(page.locator('[data-issue]')).toBeEnabled();
  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', {name: 'Créer ou remplacer la clé'}).click();
  await expect(page.locator('[data-token]')).toHaveText(/^[0-9a-f]{64}$/v);
  const key = await page.locator('[data-token]').textContent();
  const display = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  try {
    const frame = await display.newPage();
    await frame.route('https://api.open-meteo.com/**', async (route) =>
      route.fulfill({json: weatherFixture()}),
    );
    await frame.goto('/setup');
    await frame.screenshot({
      path: `docs/evidence/m4/setup-${info.project.name}.png`,
      fullPage: true,
    });
    await frame.getByLabel('Clé du cadre').fill(key!);
    await frame.getByRole('button', {name: 'Connecter', exact: true}).click();
    await expect(frame).toHaveURL(`${origin}/?display=frame`);
    const displayCookie = (await display.cookies()).find(
      (cookie) => cookie.name === '__Secure-dayframe_display',
    );
    expect(displayCookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'Strict',
      path: '/api',
    });
    expect(displayCookie!.expires).toBeGreaterThan(Date.now() / 1000 + 86_400);
    expect(
      await frame.evaluate(() => globalThis.document.cookie),
    ).not.toContain(key);
    await frame.getByRole('button', {name: 'Photos', exact: true}).click();
    await expect(frame.locator('[data-photo-stage] img')).toBeVisible();
    const state = await display.storageState();
    // A fresh browser context restores the persistent cookie without any admin identity.
    const restarted = await browser.newContext({
      baseURL: origin,
      ignoreHTTPSErrors: true,
      storageState: state,
    });
    try {
      const restoredFrame = await restarted.newPage();
      await restoredFrame.goto('/setup');
      await restoredFrame.evaluate((src) => {
        const image = globalThis.document.createElement('img');
        image.alt = 'Restored private image';
        image.src = src!;
        globalThis.document.body.append(image);
      }, imagePath);
      await expect(
        restoredFrame.getByAltText('Restored private image'),
      ).toHaveJSProperty('naturalWidth', 64);
      expect((await restarted.request.get('/api/photos')).status()).toBe(200);
      expect((await restarted.request.get('/api/config')).status()).toBe(403);
      expect(
        (
          await restarted.request.get('/api/photos', {
            headers: {'X-Test-IP': '203.0.113.9'},
          })
        ).status(),
      ).toBe(401);
      expect(
        (
          await restarted.request.get('/api/photos', {
            headers: {'X-Test-IP': '2001:db8:1234::9'},
          })
        ).status(),
      ).toBe(200);
      page.once('dialog', async (dialog) => dialog.accept());
      await page.getByRole('button', {name: 'Révoquer la clé'}).click();
      await expect(page.locator('[data-credential-status]')).toHaveText(
        'Clé révoquée.',
      );
      expect((await restarted.request.get('/api/photos')).status()).toBe(401);
      await frame.getByRole('button', {name: 'Suivante', exact: true}).click();
      // Force a fresh catalog read after revocation; every API call is checked.
      await frame.reload();
      await frame.getByRole('button', {name: 'Photos', exact: true}).click();
      await expect(frame.locator('[data-photo-status]')).toContainText(
        'Accès privé requis',
      );
      await expect(frame.locator('[data-photo-stage] img')).toHaveCount(0);
      await frame.goto('/setup');
      await frame
        .getByRole('button', {name: 'Déconnecter ce navigateur'})
        .click();
      await expect
        .poll(
          async () =>
            (await display.cookies()).filter(
              (cookie) => cookie.name === '__Secure-dayframe_display',
            ).length,
        )
        .toBe(0);
    } finally {
      await restarted.close();
    }
  } finally {
    await display.close();
  }
});
