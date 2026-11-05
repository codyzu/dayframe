/* eslint-disable unicorn/no-await-expression-member -- Inline response checks keep the browser flow readable. */
import {Buffer} from 'node:buffer';
import {type Page} from '@playwright/test';
import {expect, test, photoOrigin as origin} from '../fixtures/browser.ts';
import {gpsPng} from '../fixtures/photo-gps.ts';
import {type PhotoMetadata} from '../../src/lib/photos/contracts.ts';
import {weatherFixture} from '../fixtures/weather.ts';

test.use({baseURL: origin, ignoreHTTPSErrors: true});
async function fixture(page: Page, latitude = 45.8992, longitude = 6.1294) {
  const data = await page.evaluate(() => {
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#377e9c';
    context.fillRect(0, 0, 320, 240);
    context.fillStyle = '#f9dd71';
    context.fillRect(10, 10, 90, 90);
    return canvas.toDataURL('image/png').split(',', 2)[1];
  });
  return {
    name: 'synthetic-gps.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      gpsPng(
        Buffer.from(data, 'base64'),
        latitude,
        longitude,
        '2024:03:01 00:05:06',
      ),
    ),
  };
}

async function paste(page: Page, bytes: Uint8Array) {
  await page.locator('[data-import-zone]').evaluate(
    (zone, data) => {
      const file = new File([new Uint8Array(data)], 'synthetic.png', {
        type: 'image/png',
      });
      const event = new Event('paste', {cancelable: true});
      Object.defineProperty(event, 'clipboardData', {value: {files: [file]}});
      zone.dispatchEvent(event);
    },
    [...bytes],
  );
}

async function catalog(page: Page) {
  const response = await page.request.get('/api/photos');
  return (await response.json()) as {photos: PhotoMetadata[]};
}

test.beforeEach(async ({page}) => {
  await page.request.get('/__test/reset');
  await page.request.get('/__test/login?admin=one');
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await page.route('https://photon.komoot.io/reverse?**', async (route) =>
    route.fulfill({
      json: {
        features: [
          {
            properties: {
              name: route.request().url().includes('lat=48')
                ? 'Paris'
                : 'Annecy',
              osm_key: 'place',
              osm_value: 'town',
            },
          },
        ],
      },
    }),
  );
  await page.goto('/admin/photos');
  await expect(page.locator('[data-choose-files]')).toBeEnabled();
});
test('manual paste automatically saves its place; optional review and later editing change labels without changing pixels @all-browsers', async ({
  page,
}) => {
  const photo = await fixture(page);
  let lookups = 0;
  page.on('request', (request) => {
    if (request.url().startsWith('https://photon.komoot.io/reverse')) {
      lookups++;
    }
  });
  await page.goto('/admin/photos?import=clipboard&expected=1');
  await expect(page.locator('[data-import-zone]')).toBeVisible();
  await paste(page, photo.buffer);
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  let record = (await catalog(page)).photos[0];
  expect(record.place).toEqual({label: 'Annecy', source: 'estimated'});
  expect(record.capturedAt).toBe('2024-03-01T00:05:06+02:00');
  expect(lookups).toBe(1);
  const original = await (
    await page.request.get(`/api/photos/${record.id}`)
  ).body();
  await page.locator('[data-import-review]').check();
  await page.locator('[data-photo-files]').setInputFiles(photo);
  await expect(
    page.getByLabel('Lieu de la photo 1', {exact: true}),
  ).toHaveValue('Annecy');
  await expect(
    page.getByLabel('Date de prise de vue de la photo 1'),
  ).toHaveValue('2024-03-01');
  expect(lookups).toBe(1);
  await page
    .getByLabel('Lieu de la photo 1', {exact: true})
    .fill('Lac d’Annecy');
  await page.locator('[data-import-add]').click();
  await expect(page.locator('[data-upload-summary]')).toContainText(
    'déjà présente',
  );
  await expect(page.locator('[data-place-input]')).toHaveValue('Lac d’Annecy');
  await page.locator('[data-place-input]').fill('Vieille ville');
  await page.getByRole('button', {name: 'Enregistrer le lieu'}).click();
  await expect(page.locator('[data-admin-status]')).toHaveText(
    'Lieu enregistré.',
  );
  record = (await catalog(page)).photos[0];
  expect(record.place).toEqual({label: 'Vieille ville', source: 'manual'});
  expect(
    await (await page.request.get(`/api/photos/${record.id}`)).body(),
  ).toEqual(original);
  await page.locator('[data-capture-date]').fill('2024-02-29');
  await page.getByRole('button', {name: 'Enregistrer le lieu'}).click();
  await expect(page.locator('[data-admin-status]')).toHaveText(
    'Date enregistrée.',
  );
  expect((await catalog(page)).photos[0].capturedAt).toBe(
    '2024-02-29T00:05:06+02:00',
  );
  await page.goto('/');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await expect(page.locator('[data-photo-caption]')).toBeHidden();
  await page
    .getByRole('button', {name: 'Afficher le lieu', exact: true})
    .click();
  await expect(page.locator('[data-photo-place]')).toHaveText('Vieille ville');
  await expect(page.locator('[data-photo-date]')).toHaveText('février 2024');
  const caption = (await page.locator('[data-photo-caption]').boundingBox())!;
  for (const selector of [
    '[data-display-retry]',
    '[data-touch-hint]',
    '[data-photo-controls]',
  ]) {
    const control = await page.locator(selector).boundingBox();
    if (control) {
      expect(
        caption.x + caption.width <= control.x ||
          control.x + control.width <= caption.x ||
          caption.y + caption.height <= control.y ||
          control.y + control.height <= caption.y,
      ).toBe(true);
    }
  }

  const stored = await page.evaluate(
    async () =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = globalThis.indexedDB.open('dayframe.offline-photos.v1');
        open.addEventListener('error', () => {
          reject(new Error('DB open failed'));
        });

        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('photos')) {
            db.close();
            resolve([]);
            return;
          }

          const tx = db.transaction('photos');
          const read = tx.objectStore('photos').getAll();
          read.onsuccess = () => {
            resolve(read.result as unknown[]);
          };

          tx.oncomplete = () => {
            db.close();
          };
        };
      }),
  );
  expect(stored).toHaveLength(1);
  expect(JSON.stringify(stored)).not.toContain('Vieille ville');
  expect(JSON.stringify(stored)).not.toContain('2024-02-29');
  await page.route('**/api/photos?*', async (route) =>
    route.fulfill({status: 401, json: {error: {message: 'Accès requis'}}}),
  );
  await page.route('**/api/photos', async (route) =>
    route.fulfill({status: 401, json: {error: {message: 'Accès requis'}}}),
  );
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-photo-place]')).toBeHidden();
});
test('optional import review can override the extracted capture date @mobile', async ({
  page,
}) => {
  await page.locator('[data-import-review]').check();
  await page.locator('[data-photo-files]').setInputFiles(await fixture(page));
  const input = page.getByLabel('Date de prise de vue de la photo 1');
  await expect(input).toHaveValue('2024-03-01');
  await input.fill('2024-03-02');
  await page.locator('[data-import-add]').click();
  await expect(page.locator('[data-capture-date]')).toHaveValue('2024-03-02');
  expect((await catalog(page)).photos[0].capturedAt).toBe(
    '2024-03-02T00:05:06+02:00',
  );
});

