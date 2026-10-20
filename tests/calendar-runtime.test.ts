/* eslint-disable unicorn/no-await-expression-member -- Keep runtime response assertions beside each OAuth step. */
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {base64url} from 'jose';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {expect, it} from 'vitest';
import {
  photoAuthority,
  testAudience,
  testIssuer,
} from './fixtures/photo-auth.ts';

it('runs the complete OAuth/agenda flow in workerd and never follows provider redirects', async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), 'dayframe-calendar-runtime-'),
  );
  let runtime: Miniflare | undefined;
  try {
    const config = path.join(directory, 'wrangler.json');
    await writeFile(
      config,
      JSON.stringify({
        name: 'dayframe-calendar-test',
        main: path.resolve('worker/index.ts'),
        compatibility_date: '2026-10-16',
      }),
    );
    execFileSync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'deploy',
        '--dry-run',
        '--config',
        config,
        '--outdir',
        path.join(directory, 'bundle'),
      ],
      {stdio: 'pipe'},
    );
    const authority = await photoAuthority();
    const origin = 'https://calendar.example.test';
    const session = `CF_Authorization=${await authority.token()}`;
    const encryptionKey = base64url.encode(new Uint8Array(32).fill(7));
    let shouldRedirect = false;
    let escapedRequests = 0;
    const workerContents = await readFile(
      path.join(directory, 'bundle/index.js'),
      'utf8',
    );
    runtime = new Miniflare(
      convertV4MiniflareOptions({
        modules: [
          {
            type: 'ESModule',
            path: 'index.js',
            contents: workerContents,
          },
        ],
        compatibilityDate: '2026-10-16',
        durableObjects: {
          ADMINISTRATION: {className: 'Administration', useSQLite: true},
        },
        bindings: {
          // Calendar routes do not read photo storage; retain its existing feature gate.
          PHOTOS: 'unused-calendar-fixture',
          PHOTOS_ENABLED: 'true',
          ACCESS_TEAM_DOMAIN: testIssuer,
          ACCESS_AUD: testAudience,
          ADMIN_EMAILS: 'one@example.test',
          GOOGLE_CLIENT_ID: 'synthetic-client',
          GOOGLE_CLIENT_SECRET: 'synthetic-secret',
          GOOGLE_REDIRECT_URI: `${origin}/api/calendar/callback`,
          CALENDAR_TOKEN_KEY: encryptionKey,
        },
        async outboundService(request) {
          const url = new URL(request.url);
          if (url.hostname.endsWith('.cloudflareaccess.com')) {
            return Response.json(authority.jwks);
          }

          if (url.hostname === 'unexpected.example.test') {
            escapedRequests++;
            return Response.json({});
          }

          if (shouldRedirect) {
            return new Response(null, {
              status: 302,
              headers: {
                Location: 'https://unexpected.example.test/credentials',
              },
            });
          }

          if (url.pathname === '/token') {
            return Response.json({
              access_token: 'synthetic-access',
              refresh_token: 'synthetic-refresh',
              expires_in: 3600,
              scope:
                'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly',
            });
          }

          if (url.pathname.endsWith('/calendarList')) {
            return Response.json({items: [{id: 'family', summary: 'Family'}]});
          }

          if (url.pathname.endsWith('/events')) {
            return Response.json({
              items: [
                {
                  summary: 'Synthetic event',
                  start: {dateTime: new Date().toISOString()},
                  end: {dateTime: new Date(Date.now() + 60_000).toISOString()},
                },
              ],
            });
          }

          if (url.pathname === '/revoke') {
            return Response.json({});
          }

          throw new Error('Unexpected fixture request');
        },
      }),
    );
    const api = async (endpoint: string, method = 'GET', body?: unknown) =>
      runtime!.dispatchFetch(`${origin}${endpoint}`, {
        method,
        headers: {
          Cookie: session,
          Origin: origin,
          'X-Dayframe-Request': '1',
          'Content-Type': 'application/json',
        },
        ...(body !== undefined && {body: JSON.stringify(body)}),
      });
    const start = await api('/api/calendar/connect', 'POST');
    const {url} = (await start.json()) as {url: string};
    const state = new URL(url).searchParams.get('state')!;
    const nonce = start.headers.get('Set-Cookie')!.split(';', 1)[0];
    const callback = await runtime.dispatchFetch(
      `${origin}/api/calendar/callback?state=${state}&code=synthetic-code`,
      {headers: {Cookie: `${session}; ${nonce}`}, redirect: 'manual'},
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get('Location')).toBe(
      '/admin/settings?calendar=connected',
    );
    expect((await api('/api/calendar', 'PATCH', {id: 'family'})).status).toBe(
      200,
    );
    const agenda = await api('/api/calendar/events');
    expect(agenda.status).toBe(200);
    expect(await agenda.text()).toContain('Synthetic event');
    shouldRedirect = true;
    expect((await api('/api/calendar/calendars')).status).toBe(503);
    expect(escapedRequests).toBe(0);
  } finally {
    await runtime?.dispose();
    await rm(directory, {recursive: true, force: true});
  }
}, 30_000);
