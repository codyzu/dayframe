/* eslint-disable unicorn/no-await-expression-member, unicorn/max-nested-calls -- Inline response and timestamp assertions keep security cases readable. */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- The unused photo binding is an explicit empty test double; no photo route is called. */
import {beforeAll, afterAll, beforeEach, expect, it, vi} from 'vitest';
import {base64url} from 'jose';
import worker, {type Env} from '../worker/index.ts';
import {administration} from '../worker/administration.ts';
import {normalizeEvents} from '../worker/calendar.ts';
import {dayEnd} from '../src/lib/calendar/contracts.ts';
import {administrationRuntime} from './fixtures/administration-runtime.ts';
import {
  photoAuthority,
  testAudience,
  testIssuer,
} from './fixtures/photo-auth.ts';

const authority = await photoAuthority();
const origin = 'https://example.test';
const scopes =
  'https://www.googleapis.com/auth/calendar.events.readonly https://www.googleapis.com/auth/calendar.calendarlist.readonly';
let platform: Awaited<ReturnType<typeof administrationRuntime>>;
let env: Env;
let admin: string;
let display: string;
let googleCalls: string[];
let tokenExpiry = 3600;
let isTokenError = false;
let isOmitScope = false;
let eventPages = 0;
// eslint-disable-next-line max-params -- Named synthetic request inputs keep the authorization matrix compact.
async function request(
  path: string,
  method = 'GET',
  session = admin,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return worker.fetch(
    new Request(`${origin}${path}`, {
      method,
      headers: {
        Cookie: session,
        Origin: origin,
        'X-Dayframe-Request': '1',
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '192.0.2.10',
        ...headers,
      },
      ...(body !== undefined && {body: JSON.stringify(body)}),
    }),
    env,
  );
}

async function connect() {
  const response = await request('/api/calendar/connect', 'POST');
  const {url} = (await response.json()) as {url: string};
  const state = new URL(url).searchParams.get('state')!;
  const cookie = response.headers.get('Set-Cookie')!.split(';', 1)[0];
  return {
    url,
    path: `/api/calendar/callback?state=${state}&code=synthetic-code`,
    cookie,
  };
}

async function finish() {
  const flow = await connect();
  const callback = await request(flow.path, 'GET', `${admin}; ${flow.cookie}`);
  expect(callback.headers.get('Location')).toBe(
    '/admin/settings?calendar=connected',
  );
  return flow;
}

beforeAll(async () => {
  platform = await administrationRuntime();
  env = {
    DEPLOYMENT_STAGE: 'test',
    ASSETS: {fetch: vi.fn()},
    PHOTOS_ENABLED: 'true',
    PHOTOS: {} as NonNullable<Env['PHOTOS']>,
    ACCESS_TEAM_DOMAIN: testIssuer,
    ACCESS_AUD: testAudience,
    ADMIN_EMAILS: 'one@example.test,two@example.test',
    HOME_NETWORKS: '192.0.2.10',
    ADMINISTRATION: platform.binding,
    GOOGLE_CLIENT_ID: 'synthetic-client',
    GOOGLE_CLIENT_SECRET: 'synthetic-secret',
    GOOGLE_REDIRECT_URI: `${origin}/api/calendar/callback`,
    CALENDAR_TOKEN_KEY: base64url.encode(new Uint8Array(32).fill(5)),
  };
  admin = `CF_Authorization=${await authority.token()}`;
  const credential = await administration(platform.binding, '/credential');
  const {token} = (await credential.json()) as {token: string};
  display = `__Secure-dayframe_display=${token}`;
});
beforeEach(async () => {
  googleCalls = [];
  tokenExpiry = 3600;
  isTokenError = false;
  isOmitScope = false;
  eventPages = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname.endsWith('.cloudflareaccess.com')) {
        return Response.json(authority.jwks);
      }

      googleCalls.push(url.href);
      if (url.pathname === '/token') {
        if (isTokenError) {
          return Response.json(
            {error: 'invalid_grant', secret: 'do-not-expose'},
            {status: 400},
          );
        }

        return Response.json({
          access_token: 'synthetic-access',
          refresh_token: 'synthetic-refresh',
          expires_in: tokenExpiry,
          scope: isOmitScope ? '' : scopes,
        });
      }

      if (url.pathname === '/revoke') {
        return Response.json({});
      }

      expect(init?.headers).toEqual({Authorization: 'Bearer synthetic-access'});
      if (url.pathname.endsWith('/calendarList')) {
        return Response.json({
          items: [
            {id: 'shared@example.test', summary: 'Family'},
            {id: 'other', summary: 'Personal'},
          ],
        });
      }

      if (url.pathname.endsWith('/events')) {
        eventPages++;
        expect(url.pathname).toContain('shared%40example.test');
        expect(url.searchParams.get('singleEvents')).toBe('true');
        expect(url.searchParams.get('timeZone')).toBe('Europe/Paris');
        const start = new Date(Date.now() + 60_000).toISOString();
        const end = new Date(Date.now() + 120_000).toISOString();
        return Response.json({
          items: [
            {
              summary: '<script>Private title</script>',
              start: {dateTime: start},
              end: {dateTime: end},
              description: 'not returned',
              location: 'not returned',
            },
          ],
        });
      }

      throw new Error(`Unexpected provider path ${url.pathname}`);
    }),
  );
  const current = await administration(
    platform.binding,
    '/calendar-state',
    undefined,
    'GET',
  );
  const {revision} = (await current.json()) as {revision: string};
  await administration(platform.binding, '/calendar-state', {
    expected: revision,
    value: {revision: crypto.randomUUID()},
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await platform.runtime.dispose();
});

