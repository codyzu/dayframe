import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import ts from 'typescript';
import {type Page} from '@playwright/test';
import type * as StoreModule from '../../src/lib/photos/offline.ts';
import {test, expect} from '../fixtures/browser.ts';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import {fixtureNow, weatherFixture} from '../fixtures/weather.ts';

type Store = typeof StoreModule;
const storePath = '/__test/offline.js';
const webpBytes = [
  ...Buffer.from(
    'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    'base64',
  ),
];
const ids = ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];

// Compile the real shared module into a test-only route, never a production hook.
async function routeStore(page: Page) {
  for (const name of ['offline', 'contracts']) {
    const source = await readFile(`src/lib/photos/${name}.ts`, 'utf8');
    const code = ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace('./contracts.ts', '/__test/contracts.js');
    await page.route(`**/__test/${name}.js`, async (route) =>
      route.fulfill({contentType: 'text/javascript', body: code}),
    );
  }
}

async function storedCount(page: Page) {
  return page.evaluate(async (path) => {
    const store = (await import(path)) as Store;
    const photos = await store.savedPhotos();
    return photos.length;
  }, storePath);
}

async function seed(page: Page, photoCount = 3) {
  return page.evaluate(
    async ({path, count, bytes}) => {
      const store = (await import(path)) as Store;
      await store.enableOfflinePhotos();
      const {token} = store.offlineControl()!;
      await store.renewOfflineLease(token, {fit: 'contain', interval: 20});
      const blob = new Blob([new Uint8Array(bytes)], {type: 'image/webp'});
      for (let index = 0; index < count; index++) {
        const id = index.toString(16).padStart(64, '0');
        await store.savePhoto(
          {
            id,
            width: 20,
            height: 20,
            size: blob.size,
            contentType: 'image/webp',
          },
          blob,
          token,
        );
      }

      return token;
    },
    {path: storePath, count: photoCount, bytes: webpBytes},
  );
}

test.beforeEach(async ({page}) => {
  await routeStore(page);
  await page.clock.install({time: fixtureNow});
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
});

