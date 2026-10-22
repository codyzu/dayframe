import {readFile} from 'node:fs/promises';
import {Buffer} from 'node:buffer';
import ts from 'typescript';
import type {Page} from '@playwright/test';
import type * as StoreModule from '../../src/lib/photos/offline.ts';

type Store = typeof StoreModule;
const bytes = [
  ...Buffer.from(
    'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    'base64',
  ),
];

export async function seedOfflinePhotos(
  page: Page,
  fit = 'contain',
  interval = 5,
) {
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

  await page.goto(
    page.url().startsWith('http')
      ? new URL('/calendar-privacy', page.url()).href
      : '/calendar-privacy',
  );
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
