/* eslint-disable unicorn/no-await-expression-member, unicorn/max-nested-calls -- Inline response and timestamp assertions keep security cases readable. */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- The unused photo binding is an explicit empty test double; no photo route is called. */
import {beforeAll, afterAll, beforeEach, expect, it, vi} from 'vitest';
import {base64url} from 'jose';
import worker, {type Env} from '../worker/index.ts';
import {administration} from '../worker/administration.ts';
import {normalizeEvents} from '../worker/calendar.ts';
import {dayEnd, localDate, type Agenda} from '../src/lib/calendar/contracts.ts';
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
let eventsPerCalendar = 1;
let shouldIncludeTomorrow = false;
let isObservanceUnavailable = false;
let isRoutineUnavailable = false;
let isMassageUnavailable = false;
const welcomePath = '/api/calendar/massage-welcome';
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
  eventsPerCalendar = 1;
  shouldIncludeTomorrow = false;
  isObservanceUnavailable = false;
  isRoutineUnavailable = false;
  isMassageUnavailable = false;
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
            {id: 'routine-source', summary: 'Routines'},
            {id: 'observances', summary: 'Fêtes du foyer'},
            {id: 'observances-two', summary: 'Autres fêtes'},
          ],
        });
      }

      if (url.pathname.endsWith('/events')) {
        eventPages++;
        if (url.searchParams.get('timeZone') === 'UTC') {
          expect(url.pathname).toBe('/calendar/v3/calendars/other/events');
          expect(url.searchParams.get('fields')).not.toMatch(
            /summary|description|location/v,
          );
          if (isMassageUnavailable) {
            return Response.json(
              {error: 'Private provider error'},
              {status: 503},
            );
          }

          const now =
            Date.parse(url.searchParams.get('timeMin')!) + 30 * 60_000;
          const timed = (startMinutes: number, endMinutes: number) => ({
            summary: 'Private appointment',
            start: {
              dateTime: new Date(now + startMinutes * 60_000).toISOString(),
            },
            end: {dateTime: new Date(now + endMinutes * 60_000).toISOString()},
          });
          return Response.json({
            items: [
              timed(-27, -10),
              timed(5, 65),
              timed(46, 90),
              {...timed(0, 60), status: 'cancelled'},
              {start: {date: '2026-10-16'}, end: {date: '2026-10-17'}},
            ],
          });
        }

        if (url.pathname === '/calendar/v3/calendars/observances-two/events') {
          expect(url.searchParams.get('fields')).toBe(
            'items(status,summary,start(date),end(date)),nextPageToken',
          );
          const now = Date.now();
          const timezone = 'Europe/Paris';
          const start = {date: localDate(now, timezone)};
          const end = {date: localDate(dayEnd(now, timezone), timezone)};
          return Response.json({
            items: [
              {start, end, summary: 'Autre fête'},
              {start, end, summary: 'FÊTE OBSERVÉE'},
            ],
          });
        }

        if (url.pathname === '/calendar/v3/calendars/observances/events') {
          expect(url.searchParams.get('fields')).toBe(
            'items(status,summary,start(date),end(date)),nextPageToken',
          );
          if (isObservanceUnavailable) {
            return Response.json(
              {error: 'private provider response'},
              {status: 403},
            );
          }

          const now = Date.now();
          const timezone = 'Europe/Paris';
          const today = localDate(now, timezone);
          const tomorrow = localDate(dayEnd(now, timezone), timezone);
          const afterTomorrow = localDate(
            dayEnd(dayEnd(now, timezone), timezone),
            timezone,
          );
          const allDay = {start: {date: today}, end: {date: tomorrow}};
          return Response.json({
            items: [
              {...allDay, summary: 'Fête annulée', status: 'cancelled'},
              {
                summary: 'Événement horaire',
                start: {dateTime: new Date(now + 60_000).toISOString()},
                end: {dateTime: new Date(now + 120_000).toISOString()},
              },
              {
                summary: 'Demain',
                start: {date: tomorrow},
                end: {date: afterTomorrow},
              },
              {
                ...allDay,
                start: {date: '0000-02-30'},
                summary: 'Date invalide',
              },
              {
                ...allDay,
                summary: 'Fête observée',
                status: 'tentative',
                description: 'private provider response',
              },
              {...allDay, summary: '  FÊTE OBSERVÉE  '},
              {...allDay, summary: 'Commémoration', status: 'confirmed'},
              {...allDay, summary: 'En plus'},
            ],
          });
        }

        expect(url.pathname).toMatch(
          /shared%40example.test|other|routine-source/v,
        );
        expect(url.searchParams.get('fields')?.includes('description')).toBe(
          url.pathname !== '/calendar/v3/calendars/other/events',
        );
        expect(url.searchParams.get('singleEvents')).toBe('true');
        expect(url.searchParams.get('timeZone')).toBe('Europe/Paris');
        expect(url.searchParams.get('timeMax')).toBe(
          new Date(
            dayEnd(dayEnd(Date.now(), 'Europe/Paris'), 'Europe/Paris'),
          ).toISOString(),
        );
        if (
          isRoutineUnavailable &&
          url.pathname === '/calendar/v3/calendars/routine-source/events'
        ) {
          return Response.json(
            {error: 'private routine provider response'},
            {status: 403},
          );
        }

        const now = Date.parse(url.searchParams.get('timeMin')!);
        const start = new Date(now + 60_000).toISOString();
        const end = new Date(now + 120_000).toISOString();
        return Response.json({
          items: [
            ...Array.from({length: eventsPerCalendar}, () => ({
              summary: '<script>Private title</script>',
              start: {dateTime: start},
              end: {dateTime: end},
              description: 'Private directions<br><b>#M&eacute;t&eacute;o</b>',
              location: 'not returned',
            })),
            ...(shouldIncludeTomorrow
              ? Array.from({length: 4}, (_, index) => ({
                  summary: `Tomorrow ${index}`,
                  start: {
                    dateTime: new Date(
                      dayEnd(Date.now(), 'Europe/Paris') +
                        (index + 8) * 3_600_000,
                    ).toISOString(),
                  },
                  end: {
                    dateTime: new Date(
                      dayEnd(Date.now(), 'Europe/Paris') +
                        (index + 9) * 3_600_000,
                    ).toISOString(),
                  },
                }))
              : []),
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
  expect((await request(welcomePath, 'GET', '')).status).toBe(401);
  expect(
    (
      await request(welcomePath, 'GET', display, undefined, {
        'CF-Connecting-IP': '203.0.113.10',
      })
    ).status,
  ).toBe(401);
  expect((await request(welcomePath, 'PATCH', display, true)).status).toBe(403);
  expect((await request(welcomePath, 'POST', display)).status).toBe(403);
  expect(
    (
      await request(welcomePath, 'POST', admin, undefined, {
        Origin: 'https://evil.test',
      })
    ).status,
  ).toBe(403);
  expect(googleCalls).toEqual([]);
});

it('uses only Massages timing and dismisses current overlapping windows for authorized frames', async () => {
  await finish();
  expect((await request(welcomePath, 'PATCH', admin, true)).status).toBe(409);
  expect(
    (
      await request('/api/calendar', 'PATCH', admin, {
        id: 'shared@example.test',
        massageId: 'other',
      })
    ).status,
  ).toBe(200);
  expect(await (await request(welcomePath, 'GET', display)).json()).toEqual({
    enabled: false,
  });
  expect((await request(welcomePath, 'PATCH', admin, true)).status).toBe(200);
  isMassageUnavailable = true;
  expect(await (await request(welcomePath, 'GET', display)).json()).toEqual({
    enabled: true,
  });
  isMassageUnavailable = false;
  const response = await request(welcomePath, 'GET', display);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  const value = (await response.json()) as {
    enabled: boolean;
    snapshot: {fetchedAt: number; windows: number[][]};
  };
  const {fetchedAt} = value.snapshot;
  const upcoming = [fetchedAt + 36 * 60_000, fetchedAt + 120 * 60_000];
  expect(value).toEqual({
    enabled: true,
    snapshot: {
      fetchedAt,
      windows: [
        [fetchedAt - 37 * 60_000, fetchedAt + 20 * 60_000],
        [fetchedAt - 5 * 60_000, fetchedAt + 95 * 60_000],
        upcoming,
      ],
    },
  });
  expect((await request(welcomePath, 'POST')).status).toBe(200);
  expect(await (await request(welcomePath, 'GET', display)).json()).toEqual({
    enabled: true,
    snapshot: {fetchedAt, windows: [upcoming]},
  });
  expect((await request('/api/calendar', 'DELETE')).status).toBe(200);
  expect(await (await request(welcomePath, 'GET', display)).json()).toEqual({
    enabled: true,
  });
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
  ).toEqual(['All day', 'Ongoing', 'Tomorrow']);
});

it('recognizes standalone weather tags in plain text and formatted descriptions', () => {
  const start = '2026-10-20T08:00:00Z';
  const end = '2026-10-20T09:00:00Z';
  const cases = [
    ['Bring a raincoat (#WeAtHeR).', true],
    ['#METEO', true],
    ['météo<br><b>#météo</b>', true],
    ['<b>#wea</b>ther', true],
    ['<div>&#35;me\u{301}te&#x301;o&nbsp;</div>', true],
    ['<a title="#meteo">météo</a><!-- #weather -->', false],
    ['x<b>#weather</b> u<!-- comment -->#meteo', false],
    ['https://example.test/#weather #meteoscope #weather_today', false],
    ['x#weather ##meteo #weather-report', false],
    [undefined, false],
  ] as const;
  for (const [description, tagged] of cases) {
    const [event] = normalizeEvents(
      [{description, start: {dateTime: start}, end: {dateTime: end}}],
      Date.parse(start),
      'Europe/Paris',
      true,
    );
    expect(event.weatherRelevant, description).toBe(tagged ? true : undefined);
  }

  const [allDay] = normalizeEvents(
    [
      {
        description: '#meteo',
        start: {date: '2026-10-20'},
        end: {date: '2026-10-21'},
      },
    ],
    Date.parse(start),
    'Europe/Paris',
    true,
  );
  expect(allDay.weatherRelevant).toBeUndefined();
});

it('validates appointment sources, retains Routines for older settings clients and clears its cached events when removed', async () => {
  eventsPerCalendar = 4;
  await finish();
  for (const massageId of ['unshared', 'shared@example.test', 42]) {
    expect(
      (
        await request('/api/calendar', 'PATCH', admin, {
          id: 'shared@example.test',
          massageId,
        })
      ).status,
    ).toBe(400);
  }

  const selection = {id: 'shared@example.test', massageId: 'other'};
  for (const routineId of ['unshared', selection.id, selection.massageId, 42]) {
    const response = await request('/api/calendar', 'PATCH', admin, {
      ...selection,
      routineId,
    });
    expect(response.status).toBe(400);
  }

  const routineId = 'routine-source';
  const status = await request('/api/calendar', 'PATCH', admin, {
    ...selection,
    routineId,
    observanceId: routineId,
  });
  expect(status.status).toBe(400);
  expect(
    (
      await request('/api/calendar', 'PATCH', admin, {
        ...selection,
        routineId,
      })
    ).status,
  ).toBe(200);
  await request('/api/calendar', 'PATCH', admin, selection);
  expect(await (await request('/api/calendar')).json()).toMatchObject({
    routineSelected: {id: routineId, name: 'Routines'},
  });
  const first = await request('/api/calendar/events', 'GET', display);
  const firstBody = await first.text();
  expect(firstBody).not.toMatch(
    /routine-source|Private directions|description|t&eacute;/v,
  );
  const stored = await (
    await administration(platform.binding, '/calendar-state', undefined, 'GET')
  ).text();
  expect(stored).not.toMatch(/Private directions|description|t&eacute;/v);
  const body = JSON.parse(firstBody) as Agenda;
  expect(body.massageConnected).toBe(true);
  expect(body.routineConnected).toBe(true);
  expect(body.events.map((event) => event.calendar)).toEqual([
    'family',
    'family',
    'family',
    'massages',
    'massages',
    'massages',
    'routines',
    'routines',
    'routines',
  ]);
  expect(
    body.events
      .filter((event) => event.weatherRelevant)
      .map((event) => event.calendar),
  ).toEqual(['family', 'family', 'family', 'routines', 'routines', 'routines']);
  expect(eventPages).toBe(3);
  await request('/api/calendar/events', 'GET', display);
  expect(eventPages).toBe(3);
  await request('/api/calendar', 'PATCH', admin, {
    ...selection,
    routineId: '',
  });
  const next = await request('/api/calendar/events', 'GET', display);
  const nextBody = (await next.json()) as Agenda;
  expect(nextBody.routineConnected).toBe(false);
  expect(nextBody.events.map((event) => event.calendar)).not.toContain(
    'routines',
  );
  expect(eventPages).toBe(5);
});

it('fetches and caches both days with independent per-day source limits', async () => {
  shouldIncludeTomorrow = true;
  eventsPerCalendar = 4;
  await finish();
  await request('/api/calendar', 'PATCH', admin, {
    id: 'shared@example.test',
    massageId: 'other',
    routineId: 'routine-source',
  });
  const first = await request('/api/calendar/events', 'GET', display);
  const body = (await first.json()) as {events: Array<{title: string}>};
  expect(body.events).toHaveLength(18);
  expect(
    body.events.filter((event) => event.title.startsWith('Tomorrow')),
  ).toHaveLength(9);
  await request('/api/calendar/events', 'GET', display);
  expect(eventPages).toBe(3);
  // A cache created before weather tags were read must refresh immediately.
  const state = (await (
    await administration(platform.binding, '/calendar-state', undefined, 'GET')
  ).json()) as {revision: string; cache: {weatherTagsRead?: true}};
  delete state.cache.weatherTagsRead;
  await administration(platform.binding, '/calendar-state', {
    expected: state.revision,
    value: {...state, revision: crypto.randomUUID()},
  });
  await request('/api/calendar/events', 'GET', display);
  expect(eventPages).toBe(6);
});

it('keeps appointments available and withholds provider details when Routines cannot be read', async () => {
  isRoutineUnavailable = true;
  await finish();
  await request('/api/calendar', 'PATCH', admin, {
    id: 'shared@example.test',
    massageId: 'other',
    routineId: 'routine-source',
  });
  const response = await request('/api/calendar/events', 'GET', display);
  const responseBody = await response.text();
  expect(responseBody).not.toContain('private routine provider response');
  const body = JSON.parse(responseBody) as Agenda;
  expect(response.status).toBe(200);
  expect(body.routineUnavailable).toBe(true);
  expect(body.events.map((event) => event.calendar)).toEqual([
    'family',
    'massages',
  ]);
  await request('/api/calendar/events', 'GET', display);
  expect(eventPages).toBe(3);
});

it('merges two bounded all-day observance calendars and isolates source failures', async () => {
  const selection = {id: 'shared@example.test', massageId: 'other'};
  await finish();
  for (const observanceId of [
    'unshared',
    selection.id,
    selection.massageId,
    42,
  ]) {
    const response = await request('/api/calendar', 'PATCH', admin, {
      ...selection,
      observanceId,
    });
    expect(response.status).toBe(400);
  }

  const duplicate = await request('/api/calendar', 'PATCH', admin, {
    ...selection,
    observanceId: 'observances',
    secondObservanceId: 'observances',
  });
  expect(duplicate.status).toBe(400);

  const select = async (observanceId?: string, secondObservanceId?: string) => {
    const response = await request('/api/calendar', 'PATCH', admin, {
      ...selection,
      observanceId,
      secondObservanceId,
    });
    expect(response.status).toBe(200);
  };

  await select('observances');
  // Legacy settings clients that omit this new field must preserve the choice.
  await select();
  const response = await request('/api/calendar/events', 'GET', display);
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  const body = (await response.json()) as Agenda;
  const now = body.fetchedAt;
  const timezone = 'Europe/Paris';
  const today = localDate(now, timezone);
  const tomorrow = localDate(dayEnd(now, timezone), timezone);
  expect(body.events.map((event) => event.calendar)).toEqual([
    'family',
    'massages',
  ]);
  expect(body.observances).toEqual([
    {title: 'Fête observée', start: today, end: tomorrow, tentative: true},
    {title: 'Commémoration', start: today, end: tomorrow},
  ]);
  await request('/api/calendar/events', 'GET', display);
  expect(eventPages).toBe(3);

  await select('observances', 'observances-two');
  await select();
  expect(await (await request('/api/calendar')).json()).toMatchObject({
    observanceSelected: {id: 'observances'},
    secondObservanceSelected: {id: 'observances-two'},
  });
  const both = (await (
    await request('/api/calendar/events', 'GET', display)
  ).json()) as Agenda;
  expect(both.observances).toEqual([
    {title: 'FÊTE OBSERVÉE', start: today, end: tomorrow},
    {title: 'Autre fête', start: today, end: tomorrow},
  ]);
  expect(JSON.stringify(both)).not.toContain('observances-two');

  isObservanceUnavailable = true;
  await select('observances');
  const failed = (await (
    await request('/api/calendar/events', 'GET', display)
  ).json()) as Agenda;
  expect(failed.observanceUnavailable).toBe(true);
  expect(failed.observances?.map(({title}) => title)).toEqual([
    'Autre fête',
    'FÊTE OBSERVÉE',
  ]);
  expect(failed.events).toHaveLength(2);
  expect(JSON.stringify(failed)).not.toContain('private provider response');

  const pagesBeforeClear = eventPages;
  await select('', '');
  const cleared = (await (
    await request('/api/calendar/events', 'GET', display)
  ).json()) as Agenda;
  expect(cleared.observances).toBeUndefined();
  expect(cleared.observanceUnavailable).toBeUndefined();
  expect(eventPages - pagesBeforeClear).toBe(2);
});
