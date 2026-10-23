import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

const base = 'https://dayframe-fixture-production.cody-zuschlag.workers.dev';
const routes = [
  {path: '/', method: 'GET', status: 200},
  {path: '/admin/photos', method: 'GET', status: 302},
  {path: '/admin/settings', method: 'GET', status: 302},
  {path: '/setup', method: 'GET', status: 307},
  {path: '/setup/', method: 'GET', status: 200},
  {path: '/api/health', method: 'GET', status: 200},
  {path: '/api/health', method: 'HEAD', status: 200},
  {path: '/api/health', method: 'POST', status: 405},
  {path: '/api/photos', method: 'GET', status: 401},
  {path: '/api/session', method: 'GET', status: 401},
  {path: '/calendar-privacy/', method: 'GET', status: 200},
  {path: '/api/day-context', method: 'GET', status: 401},
  {path: '/api/day-context', method: 'POST', status: 403},
  {path: '/api/calendar', method: 'GET', status: 401},
  {path: '/api/calendar/events', method: 'GET', status: 401},
  {path: '/api/calendar/calendars', method: 'GET', status: 401},
  {path: '/api/calendar/callback', method: 'GET', status: 401},
  {path: '/api/calendar/connect', method: 'POST', status: 403},
  {path: '/api/calendar', method: 'PATCH', status: 403},
  {path: '/api/calendar', method: 'DELETE', status: 403},
  {path: `/api/photos/${'0'.repeat(64)}`, method: 'GET', status: 401},
  {path: '/api/photos', method: 'POST', status: 403},
  {path: '/api/config', method: 'GET', status: 401},
  {path: '/api/config/display', method: 'GET', status: 401},
  {path: '/api/display', method: 'GET', status: 401},
  {path: '/api/config', method: 'PATCH', status: 403},
  {path: '/api/display', method: 'POST', status: 403},
  {path: '/api/display', method: 'DELETE', status: 403},
  {path: '/api/session/display', method: 'POST', status: 403},
  {path: '/api/unknown', method: 'GET', status: 404},
];
const expectedHtml = await readFile(
  new URL('../dist/index.html', import.meta.url),
  'utf8',
);
const hash = (value) => createHash('sha256').update(value).digest('hex');
await Promise.all(
  routes.map(async ({path, method, status}) => {
    // Cloudflare can serve the previous version briefly after an upload succeeds.
    /* eslint-disable no-await-in-loop -- Retry sequentially to avoid hammering the public endpoint. */
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch(base + path, {
          method,
          redirect: 'manual',
          signal: AbortSignal.timeout(15_000),
        });
        assert.equal(response.status, status, `${method} ${path}`);
        const body = await response.text();
        if (path === '/setup') {
          assert.equal(
            new URL(response.headers.get('location') ?? '', base).href,
            `${base}/setup/`,
            'Setup must redirect only to its canonical same-origin page',
          );
        }

        if (path.startsWith('/api/')) {
          assert.match(
            response.headers.get('cache-control') ?? '',
            /(?:^|,\s*)no-store(?:,|$)/v,
          );
          assert.match(
            response.headers.get('content-type') ?? '',
            /application\/json/v,
          );
        }

        if (path.startsWith('/admin/')) {
          const destination = new URL(
            response.headers.get('location') ?? '',
            base,
          );
          assert.ok(
            destination.hostname.endsWith('.cloudflareaccess.com'),
            'Admin must redirect to Cloudflare Access',
          );
          assert.equal(destination.protocol, 'https:');
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
            hash(body),
            hash(expectedHtml),
            'Live HTML hash must match the verified build',
          );
        }

        console.log(`${method} ${path}: ${response.status}`);
        return;
      } catch (error) {
        if (attempt === 12) {
          throw error;
        }

        console.log(
          `${method} ${path}: retry ${attempt}/12 after ${error.message}`,
        );
        await delay(5000);
      }
    }
    /* eslint-enable no-await-in-loop */
  }),
);

// Check the canonical public fallback URL as well as HTML: the worker rejects
// redirects during installation, including Static Assets' /offline.html redirect.
await Promise.all(
  [
    {file: 'offline.html', pathname: '/offline', type: 'text/html'},
    {file: 'sw.js', pathname: '/sw.js', type: 'javascript'},
    {file: 'version.json', pathname: '/version.json', type: 'application/json'},
  ].map(async ({file, pathname, type}) => {
    const expected = await readFile(
      new URL('../dist/' + file, import.meta.url),
    );
    // Like the route checks, tolerate bounded edge propagation after deployment.
    /* eslint-disable no-await-in-loop -- Retry sequentially rather than hammering the public endpoint. */
    for (let attempt = 1; ; attempt++) {
      try {
        const response = await fetch(base + pathname, {
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(15_000),
        });
        assert.equal(response.status, 200, pathname);
        assert.ok(
          response.headers.get('content-type')?.includes(type),
          pathname,
        );
        const body = new Uint8Array(await response.arrayBuffer());
        assert.equal(hash(body), hash(expected), pathname);
        console.log(`GET ${pathname}: exact public artifact, no redirect`);
        return;
      } catch (error) {
        if (attempt === 12) {
          throw error;
        }

        console.log(
          `GET ${pathname}: retry ${attempt}/12 after ${error.message}`,
        );
        await delay(5000);
      }
    }
    /* eslint-enable no-await-in-loop */
  }),
);