test('explicit frame opt-in, gradual saving, offline rotation and mode return retain only two URLs', async ({
  page,
}, info) => {
  await page.goto('/calendar-privacy');
  const body = Buffer.from(
    'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    'base64',
  );
  let isOffline = false;
  await page.route('**/api/photos**', async (route) => {
    if (isOffline) {
      await route.abort();
      return;
    }

    if (new URL(route.request().url()).pathname === '/api/photos') {
      await route.fulfill({
        json: {
          photos: ids.map((id) => ({
            id,
            width: 20,
            height: 20,
            size: body.length,
            contentType: 'image/webp',
          })),
          cursor: null,
        },
      });
    } else {
      await route.fulfill({contentType: 'image/webp', body});
    }
  });
  await page.addInitScript(() => {
    const urls = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.add(url);
      globalThis.document.documentElement.dataset.urls = String(urls.size);
      return url;
    };

    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      globalThis.document.documentElement.dataset.urls = String(urls.size);
      revoke(url);
    };
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-offline-controls]')).toBeHidden();
  expect(await storedCount(page)).toBe(0);
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await page.getByText('Photos hors connexion', {exact: true}).click();
  await page.locator('[data-photo-offline]').check();
  await expect(page.locator('[data-photo-offline-status]')).toContainText(
    /Stockage|Copies locales|Synchronisation/v,
  );
  for (let index = 0; index < 5; index++) {
    await page.clock.runFor(20_000);
    await expect(page.locator('[data-photo-stage] img')).toHaveCount(1);
  }

  await expect.poll(async () => storedCount(page)).toBe(3);
  isOffline = true;
  await page.route('**/api/config/display', async (route) => route.abort());
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect(page.locator('[data-photo-status]')).toContainText(
    'Hors connexion',
  );
  const first = await page
    .locator('[data-photo-stage] img')
    .getAttribute('src');
  await page.clock.runFor(20_000);
  await expect(page.locator('[data-photo-stage] img')).not.toHaveAttribute(
    'src',
    first!,
  );
  await page.keyboard.press('Tab');
  await page.getByRole('button', {name: 'Matin', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toHaveCount(0);
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-urls', '2');
  await page.screenshot({path: info.outputPath('offline-photos.png')});
  await page.keyboard.press('Tab');
  await page.locator('[data-photo-offline]').uncheck();
  await expect(page.locator('[data-photo-stage] img')).toHaveCount(0);
  expect(await storedCount(page)).toBe(0);
});

test('shared store bounds encoded count/bytes, projects metadata and fences stale writes', async ({
  page,
}) => {
  await page.goto('/calendar-privacy');
  const oldToken = await seed(page, 105);
  expect(await storedCount(page)).toBe(100);
  const result = await page.evaluate(
    async ({path, oldToken: previousToken}) => {
      const store = (await import(path)) as Store;
      const [photo] = await store.savedPhotos();
      const blob = (await store.savedPhoto(photo.id))!;
      store.invalidateOfflinePhotos();
      await store.savePhoto(photo, blob, previousToken);
      return {
        keys: Object.keys(photo).toSorted(),
        count: await store.savedPhotos().then((photos) => photos.length),
      };
    },
    {path: storePath, oldToken},
  );
  expect(result).toEqual({
    keys: ['contentType', 'height', 'id', 'size', 'width'],
    count: 0,
  });
  await seed(page, 1);
  const total = await page.evaluate(async (path) => {
    const store = (await import(path)) as Store;
    const blob = new Blob([new Uint8Array(2_000_000)], {type: 'image/webp'});
    for (let index = 0; index < 55; index++) {
      await store.savePhoto(
        {
          id: (index + 500).toString(16).padStart(64, '0'),
          width: 20,
          height: 20,
          size: blob.size,
          contentType: 'image/webp',
        },
        blob,
        store.offlineControl()!.token,
      );
    }

    const photos = await store.savedPhotos();
    return photos.reduce((sum, photo) => sum + photo.size, 0);
  }, storePath);
  expect(total).toBeLessThanOrEqual(100_000_000);
});

test('lease rejects expiry and backward clocks across page restarts', async ({
  page,
}) => {
  await page.goto('/calendar-privacy');
  await seed(page);
  await page.clock.setSystemTime(
    new Date(fixtureNow + 7 * 86_400_000 + 60_000),
  );
  expect(await storedCount(page)).toBe(0);
  await page.clock.setSystemTime(fixtureNow);
  await seed(page);
  await page.reload();
  await page.clock.setSystemTime(new Date(fixtureNow - 60_000));
  expect(await storedCount(page)).toBe(0);
});

test('atomic interruption/quota preserve entries, unavailable storage fails closed and eviction is empty', async ({
  page,
}) => {
  await page.goto('/calendar-privacy');
  await seed(page);
  const result = await page.evaluate(async (path) => {
    const store = (await import(path)) as Store;
    const [photo] = await store.savedPhotos();
    const blob = (await store.savedPhoto(photo.id))!;
    const {IDBObjectStore, indexedDB} = globalThis;
    const {put} = IDBObjectStore.prototype;
    IDBObjectStore.prototype.put = function (...args) {
      if (this.name === 'blobs') {
        this.transaction.abort();
        throw new DOMException('Quota', 'QuotaExceededError');
      }

      return put.apply(this, args);
    };

    let hasFailed = false;
    try {
      await store.savePhoto(
        {...photo, id: 'f'.repeat(64)},
        blob,
        store.offlineControl()!.token,
      );
    } catch {
      hasFailed = true;
    }

    IDBObjectStore.prototype.put = put;
    const count = await store.savedPhotos().then((photos) => photos.length);
    const open = indexedDB.open.bind(indexedDB);
    globalThis.indexedDB.open = () => {
      throw new Error('Disabled');
    };

    let isUnavailable = false;
    try {
      await store.savedPhotos();
    } catch {
      isUnavailable = true;
    }

    globalThis.indexedDB.open = open;
    await new Promise<void>((resolve, reject) => {
      const request = globalThis.indexedDB.deleteDatabase(
        'dayframe.offline-photos.v1',
      );
      request.onsuccess = () => {
        resolve();
      };

      request.addEventListener('error', () => {
        reject(new Error('delete'));
      });
    });
    return {
      hasFailed,
      count,
      isUnavailable,
      evicted: await store.savedPhotos().then((photos) => photos.length),
    };
  }, storePath);
  expect(result).toEqual({
    hasFailed: true,
    count: 3,
    isUnavailable: true,
    evicted: 0,
  });
});

async function routeSeededCatalog(page: Page) {
  await routeStore(page);
  await page.route('https://api.open-meteo.com/**', async (route) =>
    route.fulfill({json: weatherFixture()}),
  );
  await page.route('**/api/config/display', async (route) =>
    route.fulfill({json: defaultSettings}),
  );
  await page.route('**/api/photos**', async (route) =>
    route.fulfill({
      json: {
        photos: Array.from({length: 3}, (_, index) => ({
          id: index.toString(16).padStart(64, '0'),
          width: 20,
          height: 20,
          size: 42,
          contentType: 'image/webp',
        })),
        cursor: null,
      },
    }),
  );
}

for (const action of ['401', '403', 'logout', 'reprovision'] as const) {
  test(`${action} clears saved and decoded photos across open tabs, even when logout is offline`, async ({
    page,
    context,
  }) => {
    await page.goto('/calendar-privacy');
    await seed(page);
    await routeSeededCatalog(page);
    await page.goto('/?display=frame');
    await page.getByRole('button', {name: 'Photos', exact: true}).click();
    await expect(page.locator('[data-photo-stage] img')).toBeVisible();
    const other = await context.newPage();
    await routeSeededCatalog(other);
    await other.goto('/?display=frame');
    await other.getByRole('button', {name: 'Photos', exact: true}).click();
    await expect(other.locator('[data-photo-stage] img')).toBeVisible();
    // Keep the first tab from legitimately reauthorizing after the invalidation.
    await page.route('**/api/photos**', async (route) => route.abort());
    if (action === '401' || action === '403') {
      await other.route('**/api/photos**', async (route) =>
        route.fulfill({
          status: Number(action),
          json: {error: {message: 'Denied'}},
        }),
      );
      await other.evaluate(() => globalThis.dispatchEvent(new Event('online')));
    } else {
      await other.goto('/setup');
      await other.route('**/api/session**', async (route) => route.abort());
      if (action === 'logout') {
        await other
          .getByRole('button', {name: 'Déconnecter ce navigateur'})
          .click();
      } else {
        await other.getByLabel('Clé du cadre').fill('a'.repeat(64));
        await other
          .getByRole('button', {name: 'Connecter', exact: true})
          .click();
      }
    }

    await expect(page.locator('[data-photo-stage] img')).toHaveCount(0);
    await expect(page.locator('[data-photo-offline]')).not.toBeChecked();
    await expect.poll(async () => storedCount(page)).toBe(0);
    await other.close();
  });
}

test('partial paginated catalog preserves copies; only a complete refresh removes absent IDs', async ({
  page,
}) => {
  await page.goto('/calendar-privacy');
  await seed(page);
  let isComplete = false;
  await page.route('**/api/photos**', async (route) => {
    if (new URL(route.request().url()).searchParams.has('cursor')) {
      await route.abort();
      return;
    }

    await route.fulfill({
      json: {
        photos: [
          {
            id: '0'.repeat(64),
            width: 20,
            height: 20,
            size: 42,
            contentType: 'image/webp',
          },
        ],
        cursor: isComplete ? null : 'next',
      },
    });
  });
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-status]')).toContainText(
    'Hors connexion',
  );
  expect(await storedCount(page)).toBe(3);
  isComplete = true;
  await page.evaluate(() => globalThis.dispatchEvent(new Event('online')));
  await expect.poll(async () => storedCount(page)).toBe(1);
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
});

