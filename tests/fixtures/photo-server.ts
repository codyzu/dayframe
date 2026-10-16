/* eslint-disable unicorn/no-await-expression-member -- Parse internal test provisioning responses inline. */
// Test harness only: local HTTPS, synthetic Access issuer, and real local KV.
// This entrypoint is never included in Wrangler production builds.
import {Buffer} from 'node:buffer';
import process from 'node:process';
import {createServer} from 'node:https';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {getPlatformProxy} from 'wrangler';
import {defaultSettings} from '../../src/lib/dashboard/settings.ts';
import worker, {type Env} from '../../worker/index.ts';
import {administration} from '../../worker/administration.ts';
import type {PhotoKV} from '../../worker/photos.ts';
import {administrationRuntime} from './administration-runtime.ts';
import {photoAuthority, testAudience, testIssuer} from './photo-auth.ts';

const authority = await photoAuthority();
const originalFetch = fetch;
// eslint-disable-next-line unicorn/no-global-object-property-assignment -- Only the test issuer is intercepted in this isolated process.
globalThis.fetch = async (input, init) =>
  (input instanceof Request ? input.url : input.toString()) ===
  `${testIssuer}/cdn-cgi/access/certs`
    ? Response.json(authority.jwks)
    : originalFetch(input, init);
const platform = await getPlatformProxy({
  configPath: 'tests/fixtures/wrangler.photos.jsonc',
  persist: false,
});
let displayToken: string;
const temporary = await mkdtemp(path.join(tmpdir(), 'dayframe-photo-test-'));
execFileSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    path.join(temporary, 'key.pem'),
    '-out',
    path.join(temporary, 'cert.pem'),
    '-subj',
    '/CN=localhost',
    '-days',
    '1',
  ],
  {stdio: 'ignore'},
);
const administrationPlatform = await administrationRuntime();
const assetsRoot = path.resolve('dist');
const env: Env = {
  DEPLOYMENT_STAGE: 'test',
  PHOTOS_ENABLED: 'true',
  PHOTOS: platform.env.PHOTOS as PhotoKV,
  ACCESS_TEAM_DOMAIN: testIssuer,
  ACCESS_AUD: testAudience,
  ADMIN_EMAILS: 'one@example.test,two@example.test',
  ADMINISTRATION: administrationPlatform.binding,
  HOME_NETWORKS: '192.0.2.10,2001:db8:1234::/48',
  ASSETS: {
    async fetch(request) {
      const pathname = decodeURIComponent(new URL(request.url).pathname);
      let target = path.resolve(assetsRoot, `.${pathname}`);
      if (target !== assetsRoot && !target.startsWith(`${assetsRoot}/`)) {
        return new Response('Missing', {status: 404});
      }

      if (path.extname(target) === '') {
        target = path.join(target, 'index.html');
      }

      const mime: Record<string, string> = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
        '.wasm': 'application/wasm',
      };
      try {
        return new Response(await readFile(target), {
          headers: {
            'Content-Type':
              mime[path.extname(target)] ?? 'application/octet-stream',
          },
        });
      } catch {
        return new Response('Missing', {status: 404});
      }
    },
  },
};
displayToken = (
  (await (await administration(env.ADMINISTRATION!, '/credential')).json()) as {
    token: string;
  }
).token;
const server = createServer(
  {
    key: await readFile(path.join(temporary, 'key.pem')),
    cert: await readFile(path.join(temporary, 'cert.pem')),
  },
  (incoming, outgoing) => {
    void (async () => {
      const url = new URL(incoming.url ?? '/', 'https://127.0.0.1:8789');
      if (url.pathname === '/__test/login') {
        const email =
          url.searchParams.get('admin') === 'two'
            ? 'two@example.test'
            : 'one@example.test';
        outgoing.writeHead(200, {
          'Set-Cookie': `CF_Authorization=${await authority.token(email)}; HttpOnly; Secure; SameSite=Strict; Path=/`,
        });
        outgoing.end('ok');
        return;
      }

      if (url.pathname === '/__test/reset') {
        const page = await env.PHOTOS!.list({prefix: 'photo:', limit: 1000});
        await Promise.all(
          page.keys.map(async ({name}) => env.PHOTOS!.delete(name)),
        );
        await administration(
          env.ADMINISTRATION!,
          '/config',
          defaultSettings,
          'PATCH',
        );
        displayToken = (
          (await (
            await administration(env.ADMINISTRATION!, '/credential')
          ).json()) as {token: string}
        ).token;
        outgoing.end('ok');
        return;
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of incoming) {
        chunks.push(Buffer.from(chunk as Uint8Array));
      }

      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      }

      headers.set('CF-Connecting-IP', headers.get('X-Test-IP') ?? '192.0.2.10');
      let request = new Request(url, {
        method: incoming.method,
        headers,
        ...(!['GET', 'HEAD'].includes(incoming.method ?? 'GET') && {
          body: Buffer.concat(chunks),
        }),
      });
      if (url.pathname === '/__test/display') {
        request = new Request(`${url.origin}/api/session/display`, {
          method: 'POST',
          headers: {
            Origin: url.origin,
            'X-Dayframe-Request': '1',
            Authorization: `Bearer ${displayToken}`,
            'CF-Connecting-IP': '192.0.2.10',
          },
        });
      }

      const response = await worker.fetch(request, env);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    })().catch(() => {
      outgoing.writeHead(500);
      outgoing.end('Test harness failure');
    });
  },
);
server.listen(8789, '127.0.0.1');
async function close() {
  server.close();
  await platform.dispose();
  await administrationPlatform.runtime.dispose();
  await rm(temporary, {recursive: true, force: true});
}

process.on('SIGTERM', () => {
  void close();
});
process.on('SIGINT', () => {
  void close();
});
