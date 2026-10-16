import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const base = 'https://dayframe-fixture-production.cody-zuschlag.workers.dev';
const routes = [
  {path: '/', method: 'GET', status: 200},
  {path: '/admin/photos', method: 'GET', status: 200},
  {path: '/api/health', method: 'GET', status: 200},
  {path: '/api/health', method: 'HEAD', status: 200},
  {path: '/api/health', method: 'POST', status: 405},
  {path: '/api/photos', method: 'GET', status: 404},
  {path: '/api/photos', method: 'POST', status: 404},
  {path: '/api/config', method: 'GET', status: 404},
];
const expectedHtml = await readFile(
  new URL('../dist/index.html', import.meta.url),
  'utf8',
);
await Promise.all(
  routes.map(async ({path, method, status}) => {
    const response = await fetch(base + path, {
      method,
      signal: AbortSignal.timeout(15_000),
    });
    assert.equal(response.status, status, `${method} ${path}`);
    const body = await response.text();
    if (path.startsWith('/api/')) {
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(
        response.headers.get('content-type') ?? '',
        /application\/json/v,
      );
    }

    if (path === '/api/health' && method === 'GET') {
      assert.deepEqual(JSON.parse(body), {
        ok: true,
        service: 'dayframe',
        stage: 'production',
      });
    }

    if (path === '/') {
      assert.equal(
        body,
        expectedHtml,
        'Live HTML must match the verified build',
      );
    }

    console.log(`${method} ${path}: ${response.status}`);
  }),
);
