import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {test, expect} from 'vitest';
import {buildOffline} from '../scripts/offline-build.mjs';

test('fallback is one public document with exact CSP hashes and no external runtime assets', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dayframe-fallback-'));
  try {
    await buildOffline(pathToFileURL(directory + '/'));
    const html = await readFile(join(directory, 'offline.html'), 'utf8');
    for (const tag of ['script', 'style']) {
      const content = new RegExp(
        String.raw`<${tag}>([\s\S]*?)</${tag}>`,
        'v',
      ).exec(html)![1];
      const hash = createHash('sha256').update(content).digest('base64');
      expect(html).toContain(`'sha256-${hash}'`);
    }

    expect(html).not.toMatch(/(?:src|href)=["']/v);
    expect(html).not.toContain('unsafe-inline');
    expect(html).not.toContain('unsafe-eval');
    expect(html).not.toContain('/api/photos');
    expect(html).not.toContain('uploadedBy');
    expect(html).toContain('dayframe.offline-photos.v1');
    expect(html).toContain('data-offline');
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
