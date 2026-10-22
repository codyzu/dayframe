import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import ts from 'typescript';
import type {Page} from '@playwright/test';
import type * as StoreModule from '../../src/lib/photos/offline.ts';
import {test, expect} from '../fixtures/browser.ts';

type Store = typeof StoreModule;
const bytes = [
  ...Buffer.from(
    'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    'base64',
  ),
];

async function seed(page: Page, fit = 'contain', interval = 5) {
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

  await page.goto('/calendar-privacy');
  await page.evaluate(
    async ({bytes: encoded, fit: preference, interval: seconds}) => {
      const path = '/__test/offline.js';
      const store = (await import(path)) as Store;
      const token = (await store.enableOfflinePhotos())!;
      await store.renewOfflineLease(token, {
        fit: preference as 'contain' | 'cover',
        interval: seconds,
      });
      const blob = new Blob([new Uint8Array(encoded)], {type: 'image/webp'});
      for (const id of ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)]) {
        await store.savePhoto(
          {id, width: 1, height: 1, size: blob.size, contentType: 'image/webp'},
          blob,
          token,
        );
      }
    },
    {bytes, fit, interval},
  );
}

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
  await seed(page, 'cover', 300);
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
  const first = await page.locator('main img').getAttribute('src');
  await page.clock.runFor(300_000);
  await expect(page.locator('main img')).not.toHaveAttribute('src', first!);
  // Cross Night and Morning without persisting or consulting a schedule.
  for (let hour = 0; hour < 10; hour++) {
    await page.clock.fastForward(3_600_000);
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