it('protects every calendar route with role, network and mutation-origin checks', async () => {
  for (const path of [
    '/api/calendar',
    '/api/calendar/connect',
    '/api/calendar/calendars',
    '/api/calendar/callback',
    '/api/calendar/events',
  ]) {
    expect(
      (await request(path, path.endsWith('connect') ? 'POST' : 'GET', ''))
        .status,
    ).toBe(401);
    if (!path.endsWith('events')) {
      expect((await request(path, 'GET', display)).status).toBe(403);
    }
  }

  expect(
    (
      await request('/api/calendar/events', 'GET', display, undefined, {
        'CF-Connecting-IP': '203.0.113.10',
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await request('/api/calendar/connect', 'POST', admin, undefined, {
        Origin: 'https://evil.test',
      })
    ).status,
  ).toBe(403);
  expect((await request('/api/calendar/events', 'POST', display)).status).toBe(
    403,
  );
  expect(googleCalls).toEqual([]);
});
it('uses PKCE, a browser-bound expiring single-use state, and validates granted scopes', async () => {
  const flow = await connect();
  const url = new URL(flow.url);
  expect(url.searchParams.get('scope')).toBe(scopes);
  expect(url.searchParams.get('access_type')).toBe('offline');
  expect(url.searchParams.get('code_challenge_method')).toBe('S256');
  expect((await request(flow.path)).headers.get('Location')).toContain(
    'invalid',
  );
  const wrongAdmin = `CF_Authorization=${await authority.token('two@example.test')}; ${flow.cookie}`;
  expect(
    (await request(flow.path, 'GET', wrongAdmin)).headers.get('Location'),
  ).toContain('invalid');
  expect(googleCalls).toEqual([]);
  isOmitScope = true;
  expect(
    (await request(flow.path, 'GET', `${admin}; ${flow.cookie}`)).headers.get(
      'Location',
    ),
  ).toContain('permission');
  expect(
    (await request(flow.path, 'GET', `${admin}; ${flow.cookie}`)).headers.get(
      'Location',
    ),
  ).toContain('invalid');
  expect(
    ((await (await request('/api/calendar')).json()) as {connected: boolean})
      .connected,
  ).toBe(false);
});
it('selects only a verified calendar, encrypts tokens, caches bounded events and disconnects', async () => {
  await finish();
  const stored = await (
    await administration(platform.binding, '/calendar-state', undefined, 'GET')
  ).text();
  expect(stored).not.toContain('synthetic-refresh');
  expect(stored).not.toContain('synthetic-access');
  const status = await request('/api/calendar');
  expect(status.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await status.text()).not.toContain('token');
  expect(
    (await request('/api/calendar', 'PATCH', admin, {id: 'unshared'})).status,
  ).toBe(400);
  expect(
    (
      await request('/api/calendar', 'PATCH', admin, {
        id: 'shared@example.test',
      })
    ).status,
  ).toBe(200);
  const events = await request('/api/calendar/events', 'GET', display);
  const text = await events.text();
  expect(text).toContain('Private title');
  expect(text).not.toMatch(/synthetic|description|location|shared@example/v);
  await request('/api/calendar/events', 'GET', display);
  expect(eventPages).toBe(1);
  expect((await request('/api/config')).status).toBe(200);
  expect(await (await request('/api/config')).text()).not.toContain('Google');
  await request('/api/calendar', 'DELETE');
  expect(
    (
      (await (
        await request('/api/calendar/events', 'GET', display)
      ).json()) as {connected: boolean}
    ).connected,
  ).toBe(false);
  expect(googleCalls.some((url) => url.endsWith('/revoke'))).toBe(true);
});
it('refreshes access tokens and returns a sanitized reconnect error after revocation', async () => {
  tokenExpiry = 0;
  await finish();
  expect((await request('/api/calendar/calendars')).status).toBe(200);
  expect(googleCalls.filter((url) => url.endsWith('/token'))).toHaveLength(2);
  isTokenError = true;
  const response = await request('/api/calendar/calendars');
  expect(response.status).toBe(409);
  expect(await response.text()).not.toContain('do-not-expose');
});
it('does not let an in-flight callback recreate a disconnected calendar', async () => {
  const flow = await connect();
  const original = fetch;
  const gate = Promise.withResolvers<Response>();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      (input instanceof Request ? input.url : input.toString()).endsWith(
        '/token',
      )
        ? gate.promise
        : original(input, init),
    ),
  );
  const callback = request(flow.path, 'GET', `${admin}; ${flow.cookie}`);
  await vi.waitFor(() => {
    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.anything(),
    );
  });
  await request('/api/calendar', 'DELETE');
  gate.resolve(
    Response.json({
      access_token: 'late',
      refresh_token: 'late',
      expires_in: 3600,
      scope: scopes,
    }),
  );
  expect((await callback).headers.get('Location')).toContain('failed');
  expect(
    ((await (await request('/api/calendar')).json()) as {connected: boolean})
      .connected,
  ).toBe(false);
});
it('uses Paris dates, exclusive all-day ends, ongoing events and DST boundaries', () => {
  expect(
    new Date(
      dayEnd(Date.parse('2026-03-29T00:00:00Z'), 'Europe/Paris'),
    ).toISOString(),
  ).toBe('2026-03-29T22:00:00.000Z');
  expect(
    new Date(
      dayEnd(Date.parse('2026-10-25T00:00:00Z'), 'Europe/Paris'),
    ).toISOString(),
  ).toBe('2026-10-25T23:00:00.000Z');
  const now = Date.parse('2026-10-20T07:00:00Z');
  const items = [
    {
      summary: 'Yesterday',
      start: {date: '2026-10-19'},
      end: {date: '2026-10-20'},
    },
    {
      summary: 'All day',
      start: {date: '2026-10-20'},
      end: {date: '2026-10-21'},
    },
    {
      summary: 'Ongoing',
      start: {dateTime: '2026-10-19T23:00:00Z'},
      end: {dateTime: '2026-10-20T09:00:00Z'},
    },
    {
      summary: 'Cancelled',
      status: 'cancelled',
      start: {date: '2026-10-20'},
      end: {date: '2026-10-21'},
    },
    {
      summary: 'Declined',
      attendees: [{self: true, responseStatus: 'declined'}],
      start: {date: '2026-10-20'},
      end: {date: '2026-10-21'},
    },
    {
      summary: 'Tomorrow',
      start: {dateTime: '2026-10-20T23:00:00Z'},
      end: {dateTime: '2026-10-21T00:00:00Z'},
    },
  ];
  expect(
    normalizeEvents(items, now, 'Europe/Paris').map((event) => event.title),
  ).toEqual(['All day', 'Ongoing']);
});