test('expired copies are cleared while Morning is active and corrupt saved images are skipped', async ({
  page,
}) => {
  await page.goto('/calendar-privacy');
  await seed(page);
  await page.clock.setSystemTime(new Date(fixtureNow + 8 * 86_400_000));
  await page.route('**/api/photos**', async (route) => route.abort());
  await page.goto('/?display=frame');
  await expect(page.locator('[data-dashboard]')).toHaveAttribute(
    'data-mode',
    'morning',
  );
  await expect.poll(async () => storedCount(page)).toBe(0);
  await page.goto('/calendar-privacy');
  await seed(page);
  await page.evaluate(async (path) => {
    const store = (await import(path)) as Store;
    const blob = new Blob(['broken image'], {type: 'image/webp'});
    await store.savePhoto(
      {
        id: '0'.repeat(64),
        width: 20,
        height: 20,
        size: blob.size,
        contentType: 'image/webp',
      },
      blob,
      store.offlineControl()!.token,
    );
  }, storePath);
  await page.addInitScript(() => {
    Math.random = () => 0.99;
  });
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect.poll(async () => storedCount(page)).toBe(2);
  await page.clock.runFor(61_000);
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
});

test('human Access logout clears another display before navigation', async ({
  page,
  context,
}) => {
  await page.goto('/calendar-privacy');
  await seed(page);
  await routeSeededCatalog(page);
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await page.route('**/api/photos**', async (route) => route.abort());
  const admin = await context.newPage();
  await admin.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    await route.fulfill({
      json:
        path === '/api/session'
          ? {role: 'admin', subject: 'Synthetic admin'}
          : path === '/api/config'
            ? defaultSettings
            : null,
    });
  });
  await admin.goto('/admin/settings');
  await expect(admin.locator('[data-status]')).toContainText('Synthetic admin');
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await admin.route('**/cdn-cgi/access/logout', async (route) =>
    route.fulfill({body: 'Signed out'}),
  );
  await admin.getByRole('link', {name: 'Se déconnecter', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toHaveCount(0);
  expect(await storedCount(page)).toBe(0);
  await admin.close();
});

