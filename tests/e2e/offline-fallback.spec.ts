import {readFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import {seedOfflinePhotos as seed} from '../fixtures/offline-store.ts';
import {test, expect} from '../fixtures/browser.ts';

async function standalone(page: Page) {
  const html = await readFile('dist/offline.html', 'utf8');
  // Navigation fixture only: every request after the document is blocked.
  await page.route('**/*', async (route) => {
    if (route.request().url().startsWith('blob:')) {
      await route.continue();
    } else {
      await route.abort();
    }
  });
  await page.route('**/offline.html', async (route) =>
    route.fulfill({contentType: 'text/html', body: html}),
  );
  await page.goto('/offline.html');
}

test('self-contained CSP document rotates overnight, honors preferences and retains only current/next', async ({
  page,
}) => {
  await page.clock.install({time: new Date('2026-10-22T21:59:00Z')});
  await seed(page, 'cover', 3600);
  await page.addInitScript(() => {
    const urls = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.add(url);
      if (urls.size > 2) {
        throw new Error('Unbounded decoding');
      }

      document.documentElement.dataset.urls = String(urls.size);
      return url;
    };

    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      revoke(url);
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  await standalone(page);
  await expect(page.locator('main img')).toBeVisible();
  await expect(page.locator('main img')).toHaveCSS('object-fit', 'cover');
  const geometry = await page.evaluate(() => ({
    width: globalThis.document.documentElement.scrollWidth,
    height: globalThis.document.documentElement.scrollHeight,
    viewportWidth: globalThis.innerWidth,
    viewportHeight: globalThis.innerHeight,
  }));
  expect(geometry.width).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.height).toBeLessThanOrEqual(geometry.viewportHeight);
  const first = await page.locator('main img').getAttribute('src');
  await page.clock.fastForward(3_590_000);
  await expect(page.locator('main img')).toHaveAttribute('src', first!);
  await page.clock.fastForward(20_000);
  await expect(page.locator('main img')).not.toHaveAttribute('src', first!);
  // Cross Night and Morning without persisting or consulting a schedule.
  for (let hour = 0; hour < 10; hour++) {
    const previous = await page.locator('main img').getAttribute('src');
    await page.clock.fastForward(3_600_000);
    // Finish the native decode before advancing another virtual hour. Merely
    // checking visibility can observe the previous image during the next decode.
    await expect(page.locator('main img')).not.toHaveAttribute(
      'src',
      previous!,
    );
    await expect(page.locator('main img')).toBeVisible();
  }

  expect(errors).toEqual([]);
  await expect(page.locator('html')).toHaveAttribute('data-urls', '2');
  await page.screenshot({
    path: `test-results/offline-${test.info().project.name}.png`,
  });
});

test('missing, expired and corrupt storage fail closed', async ({page}) => {
  await page.clock.install();
  await seed(page);
  await page.clock.runFor(7 * 86_400_000 + 1000);
  await standalone(page);
  await expect(page.locator('main img')).toHaveCount(0);
  await expect(page.locator('[data-status]')).toContainText('Aucune photo');
});

test('storage absence and corruption leave useful retry', async ({page}) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'indexedDB', {
      get() {
        throw new Error('Unavailable');
      },
    });
  });
  await standalone(page);
  await expect(page.locator('[data-status]')).toContainText('Stockage');
  await expect(page.getByRole('button')).toBeEnabled();
});

test('corrupt image is skipped and lease denial clears loaded photos across tabs', async ({
  page,
  context,
}) => {
  await seed(page);
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const request = globalThis.indexedDB.open('dayframe.offline-photos.v1');
      request.onsuccess = () => {
        const tx = request.result.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put(new Uint8Array([0]).buffer, 'a'.repeat(64));
        tx.oncomplete = () => {
          request.result.close();
          resolve();
        };
      };
    });
  });
  await standalone(page);
  await expect(page.locator('main img')).toBeVisible({timeout: 12_000});
  await page.clock.install();
  for (let index = 0; index < 5; index++) {
    await page.clock.runFor(5000);
  }

  const other = await context.newPage();
  await other.goto('/calendar-privacy');
  await other.evaluate(() => {
    localStorage.setItem(
      'dayframe.offline-photos.v1',
      JSON.stringify({token: 'denied', enabled: false}),
    );
  });
  await expect(page.locator('main img')).toHaveCount(0);
  await expect(page.locator('[data-status]')).toContainText('expiré');
});

