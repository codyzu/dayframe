/* eslint-disable unicorn/no-await-expression-member -- Keep authorization assertions beside each request. */
import {afterAll, beforeAll, beforeEach, expect, it, vi} from 'vitest';
import worker, {type Env} from '../worker/index.ts';
import {officialCalendar} from '../worker/school-calendar.ts';
import {administration} from '../worker/administration.ts';
import {emptyPlanning} from '../src/lib/dashboard/day-planning.ts';
import {administrationRuntime} from './fixtures/administration-runtime.ts';
import {
  photoAuthority,
  testAudience,
  testIssuer,
} from './fixtures/photo-auth.ts';

const authority = await photoAuthority();
const now = Date.now();
const date = new Date(now).toISOString().slice(0, 10);
const year = Number(date.slice(0, 4));
const startYear = Number(date.slice(5, 7)) >= 9 ? year : year - 1;
let platform: Awaited<ReturnType<typeof administrationRuntime>>;
let env: Env;
let admin: string;
let display: string;
let calls = 0;
let isOffline = false;
let isRedirect = false;
let isMalformed = false;
const request = async (
  cookie: string,
  extra: Record<string, string> = {},
  method = 'GET',
) =>
  worker.fetch(
    new Request('https://example.test/api/day-context', {
      method,
      headers: {
        Cookie: cookie,
        'CF-Connecting-IP': '192.0.2.10',
        Origin: 'https://example.test',
        'X-Dayframe-Request': '1',
        ...extra,
      },
    }),
    env,
  );

beforeAll(async () => {
  platform = await administrationRuntime();
  env = {
    DEPLOYMENT_STAGE: 'test',
    ASSETS: {fetch: vi.fn()},
    PHOTOS_ENABLED: 'true',
    PHOTOS: {
      get: vi.fn(),
      getWithMetadata: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    },
    ACCESS_TEAM_DOMAIN: testIssuer,
    ACCESS_AUD: testAudience,
    ADMIN_EMAILS: 'one@example.test',
    HOME_NETWORKS: '192.0.2.10',
    ADMINISTRATION: platform.binding,
  };
  admin = `CF_Authorization=${await authority.token()}`;
  const credential = await administration(platform.binding, '/credential');
  const body = (await credential.json()) as {token: string};
  display = `__Secure-dayframe_display=${body.token}`;
});
beforeEach(async () => {
  calls = 0;
  isOffline = false;
  isRedirect = false;
  isMalformed = false;
  await administration(
    platform.binding,
    '/config',
    {planning: {...emptyPlanning, schoolCalendar: true}},
    'PATCH',
  );
  await administration(
    platform.binding,
    `/school-calendar/${year}`,
    null,
    'PATCH',
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname.endsWith('.cloudflareaccess.com')) {
        return Response.json(authority.jwks);
      }

      calls++;
      expect(init?.redirect).toBe('manual');
      if (isOffline) {
        throw new TypeError('Offline');
      }

      if (isRedirect) {
        return new Response(null, {
          status: 302,
          headers: {Location: 'https://untrusted.test'},
        });
      }

      if (isMalformed) {
        return Response.json({results: []});
      }

      if (url.hostname === 'data.education.gouv.fr') {
        return Response.json({
          total_count: 1,
          results: [
            {
              description: 'Vacances synthétiques',
              population: '-',
              start_date: `${startYear}-10-16T22:00:00Z`,
              end_date: `${startYear}-11-01T23:00:00Z`,
              location: 'Grenoble',
              zones: 'Zone A',
              annee_scolaire: `${startYear}-${startYear + 1}`,
            },
          ],
        });
      }

      if (url.hostname === 'calendrier.api.gouv.fr') {
        return Response.json(
          Object.fromEntries(
            Array.from({length: 11}, (_, index) => [
              `${year}-${String(index + 1).padStart(2, '0')}-01`,
              'Férié synthétique',
            ]),
          ),
        );
      }

      throw new Error('Unexpected provider');
    }),
  );
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await platform.runtime.dispose();
});

it('protects the day-context endpoint and performs no provider requests for anonymous, off-home or mutation requests', async () => {
  expect((await request('')).status).toBe(401);
  expect(
    (await request(display, {'CF-Connecting-IP': '203.0.113.2'})).status,
  ).toBe(401);
  expect((await request(display, {}, 'POST')).status).toBe(403);
  expect((await request(admin, {}, 'PATCH')).status).toBe(405);
  expect(calls).toBe(0);
  const result = await request(admin, {'CF-Connecting-IP': '203.0.113.2'});
  expect(result.status).toBe(200);
  expect(result.headers.get('Cache-Control')).toContain('no-store');
  expect(calls).toBe(2);
  expect((await request(display)).status).toBe(200);
  expect(calls).toBe(2);
});
it('refreshes once daily, retains dated cache during provider failure and expires it after 30 days', async () => {
  const initial = await officialCalendar(platform.binding, now);
  expect(calls).toBe(2);
  expect(await officialCalendar(platform.binding, now + 60_000)).toEqual(
    initial,
  );
  expect(calls).toBe(2);
  isOffline = true;
  expect(
    await officialCalendar(platform.binding, now + 2 * 86_400_000),
  ).toEqual(initial);
  await expect(
    officialCalendar(platform.binding, now + 31 * 86_400_000),
  ).rejects.toThrow('Calendar unavailable');
});
it('rejects redirects/malformed feeds, and opt-out does not call government providers', async () => {
  isRedirect = true;
  expect((await request(admin)).status).toBe(503);
  isRedirect = false;
  isMalformed = true;
  expect((await request(admin)).status).toBe(503);
  await administration(
    platform.binding,
    '/config',
    {planning: emptyPlanning},
    'PATCH',
  );
  calls = 0;
  expect(await (await request(display)).json()).toEqual({calendar: null});
  expect(calls).toBe(0);
});