test('failed cleanup stays denied, retries, and expiry still clears copies after pagehide', async ({
  page,
}) => {
  await page.goto('/calendar-privacy');
  await seed(page);
  const denied = await page.evaluate(async (path) => {
    const store = (await import(path)) as Store;
    const {indexedDB} = globalThis;
    const open = indexedDB.open.bind(indexedDB);
    indexedDB.open = () => {
      throw new Error('Storage blocked');
    };

    store.invalidateOfflinePhotos();
    // Let the failed clear schedule its retry before restoring IndexedDB.
    await Promise.resolve();
    await Promise.resolve();
    indexedDB.open = open;
    return {
      enabled: Boolean(store.offlineControl()),
      image: await store.savedPhoto('0'.repeat(64)),
    };
  }, storePath);
  expect(denied).toEqual({enabled: false, image: undefined});
  await page.clock.runFor(61_000);
  // Read raw records, so this assertion cannot itself trigger cleanup.
  const rawCount = async () =>
    page.evaluate(
      async () =>
        new Promise<number>((resolve, reject) => {
          const request = globalThis.indexedDB.open(
            'dayframe.offline-photos.v1',
            1,
          );
          request.onsuccess = () => {
            const database = request.result;
            const read = database
              .transaction('photos')
              .objectStore('photos')
              .count();
            read.onsuccess = () => {
              database.close();
              resolve(read.result);
            };

            read.addEventListener('error', () => {
              reject(new Error('read failed'));
            });
          };

          request.addEventListener('error', () => {
            reject(new Error('open failed'));
          });
        }),
    );
  await expect.poll(rawCount).toBe(0);
  await seed(page);
  await routeSeededCatalog(page);
  await page.goto('/?display=frame');
  await page.getByRole('button', {name: 'Photos', exact: true}).click();
  await expect(page.locator('[data-photo-stage] img')).toBeVisible();
  await page.evaluate(() => globalThis.dispatchEvent(new Event('pagehide')));
  await page.clock.fastForward(7 * 86_400_000 + 60_000);
  await expect.poll(rawCount).toBe(0);
});