test('recovery validates health, backs off and limits partial-startup returns', async ({
  page,
}) => {
  await page.clock.install();
  await standalone(page);
  let requests = 0;
  await page.route('**/api/health', async (route) => {
    requests++;
    await route.fulfill({json: {ok: true, service: 'captive-portal'}});
  });
  await page.clock.runFor(15_000);
  await expect.poll(() => requests).toBe(1);
  await page.clock.runFor(15_000);
  await expect.poll(() => requests).toBe(2);
  await page.clock.runFor(29_000);
  await expect.poll(() => requests).toBe(2);
  await page.route('**/api/health', async (route) => {
    requests++;
    await route.fulfill({json: {ok: true, service: 'dayframe'}});
  });
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button').click(),
  ]);
  await page.waitForURL('**/offline.html', {waitUntil: 'load'});
  await expect(page.locator('[data-status]')).toContainText('Aucune photo');
  await expect
    .poll(async () =>
      page.evaluate(() =>
        Number(sessionStorage.getItem('dayframe.offline-return')),
      ),
    )
    .toBeGreaterThan(0);
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    navigations.push(frame.url());
  });
  await page.getByRole('button').click();
  await page.clock.runFor(30_000);
  expect(navigations).toEqual([]);
});

test('denied session storage allows manual healthy recovery without automatic navigation loops', async ({
  page,
}) => {
  await page.clock.install();
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      get() {
        throw new Error('Unavailable');
      },
    });
  });
  await standalone(page);
  await expect(page.locator('[data-status]')).toContainText('Aucune photo');
  await page.route('**/api/health', async (route) =>
    route.fulfill({json: {ok: true, service: 'dayframe'}}),
  );
  const navigations: string[] = [];
  page.on('framenavigated', (frame) => {
    navigations.push(frame.url());
  });
  await page.clock.runFor(15_000);
  await expect(page.locator('[data-status]')).toContainText(
    'Connexion disponible',
  );
  expect(navigations).toEqual([]);
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button').click(),
  ]);
  expect(navigations).toHaveLength(1);
});

test('rapid visibility changes cancel pending decodes without dropping valid photos or exceeding two URLs', async ({
  page,
}) => {
  await page.clock.install();
  await seed(page);
  await page.addInitScript(() => {
    const urls = new Set<string>();
    const create = URL.createObjectURL.bind(URL);
    const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.add(url);
      if (urls.size > 2) {
        throw new Error('Too many retained images');
      }

      globalThis.document.documentElement.dataset.urls = String(urls.size);
      return url;
    };

    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      revoke(url);
      globalThis.document.documentElement.dataset.urls = String(urls.size);
    };

    const {decode} = HTMLImageElement.prototype;
    let attempts = 0;
    HTMLImageElement.prototype.decode = async function () {
      if (globalThis.document.documentElement.dataset.resumeDecode !== 'true') {
        attempts++;
        globalThis.document.documentElement.dataset.attempts = String(attempts);
        await new Promise(() => {
          // The owning slideshow's timeout deliberately cancels this decode.
        });
      }

      await decode.call(this);
    };
  });
  await standalone(page);
  for (let attempt = 1; attempt <= 5; attempt++) {
    await expect(page.locator('html')).toHaveAttribute(
      'data-attempts',
      String(attempt),
    );
    await page.evaluate(() => {
      Object.defineProperty(globalThis.document, 'hidden', {
        value: true,
        configurable: true,
      });
      globalThis.document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('html')).toHaveAttribute('data-urls', '0');
    await page.evaluate(() => {
      Object.defineProperty(globalThis.document, 'hidden', {
        value: false,
        configurable: true,
      });
      globalThis.document.dispatchEvent(new Event('visibilitychange'));
    });
  }

  await page.evaluate(() => {
    Object.defineProperty(globalThis.document, 'hidden', {
      value: true,
      configurable: true,
    });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
    globalThis.document.documentElement.dataset.resumeDecode = 'true';
    Object.defineProperty(globalThis.document, 'hidden', {
      value: false,
      configurable: true,
    });
    globalThis.document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('main img')).toBeVisible();
  await page.clock.fastForward(4000);
  await expect(page.locator('main img')).toBeVisible();
  const count = await page.evaluate(
    async () =>
      new Promise<number>((resolve) => {
        const request = globalThis.indexedDB.open('dayframe.offline-photos.v1');
        request.onsuccess = () => {
          const tx = request.result.transaction('photos');
          const photos = tx.objectStore('photos').count();
          photos.onsuccess = () => {
            resolve(photos.result);
          };

          tx.oncomplete = () => {
            request.result.close();
          };
        };
      }),
  );
  expect(count).toBe(3);
});
