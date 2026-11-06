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
test('manual paste saves metadata and a focused editor changes details without changing pixels @all-browsers', async ({
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
  await expect(page.locator('[data-choose-files]')).toBeEnabled();
  await paste(page, photo.buffer);
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  let record = (await catalog(page)).photos[0];
  expect(record.place).toEqual({label: 'Annecy', source: 'estimated'});
  expect(record.capturedAt).toBe('2024-03-01T00:05:06+02:00');
  expect(lookups).toBe(1);
  const original = await (
    await page.request.get(`/api/photos/${record.id}`)
  ).body();
  const edit = page.locator('[data-edit-photo]');
  await edit.click();
  await expect(page.locator('[data-place-input]')).toBeFocused();
  await page.locator('[data-place-input]').fill('Ne pas enregistrer');
  await page.locator('[data-editor-cancel]').click();
  await expect(edit).toBeFocused();
  await expect(page.locator('[data-card-place]')).toHaveText('Annecy');
  await edit.click();
  await page.locator('[data-place-input]').fill('Vieille ville');
  await page.locator('[data-capture-date]').fill('2024-02-29');
  await page.locator('[data-editor-save]').click();
  await expect(page.locator('[data-photo-editor]')).not.toBeVisible();
  await expect(edit).toBeFocused();
  record = (await catalog(page)).photos[0];
  expect(record.place).toEqual({label: 'Vieille ville', source: 'manual'});
  expect(record.capturedAt).toBe('2024-02-29T00:05:06+02:00');
  expect(
    await (await page.request.get(`/api/photos/${record.id}`)).body(),
  ).toEqual(original);
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
  for (const selector of ['[data-display-retry]', '[data-photo-controls]']) {
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
test('date editor supports optional time, unknown timezone, clearing and denial cleanup @mobile', async ({
  page,
}) => {
  await page.locator('[data-photo-files]').setInputFiles(await fixture(page));
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  await page.locator('[data-edit-photo]').click();
  await page.locator('[data-capture-time]').fill('14:30');
  await page.locator('[data-timezone-details] summary').click();
  await page.locator('[data-capture-offset]').fill('');
  await page.locator('[data-editor-save]').click();
  await expect(page.locator('[data-photo-editor]')).not.toBeVisible();
  expect((await catalog(page)).photos[0].capturedAt).toMatch(
    /^2024-03-01T14:30(?::00)?$/v,
  );
  await page.locator('[data-edit-photo]').click();
  await page.locator('[data-remove-time]').click();
  await page.locator('[data-editor-save]').click();
  await expect(page.locator('[data-photo-editor]')).not.toBeVisible();
  expect((await catalog(page)).photos[0].capturedAt).toBe('2024-03-01');
  await page.locator('[data-edit-photo]').click();
  await page.locator('[data-remove-date]').click();
  await page.locator('[data-editor-save]').click();
  await expect(page.locator('[data-photo-editor]')).not.toBeVisible();
  expect((await catalog(page)).photos[0].capturedAt).toBeUndefined();
  await page.locator('[data-edit-photo]').click();
  await page.route('**/api/photos/*/place', async (route) =>
    route.fulfill({status: 401, json: {error: {message: 'Accès requis'}}}),
  );
  await page.locator('[data-editor-save]').click();
  await expect(page.locator('[data-photo-editor]')).not.toBeVisible();
  await expect(page.locator('[data-editor-image]')).not.toHaveAttribute('src');
  await expect(page.locator('[data-place-input]')).toHaveValue('');
  await expect(page.locator('[data-photo-gallery] img')).toHaveCount(0);
});

test('confirmed recovery fills missing places and dates, preserves corrections and supports date-only recovery @mobile', async ({
  page,
}) => {
  const photo = await fixture(page);
  await page.locator('[data-photo-files]').setInputFiles(photo);
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
  const initial = (await catalog(page)).photos[0];
  const original = await (
    await page.request.get(`/api/photos/${initial.id}`)
  ).body();
  await page.locator('[data-edit-photo]').click();
  await page.locator('[data-place-input]').fill('');
  await page.locator('[data-remove-date]').click();
  await page.locator('[data-editor-save]').click();
  await expect(page.locator('[data-photo-editor]')).not.toBeVisible();
  let uploads = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/photos'
    ) {
      uploads++;
    }
  });
  await page.locator('[data-recovery-options] summary').click();
  await page.locator('[data-recover-locations]').click();
  await page
    .locator('[data-photo-files]')
    .setInputFiles(await fixture(page, 48.8584, 2.2945));
  await expect(page.locator('[data-recovery-dialog]')).toBeVisible();
  await expect(page.locator('[data-recovery-place]')).toContainText('Paris');
  await page
    .getByRole('button', {name: 'Compléter les informations', exact: true})
    .click();
  await expect(page.locator('[data-recovery-dialog]')).toBeVisible();
  await page.locator('[data-recovery-dialog] input[type=radio]').check();
  await page
    .getByRole('button', {name: 'Compléter les informations', exact: true})
    .click();
  await expect(page.locator('[data-upload-summary]')).toContainText(
    '1 lieu(x) retrouvé(s) · 1 date(s) retrouvée(s)',
  );
  let record = (await catalog(page)).photos[0];
  expect(record.place?.label).toBe('Paris');
  expect(record.capturedAt).toBe('2024-03-01T00:05:06+02:00');
  expect(record.uploadedAt).toBe(initial.uploadedAt);
  await page.locator('[data-edit-photo]').click();
  await page.locator('[data-place-input]').fill('Lieu corrigé');
  await page.locator('[data-capture-date]').fill('2020-01-02');
  await page.locator('[data-editor-save]').click();
  await expect(page.locator('[data-photo-editor]')).not.toBeVisible();
  await page.locator('[data-photo-files]').setInputFiles(photo);
  await expect(page.locator('[data-recovery-dialog]')).toBeVisible();
  await page.locator('[data-recovery-dialog] input[type=radio]').check();
  await page
    .getByRole('button', {name: 'Compléter les informations', exact: true})
    .click();
  await expect(page.locator('[data-upload-summary]')).toContainText(
    '1 photo(s) vérifiée(s)',
  );
  record = (await catalog(page)).photos[0];
  expect(record.place?.label).toBe('Lieu corrigé');
  expect(record.capturedAt).toBe('2020-01-02T00:05:06+02:00');
  await page.locator('[data-edit-photo]').click();
  await page.locator('[data-remove-date]').click();
  await page.locator('[data-editor-save]').click();
  await expect(page.locator('[data-photo-editor]')).not.toBeVisible();
  await page.getByText('Options', {exact: true}).click();
  await page.locator('[data-photo-location-consent]').uncheck();
  await page.locator('[data-photo-files]').setInputFiles(photo);
  await expect(page.locator('[data-recovery-dialog]')).toBeVisible();
  await page.locator('[data-recovery-dialog] input[type=radio]').check();
  await page
    .getByRole('button', {name: 'Compléter les informations', exact: true})
    .click();
  await expect(page.locator('[data-upload-summary]')).toContainText(
    '1 date(s) retrouvée(s)',
  );
  expect((await catalog(page)).photos[0].place?.label).toBe('Lieu corrigé');
  expect((await catalog(page)).photos[0].capturedAt).toBe(
    '2024-03-01T00:05:06+02:00',
  );
  expect(uploads).toBe(0);
  expect(
    await (await page.request.get(`/api/photos/${initial.id}`)).body(),
  ).toEqual(original);
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
  await expect(page.locator('[data-progress-label]')).toContainText(
    'Recherche du lieu',
  );
  await expect(page.locator('[data-edit-photo]')).toBeDisabled();
  await expect(page.locator('[data-refresh]')).toBeDisabled();
  await page.locator('[data-import-clear]').click();
  await expect(page.locator('[data-edit-photo]')).toBeEnabled();
  lookup.resolve();
  await expect(page.locator('[data-import-current]')).not.toHaveAttribute(
    'src',
  );
  await expect(page.locator('[data-storage]')).toContainText('1 photo');
});
