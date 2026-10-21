import {Buffer} from 'node:buffer';
import {type Page} from '@playwright/test';
import {expect, test} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

const origin = 'https://127.0.0.1:8789';
test.use({baseURL: origin, ignoreHTTPSErrors: true});

// eslint-disable-next-line max-params -- Named fixture inputs keep the test matrix compact.
async function syntheticPhoto(
  page: Page,
  name = 'souvenir.png',
  width = 2400,
  height = 1200,
  variation = 0,
) {
  const base64 = await page.evaluate(
    ({width: imageWidth, height: imageHeight, variation: imageVariation}) => {
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = imageWidth;
      canvas.height = imageHeight;
      const ctx = canvas.getContext('2d')!;
      const sky = ctx.createLinearGradient(0, 0, 0, imageHeight);
      sky.addColorStop(0, '#b2d8d5');
      sky.addColorStop(1, '#f8dfab');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, imageWidth, imageHeight);
      ctx.fillStyle = '#e8a963';
      ctx.beginPath();
      ctx.arc(
        imageWidth * 0.75,
        imageHeight * 0.25,
        imageHeight * 0.1,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.fillStyle = '#537f78';
      ctx.beginPath();
      ctx.moveTo(0, imageHeight * 0.8);
      ctx.lineTo(imageWidth * 0.35, imageHeight * 0.2);
      ctx.lineTo(imageWidth * 0.7, imageHeight);
      ctx.fill();
      ctx.fillStyle = '#244f50';
      ctx.beginPath();
      ctx.moveTo(imageWidth * 0.3, imageHeight);
      ctx.lineTo(imageWidth * 0.8, imageHeight * 0.4);
      ctx.lineTo(imageWidth, imageHeight * 0.8);
      ctx.lineTo(imageWidth, imageHeight);
      ctx.fill();
      if (imageVariation > 0) {
        ctx.fillStyle = '#edb97d';
        ctx.fillRect(5, 5, imageVariation, imageVariation);
      }

      return canvas.toDataURL('image/png').split(',', 2)[1];
    },
    {width, height, variation},
  );
  return {name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64')};
}

async function login(page: Page, admin = 'one') {
  await page.request.get(`/__test/login?admin=${admin}`);
  await page.goto('/admin/photos');
  await expect(
    page.getByRole('button', {name: 'Ajouter des photos'}),
  ).toBeEnabled();
}

test.beforeEach(async ({page}) => {
  await page.clock.install({time: fixtureNow});
  await page.request.get('/__test/reset');
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
});

test('two admins upload WebP, review duplicates, see protected thumbnails and confirm deletion', async ({
  page,
}, info) => {
  await login(page);
  const photo = await syntheticPhoto(page);
  await page.locator('[data-photo-files]').setInputFiles(photo);
  await expect(page.locator('[data-upload-results]')).toContainText(
    'ajouté (1600 × 800)',
  );
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  const thumbnail = page.locator('[data-photo-gallery] img');
  await expect(thumbnail).toBeVisible();
  await expect(thumbnail).toHaveJSProperty('naturalWidth', 1600);
  const url = await thumbnail.getAttribute('src');
  const imageResponse = await page.request.get(url!);
  expect(imageResponse.headers()['content-type']).toBe('image/webp');
  expect(imageResponse.headers()['cache-control']).toBe('private, no-store');
  const anonymous = await page.request.get(url!, {headers: {Cookie: ''}});
  expect(anonymous.status()).toBe(401);
  await page.locator('[data-photo-files]').setInputFiles(photo);
  await expect(page.locator('[data-upload-results]')).toContainText(
    'doublon exact',
  );
  const similar = await syntheticPhoto(page, 'autre.png', 2400, 1200, 10);
  await page.locator('[data-photo-files]').setInputFiles(similar);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', {name: 'Garder cette photo'}).click();
  await expect(page.locator('[data-storage]')).toContainText('2 photos');
  expect(
    await page.evaluate(
      () =>
        globalThis.document.documentElement.scrollWidth <=
        globalThis.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath(`admin-${info.project.name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
  await login(page, 'two');
  await expect(page.locator('[data-photo-gallery] article')).toHaveCount(2);
  page.once('dialog', async (dialog) => dialog.dismiss());
  await page
    .getByRole('button', {name: 'Supprimer', exact: true})
    .first()
    .click();
  await expect(page.locator('[data-photo-gallery] article')).toHaveCount(2);
  page.once('dialog', async (dialog) => dialog.accept());
  await page
    .getByRole('button', {name: 'Supprimer', exact: true})
    .first()
    .click();
  await expect(page.locator('[data-photo-gallery] article')).toHaveCount(1);
});

test('photo framing survives navigation, reload and settings refreshes', async ({
  page,
}) => {
  await login(page);
  let settings = {...defaultSettings, fit: 'contain' as const};
  await page.route('**/api/config/display', async (route) => {
    await route.fulfill({json: settings});
  });
  await page.goto('/');
  const fit = page.getByLabel('Cadrage des photos');
  const stage = page.locator('[data-photo-stage]');
  await expect(stage).toHaveAttribute('data-fit', 'contain');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await fit.selectOption('cover');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(fit).toHaveValue('cover');
  await page.goto('/admin/photos');
  await page.goto('/');
  await expect(stage).toHaveAttribute('data-fit', 'cover');
  await page.reload();
  await expect(stage).toHaveAttribute('data-fit', 'cover');
  settings = {...settings, location: 'Réglages actualisés'};
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-location]')).toHaveText(
    'Météo · Réglages actualisés',
  );
  await expect(stage).toHaveAttribute('data-fit', 'cover');
  await expect(fit).toHaveValue('cover');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await fit.selectOption('contain');
  await page.reload();
  await expect(stage).toHaveAttribute('data-fit', 'contain');
});

test('read-only cookie delivers images, slideshow refreshes, outages retain current photo and leaving clears blobs', async ({
  page,
  context,
}, info) => {
  await login(page);
  await page
    .locator('[data-photo-files]')
    .setInputFiles(await syntheticPhoto(page));
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  await context.clearCookies();
  const session = await page.request.get('/__test/display');
  expect(session.headers()['set-cookie']).toContain(
    'HttpOnly; Secure; SameSite=Strict',
  );
  const cookies = await context.cookies(`${origin}/api/photos`);
  expect(
    cookies.some(
      (cookie) =>
        cookie.name === '__Secure-dayframe_display' &&
        cookie.httpOnly &&
        cookie.secure,
    ),
  ).toBe(true);
  const denied = await page.request.post('/api/photos', {
    headers: {Origin: origin, 'X-Dayframe-Request': '1'},
  });
  expect(denied.status()).toBe(403);
  await page.goto('/');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  const image = page.locator('[data-photo-stage] img');
  await expect(image).toBeVisible();
  await expect(image).toHaveCSS('object-fit', 'cover');
  await page.getByLabel('Cadrage des photos').selectOption('contain');
  await expect(image).toHaveCSS('object-fit', 'contain');
  await page.screenshot({
    path: info.outputPath(`slideshow-${info.project.name}.png`),
    animations: 'disabled',
  });
  const original = await image.getAttribute('src');
  await context.setOffline(true);
  await page.getByRole('button', {name: 'Suivante', exact: true}).click();
  await expect(image).toHaveAttribute('src', original!);
  await context.setOffline(false);
  // Denial during a settings refresh must clear already painted private pixels.
  await context.clearCookies();
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(image).toHaveCount(0);
  await expect(page.locator('[data-photo-status]')).toContainText(
    'Accès privé requis',
  );
  await page.request.get('/__test/display');
  await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
  await page.getByRole('button', {name: 'Réessayer la connexion'}).click();
  await expect(image).toBeVisible();
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(image).toHaveCount(0);
  await context.clearCookies();
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-status]')).toContainText(
    'Accès privé requis',
  );
  await expect(image).toHaveCount(0);
});

test('photo access failures keep retry available when configuration and weather succeed', async ({
  page,
  context,
}) => {
  await login(page);
  await page
    .locator('[data-photo-files]')
    .setInputFiles(await syntheticPhoto(page));
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  await context.clearCookies();
  await page.request.get('/__test/display');
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
  await page.route('**/api/photos', async (route) =>
    route.fulfill({
      status: 401,
      json: {error: {message: 'Synthetic photo access failure'}},
    }),
  );
  await page.goto('/');
  await expect(page.locator('[data-temperature]')).toHaveText('12°');
  const retry = page.getByRole('button', {name: 'Réessayer la connexion'});
  await expect(retry).toBeHidden();
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-status]')).toContainText(
    'Accès privé requis',
  );
  await expect(retry).toBeVisible();
  const navigation = page.getByRole('navigation', {name: 'Modes d’affichage'});
  const before = await navigation.boundingBox();
  // Keep configuration healthy during recovery; it must not hide photo errors.
  await page.unroute('**/api/photos');
  await retry.click();
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await expect(retry).toBeHidden();
  const after = await navigation.boundingBox();
  expect(after!.x).toBeCloseTo(before!.x, 1);
  expect(after!.y).toBeCloseTo(before!.y, 1);
});

test('unsupported formats report per-file errors and preserve a safe retry', async ({
  page,
}) => {
  await login(page);
  await page.locator('[data-photo-files]').setInputFiles({
    name: 'non-lisible.heic',
    mimeType: 'image/heic',
    buffer: Buffer.from('synthetic unsupported input'),
  });
  await expect(page.locator('[data-upload-results]')).toContainText(
    'exportez la photo en JPEG',
  );
  await expect(
    page.getByRole('button', {name: 'Réessayer', exact: true}),
  ).toBeVisible();
  await expect(page.locator('[data-storage]')).toContainText('0 photos');
});

test('orientation is applied without upscaling and metadata is removed', async ({
  page,
}) => {
  await login(page);
  const original = await page.evaluate(() => {
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = 80;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 40, 40);
    ctx.fillStyle = 'blue';
    ctx.fillRect(40, 0, 40, 40);
    return canvas.toDataURL('image/jpeg').split(',', 2)[1];
  });
  const jpeg = Buffer.from(original, 'base64');
  const exif = Buffer.alloc(36);
  exif.writeUInt16BE(0xff_e1, 0);
  exif.writeUInt16BE(34, 2);
  exif.write('Exif\0\0', 4);
  exif.write('II', 10);
  exif.writeUInt16LE(42, 12);
  exif.writeUInt32LE(8, 14);
  exif.writeUInt16LE(1, 18);
  exif.writeUInt16LE(0x1_12, 20);
  exif.writeUInt16LE(3, 22);
  exif.writeUInt32LE(1, 24);
  exif.writeUInt16LE(6, 28);
  await page.locator('[data-photo-files]').setInputFiles({
    name: 'orientation-6.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)]),
  });
  await expect(page.locator('[data-upload-results]')).toContainText(
    'ajouté (40 × 80)',
  );
  const url = await page
    .locator('[data-photo-gallery] img')
    .getAttribute('src');
  const response = await page.request.get(url!);
  const bytes = await response.body();
  expect(bytes.toString('ascii')).not.toMatch(/EXIF|XMP |ICCP/v);
  await expect(page.locator('[data-photo-gallery] img')).toHaveJSProperty(
    'naturalWidth',
    40,
  );
  await expect(page.locator('[data-photo-gallery] img')).toHaveJSProperty(
    'naturalHeight',
    80,
  );
  const pixels = await page
    .locator('[data-photo-gallery] img')
    .evaluate((image: HTMLImageElement) => {
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 80;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(image, 0, 0);
      return {
        top: [...ctx.getImageData(20, 10, 1, 1).data],
        bottom: [...ctx.getImageData(20, 70, 1, 1).data],
      };
    });
  expect(pixels.top[0]).toBeGreaterThan(200);
  expect(pixels.bottom[2]).toBeGreaterThan(200);
});

test('failed uploads retry with the same identity and expired sessions clear private previews', async ({
  page,
}) => {
  await login(page);
  let attempts = 0;
  const identities: string[] = [];
  await page.route('**/api/photos', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    identities.push(route.request().headers()['x-photo-sha256']);
    attempts++;
    if (attempts === 1) {
      await route.fulfill({
        status: 503,
        json: {error: {message: 'Quota temporairement atteint.'}},
      });
    } else {
      await route.continue();
    }
  });
  await page
    .locator('[data-photo-files]')
    .setInputFiles(await syntheticPhoto(page));
  await expect(page.locator('[data-upload-results]')).toContainText(
    'Quota temporairement atteint',
  );
  await page.getByRole('button', {name: 'Réessayer', exact: true}).click();
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  expect(identities).toHaveLength(2);
  expect(identities[0]).toBe(identities[1]);
  await page.context().clearCookies();
  await page.getByRole('button', {name: 'Actualiser', exact: true}).click();
  await expect(page.locator('[data-photo-gallery] img')).toHaveCount(0);
  await expect(
    page.getByRole('button', {name: 'Ajouter des photos'}),
  ).toBeDisabled();
});

test('slideshow polls for additions and keeps at most two image URLs', async ({
  page,
  browser,
}) => {
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({
      json: {...defaultSettings, overrideTimeoutSeconds: 3600},
    }),
  );
  await login(page);
  await page
    .locator('[data-photo-files]')
    .setInputFiles(await syntheticPhoto(page));
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  await page.addInitScript(() => {
    const urls = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.add(url);
      globalThis.document.documentElement.dataset.privateUrls = String(
        urls.size,
      );
      return url;
    };

    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      globalThis.document.documentElement.dataset.privateUrls = String(
        urls.size,
      );
      revoke(url);
    };
  });
  await page.goto('/');

  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  const first = await page
    .locator('[data-photo-stage] img')
    .getAttribute('src');
  const adminContext = await browser.newContext({
    baseURL: origin,
    ignoreHTTPSErrors: true,
  });
  try {
    const adminPage = await adminContext.newPage();
    await login(adminPage, 'two');
    await adminPage
      .locator('[data-photo-files]')
      .setInputFiles(
        await syntheticPhoto(adminPage, 'nouveau.png', 2400, 1200, 10),
      );
    await expect(adminPage.getByRole('dialog')).toBeVisible();
    await adminPage.getByRole('button', {name: 'Garder cette photo'}).click();
    await expect(adminPage.locator('[data-storage]')).toContainText('2 photos');
    const refreshed = page.waitForResponse(
      (response) => response.url() === `${origin}/api/photos`,
    );
    await page.clock.fastForward(320_000);
    await refreshed;
    await expect(page.locator('html')).toHaveAttribute(
      'data-private-urls',
      '2',
    );
    await page.locator('[data-dashboard]').dispatchEvent('pointerdown');
    await page.getByRole('button', {name: 'Suivante', exact: true}).click();
    await expect(page.locator('[data-photo-stage] img')).not.toHaveAttribute(
      'src',
      first!,
    );
    expect(
      Number(await page.locator('html').getAttribute('data-private-urls')),
    ).toBeLessThanOrEqual(2);
    await page.getByRole('button', {name: 'Matin', exact: true}).click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-private-urls',
      '0',
    );
  } finally {
    await adminContext.close();
  }
});

test('expired upload sessions retain the whole selected batch for recovery in the same tab', async ({
  page,
}) => {
  await login(page);
  const files = [
    await syntheticPhoto(page, 'premier.png'),
    await syntheticPhoto(page, 'suivant.png', 2400, 1200, 10),
  ];
  let attempts = 0;
  const ids: string[] = [];
  await page.route('**/api/photos', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }

    ids.push(route.request().headers()['x-photo-sha256']);
    if (attempts++ === 0) {
      await page.context().clearCookies();
      await route.fulfill({
        status: 401,
        json: {
          error: {message: 'Session expirée. Reconnectez-vous puis réessayez.'},
        },
      });
    } else {
      await route.continue();
    }
  });
  await page.locator('[data-photo-files]').setInputFiles(files);
  await expect(page.locator('[data-upload-results]')).toContainText(
    'Session expirée',
  );
  await expect(page.locator('[data-upload-results]')).toContainText(
    'suivant.png · en attente',
  );
  await expect(
    page.getByRole('button', {name: 'Réessayer', exact: true}),
  ).toHaveCount(2);
  await page.request.get('/__test/login?admin=two');
  await page
    .getByRole('button', {name: 'Réessayer', exact: true})
    .first()
    .click();
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  expect(ids[0]).toBe(ids[1]);
  await page.getByRole('button', {name: 'Réessayer', exact: true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', {name: 'Garder cette photo'}).click();
  await expect(page.locator('[data-storage]')).toContainText('2 photos');
});

test('private slideshow pixels expire after five offline minutes', async ({
  page,
  context,
}) => {
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({
      json: {...defaultSettings, overrideTimeoutSeconds: 3600},
    }),
  );
  await login(page);
  await page
    .locator('[data-photo-files]')
    .setInputFiles(await syntheticPhoto(page));
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  await context.clearCookies();
  await page.request.get('/__test/display');
  await page.goto('/');

  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await context.setOffline(true);
  // A wall-clock correction must not extend private-pixel retention.
  await page.clock.setSystemTime(fixtureNow - 3_600_000);
  await page.clock.fastForward(301_000);
  await expect(page.locator('[data-photo-stage] img')).toHaveCount(0);
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'photos',
  );
  await context.setOffline(false);
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) =>
        /photo|catalog|override/v.test(key),
      ),
    ),
  ).toBe(false);
  expect(await page.evaluate(async () => globalThis.caches.keys())).toEqual([]);
  expect(
    await page.evaluate(async () => {
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length;
    }),
  ).toBe(0);
});