test('recovery requires a chosen matching photo and updates its place without uploading another image @mobile-only', async ({
  page,
}) => {
  const photo = await fixture(page);
  await page.locator('[data-photo-files]').setInputFiles(photo);
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  let uploads = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/photos'
    ) {
      uploads++;
    }
  });
  await page.locator('[data-recover-locations]').check();
  await page
    .locator('[data-photo-files]')
    .setInputFiles(await fixture(page, 48.8584, 2.2945));
  await expect(
    page.getByLabel('Lieu de la photo 1', {exact: true}),
  ).toHaveValue('Paris');
  await page.locator('[data-import-add]').click();
  await expect(page.locator('[data-recovery-dialog]')).toBeVisible();
  await page.locator('[data-recovery-dialog] input[type=radio]').check();
  await page
    .getByRole('button', {name: 'Confirmer le lieu', exact: true})
    .click();
  await expect(page.locator('[data-upload-summary]')).toContainText(
    '1 lieu(x) retrouvé(s)',
  );
  expect(uploads).toBe(0);
  const records = (await catalog(page)).photos;
  expect(records).toHaveLength(1);
  expect(records[0].place?.label).toBe('Paris');
});
test('failed geocoding does not block automatic upload; pending lookup can be cancelled @mobile', async ({
  page,
}) => {
  await page.route('https://photon.komoot.io/**', async (route) =>
    route.fulfill({status: 503, body: ''}),
  );
  await page.locator('[data-photo-files]').setInputFiles(await fixture(page));
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  expect((await catalog(page)).photos[0].place).toBeUndefined();
  const lookup = Promise.withResolvers<void>();
  await page.route('https://photon.komoot.io/**', async (route) => {
    await lookup.promise;
    await route.fulfill({json: {features: []}}).catch(() => undefined);
  });
  await page
    .locator('[data-photo-files]')
    .setInputFiles(await fixture(page, 47, 3));
  await expect(page.locator('[data-import-previews]')).toContainText(
    'Recherche du lieu',
  );
  await page.locator('[data-import-clear]').click();
  lookup.resolve();
  await expect(page.locator('[data-import-previews]')).toBeEmpty();
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
});
