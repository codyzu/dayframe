import {expect, test} from '../fixtures/browser.ts';

test('three clipboard items preview and convert locally without API calls', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (
      request.method() !== 'GET' ||
      new URL(request.url()).pathname.startsWith('/api/')
    ) {
      requests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async read() {
          const images = [];
          for (const [width, height] of [
            [2400, 1600],
            [900, 1400],
            [32, 24],
          ]) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d')!.fillRect(0, 0, width, height);
            const blob = await new Promise<Blob>((resolve) => {
              canvas.toBlob((value) => {
                resolve(value!);
              }, 'image/png');
            });
            images.push({
              types: ['image/png', 'image/jpeg'],
              async getType() {
                return blob;
              },
            });
          }

          return images;
        },
      },
    });
  });
  await page.goto('/experiments/photo-paste/?expected=3');
  await page.getByRole('button', {name: 'Coller les photos'}).click();
  await expect(page.locator('[data-count]')).toHaveText(
    '3 photo(s) reçue(s) sur 3 attendue(s).',
  );
  await expect(page.locator('[data-results] img')).toHaveCount(3);
  await expect(page.locator('[data-clipboard-report]')).toContainText(
    'Éléments renvoyés : 3',
  );
  await expect(page.locator('[data-clipboard-report]')).toContainText(
    'Élément 3 : image/png, image/jpeg',
  );
  await expect(page.locator('[data-clipboard-report]')).toContainText(
    'Images extraites : 3',
  );
  await expect(page.locator('[data-results] li').first()).toContainText(
    '2400 × 1600',
  );
  await page.getByRole('button', {name: 'Tester la conversion WebP'}).click();
  await expect(page.getByRole('status')).toContainText(
    '3 photo(s) convertie(s)',
    {timeout: 60_000},
  );
  await expect(page.locator('[data-output]').first()).toContainText(
    'WebP : 1600 × 1067',
  );
  expect(requests).toEqual([]);
  await page.evaluate(() => {
    globalThis.dispatchEvent(new Event('pagehide'));
  });
  await expect(page.locator('[data-results] img')).toHaveCount(0);
  await expect(page.locator('[data-process]')).toBeDisabled();
});

test('a truncated clipboard batch is visible and cannot process', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        async read() {
          const canvas = document.createElement('canvas');
          canvas.width = 20;
          canvas.height = 20;
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((value) => {
              resolve(value!);
            });
          });
          return [
            {
              types: ['image/png'],
              async getType() {
                return blob;
              },
            },
          ];
        },
      },
    });
  });
  await page.goto('/experiments/photo-paste/?expected=3');
  await page.locator('[data-paste]').click();
  await expect(page.locator('[data-count]')).toHaveText(
    '1 photo(s) reçue(s) sur 3 attendue(s).',
  );
  await expect(page.getByRole('status')).toContainText('Lot incomplet');
  await expect(page.locator('[data-process]')).toBeDisabled();
});

test('clipboard denial is recoverable and manual paste never inserts HTML or text', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        async read() {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
    });
  });
  await page.goto('/experiments/photo-paste/');
  await page.locator('[data-paste]').click();
  await expect(page.getByRole('status')).toContainText(
    'Collage annulé, refusé ou indisponible',
  );
  await expect(page.locator('[data-paste]')).toBeEnabled();
  await page.evaluate(() => {
    // eslint-disable-next-line unicorn/isolated-functions -- DataTransfer is a browser global in this Playwright callback.
    const data = new DataTransfer();
    data.setData(
      'text/html',
      '<img src="https://example.invalid/private"><script>alert(1)</script>',
    );
    data.setData('text/plain', 'CLIPBOARD_TEXT_MUST_NOT_APPEAR');
    globalThis.document.querySelector('[data-paste-zone]')!.dispatchEvent(
      // eslint-disable-next-line unicorn/isolated-functions -- ClipboardEvent is a browser global in this Playwright callback.
      new ClipboardEvent('paste', {
        clipboardData: data,
        cancelable: true,
      }),
    );
  });
  await expect(page.getByRole('status')).toContainText('Aucune image reçue');
  await expect(page.locator('[data-clipboard-report]')).toContainText(
    'collage manuel',
  );
  await expect(page.locator('body')).not.toContainText(
    'CLIPBOARD_TEXT_MUST_NOT_APPEAR',
  );
  await expect(page.locator('body')).not.toContainText(
    'example.invalid/private',
  );
  await expect(page.locator('[data-paste-zone]')).toBeEmpty();
  await expect(page.locator('[data-results]')).toBeEmpty();
});

test('clearing while clipboard access is pending prevents late previews', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        async read() {
          await new Promise<void>((resolve) => {
            globalThis.addEventListener(
              'test-allow-paste',
              () => {
                resolve();
              },
              {once: true},
            );
          });
          return [
            {
              types: ['image/png'],
              async getType() {
                return new Blob(['invalid'], {type: 'image/png'});
              },
            },
          ];
        },
      },
    });
  });
  await page.goto('/experiments/photo-paste/');
  await page.locator('[data-paste]').click();
  await page.locator('[data-clear]').click();
  await page.evaluate(() => {
    globalThis.dispatchEvent(new Event('test-allow-paste'));
  });
  await expect(page.locator('[data-paste]')).toBeEnabled();
  await expect(page.locator('[data-results]')).toBeEmpty();
  await expect(page.getByRole('status')).toHaveText(
    'Aperçus et résultats effacés.',
  );
});
