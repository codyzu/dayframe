/* eslint-disable unicorn/no-await-expression-member -- Inline response assertions keep the authorization matrix readable. */
import {beforeAll, afterAll, describe, expect, it, vi} from 'vitest';
import {getPlatformProxy} from 'wrangler';
import worker, {type Env} from '../worker/index.ts';
import {
  differenceHash,
  hammingDistance,
  isPhotoMetadata,
  maxPhotoBytes,
  sha256,
  type PhotoMetadata,
} from '../src/lib/photos/contracts.ts';
import {
  administration,
  type AdministrationBinding,
} from '../worker/administration.ts';
import {listPhotos, webpDimensions, type PhotoKV} from '../worker/photos.ts';
import {stripWebpMetadata} from '../src/lib/photos/webp.ts';
import {shufflePhotos} from '../src/lib/photos/slideshow.ts';
import {administrationRuntime} from './fixtures/administration-runtime.ts';
import {
  photoAuthority,
  testAudience,
  testIssuer,
} from './fixtures/photo-auth.ts';

const authority = await photoAuthority();
let display: string;
let platform: Awaited<
  ReturnType<
    typeof getPlatformProxy<{
      PHOTOS: PhotoKV;
      ADMINISTRATION: AdministrationBinding;
    }>
  >
>;
let env: Env;
let administrationPlatform: Awaited<ReturnType<typeof administrationRuntime>>;
let admin: string;
const origin = 'https://example.test';
// Minimal static lossless WebP structural fixture. Real encoding/decoding is tested in browsers.
function image(width = 16, height = 12) {
  const bytes = new Uint8Array(26);
  const view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  view.setUint32(4, 18, true);
  bytes.set(new TextEncoder().encode('WEBPVP8L'), 8);
  view.setUint32(16, 5, true);
  bytes[20] = 0x2f;
  view.setUint32(21, width - 1 + (height - 1) * 16_384, true);
  return bytes.buffer;
}

// eslint-disable-next-line max-params -- Named fixture inputs keep the test matrix compact.
async function request(
  path = '/api/photos',
  method = 'GET',
  token = admin,
  body?: ArrayBuffer,
  extra: Record<string, string> = {},
) {
  return worker.fetch(
    new Request(`${origin}${path}`, {
      method,
      headers: {
        Cookie: token,
        'CF-Connecting-IP': '192.0.2.10',
        Origin: origin,
        'X-Dayframe-Request': '1',
        'Content-Type': 'image/webp',
        'X-Photo-Sha256': 'b'.repeat(64),
        'X-Photo-Dhash': '0'.repeat(16),
        ...extra,
      },
      body,
    }),
    env,
  );
}

beforeAll(async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(authority.jwks)),
  );
  admin = `CF_Authorization=${await authority.token()}`;
  platform = await getPlatformProxy<{
    PHOTOS: PhotoKV;
    ADMINISTRATION: AdministrationBinding;
  }>({
    configPath: 'tests/fixtures/wrangler.photos.jsonc',
    persist: false,
  });
  const kv = platform.env.PHOTOS;
  const binding: PhotoKV = {
    get: async (key, type) => kv.get(key, type),
    getWithMetadata: async (key, type) => kv.getWithMetadata(key, type),
    put: async (key, value, options) => kv.put(key, value, options),
    delete: async (key) => kv.delete(key),
    list: async (options) => kv.list(options),
  };
  administrationPlatform = await administrationRuntime();
  env = {
    ASSETS: {fetch: vi.fn()},
    DEPLOYMENT_STAGE: 'test',
    PHOTOS_ENABLED: 'true',
    PHOTOS: binding,
    ACCESS_TEAM_DOMAIN: testIssuer,
    ACCESS_AUD: testAudience,
    ADMIN_EMAILS: 'one@example.test,two@example.test',
    ADMINISTRATION: administrationPlatform.binding,
    HOME_NETWORKS: '192.0.2.10,2001:db8:1234::/48',
  };
  display = (
    (await (
      await administration(env.ADMINISTRATION!, '/credential')
    ).json()) as {token: string}
  ).token;
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await platform?.dispose();
  await administrationPlatform?.runtime.dispose();
});

describe('photo contracts and hashing', () => {
  it('hashes original bytes with SHA-256 and normalizes a 64-bit dHash', async () => {
    expect(await sha256(new TextEncoder().encode('abc').buffer)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    const rgba = new Uint8ClampedArray(9 * 8 * 4);
    expect(differenceHash(rgba)).toBe('0000000000000000');
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 9; x++) {
        rgba.fill(255 - x * 20, (y * 9 + x) * 4, (y * 9 + x) * 4 + 3);
      }
    }

    expect(differenceHash(rgba)).toBe('ffffffffffffffff');
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hammingDistance('0000000000000001', '0000000000000003')).toBe(1);
    expect(() => hammingDistance('bad', '0'.repeat(16))).toThrow();
  });
  it('parses dimensions and rejects invalid, oversized, animated and metadata-bearing containers', () => {
    expect(webpDimensions(image())).toEqual({width: 16, height: 12});
    expect(() => webpDimensions(image(1601))).toThrow();
    expect(() => webpDimensions(new ArrayBuffer(40))).toThrow();
    const broken = new Uint8Array(image());
    broken[16] = 100;
    expect(() => webpDimensions(broken.buffer)).toThrow();
    for (const chunk of ['EXIF', 'ANIM', 'XMP ', 'ICCP']) {
      const bytes = new Uint8Array(34);
      bytes.set(new Uint8Array(image()));
      bytes.set(new TextEncoder().encode(chunk), 26);
      new DataView(bytes.buffer).setUint32(4, 26, true);
      expect(() => webpDimensions(bytes.buffer)).toThrow();
    }

    expect(isPhotoMetadata({id: 'bad'})).toBe(false);
  });
  it('strips canvas metadata and rejects truncated chunks', () => {
    const bytes = new Uint8Array(34);
    bytes.set(new Uint8Array(image()));
    bytes.set(new TextEncoder().encode('EXIF'), 26);
    new DataView(bytes.buffer).setUint32(4, 26, true);
    const clean = stripWebpMetadata(bytes.buffer);
    expect(clean).toEqual(image());
    expect(() => stripWebpMetadata(bytes.slice(0, 33).buffer)).toThrow();
  });
  it('shuffles without immediate repeats at cycle boundaries', () => {
    expect(shufflePhotos(['a', 'b', 'c'], 'a', () => 0.99)[0]).not.toBe('a');
    expect(new Set(shufflePhotos(['a', 'b', 'c'])).size).toBe(3);
    expect(shufflePhotos(['a'], 'a')).toEqual(['a']);
    expect(shufflePhotos([])).toEqual([]);
  });
});

describe('protected photo API with real local KV', () => {
  it('fails closed without activation, bindings or identity configuration', async () => {
    const response = await worker.fetch(new Request(`${origin}/api/photos`), {
      ...env,
      ACCESS_AUD: undefined,
    });
    expect(response.status).toBe(404);
  });
  it('rejects anonymous reads and forged/expired/non-admin identities', async () => {
    for (const token of [
      '',
      'CF_Authorization=forged',
      `CF_Authorization=${await authority.expired()}`,
      `CF_Authorization=${await authority.token('outsider@example.test')}`,
    ]) {
      expect((await request('/api/photos', 'GET', token)).status).toBe(401);
      expect(
        (await request(`/api/photos/${'b'.repeat(64)}`, 'GET', token)).status,
      ).toBe(401);
    }

    const forged = await request('/api/photos', 'GET', '', undefined, {
      'Cf-Access-Authenticated-User-Email': 'one@example.test',
    });
    expect(forged.status).toBe(401);
    const [header, payload, signature] = (await authority.token()).split(
      '.',
      3,
    );
    expect(
      (
        await request(
          '/api/photos',
          'GET',
          `CF_Authorization=${header}.${payload}.${signature.slice(0, -5)}xxxxx`,
        )
      ).status,
    ).toBe(401);
  });
  it('rejects wrong issuer/audience, missing expiry and future/over-age tokens', async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const claims of [
      {iss: 'https://other.cloudflareaccess.com'},
      {aud: 'other'},
      {exp: undefined},
      {iat: now + 100},
      {iat: now - 7 * 86_400 - 60},
    ]) {
      const token = await authority.token('one@example.test', claims);
      expect(
        (await request('/api/photos', 'GET', `CF_Authorization=${token}`))
          .status,
      ).toBe(401);
    }
  });
  it('accepts a valid week-long session after one hour but still enforces its expiry', async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const [claims, status] of [
      [{iat: now - 2 * 86_400, exp: now + 5 * 86_400}, 200],
      [{iat: now - 3600, exp: now - 1}, 401],
    ] as const) {
      const token = await authority.token('one@example.test', claims);
      expect(
        (await request('/api/session', 'GET', `CF_Authorization=${token}`))
          .status,
      ).toBe(status);
    }
  });
  it('allows two independent verified admins and supports signed header transport', async () => {
    for (const email of ['one@example.test', 'two@example.test']) {
      const response = await request(
        '/api/session',
        'GET',
        `CF_Authorization=${await authority.token(email)}`,
      );
      expect(await response.json()).toEqual({role: 'admin', subject: email});
    }

    expect(
      (
        await request('/api/photos', 'GET', '', undefined, {
          'Cf-Access-Jwt-Assertion': await authority.token(),
        })
      ).status,
    ).toBe(200);
  });
  it('enforces origin/custom header checks and read-only display permissions', async () => {
    for (const headers of [
      {Origin: 'https://evil.test'},
      {Origin: ''},
      {'X-Dayframe-Request': ''},
      {'Sec-Fetch-Site': 'cross-site'},
    ] as Array<Record<string, string>>) {
      expect(
        (await request('/api/photos', 'POST', admin, image(), headers)).status,
      ).toBe(403);
    }

    const token = `__Secure-dayframe_display=${display}`;
    expect((await request('/api/photos', 'GET', token)).status).toBe(200);
    for (const method of ['POST', 'DELETE', 'PATCH']) {
      expect((await request('/api/photos', method, token)).status).toBe(403);
    }

    const response = await request(
      '/api/session/display',
      'POST',
      '',
      undefined,
      {Authorization: `Bearer ${display}`},
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain(
      'Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=',
    );
    expect(
      (
        await request('/api/session/display', 'POST', '', undefined, {
          Authorization: 'Bearer bad',
        })
      ).status,
    ).toBe(401);
    const revoked = await worker.fetch(
      new Request(`${origin}/api/photos`, {headers: {Cookie: token}}),
      {...env, HOME_NETWORKS: '192.0.2.11'},
    );
    expect(revoked.status).toBe(401);
  });
  it('rejects invalid metadata, MIME, dimensions and oversized streams', async () => {
    for (const headers of [
      {'X-Photo-Sha256': 'bad'},
      {'X-Photo-Dhash': 'bad'},
    ] as Array<Record<string, string>>) {
      expect(
        (await request('/api/photos', 'POST', admin, image(), headers)).status,
      ).toBe(400);
    }

    expect(
      (
        await request('/api/photos', 'POST', admin, image(), {
          'Content-Type': 'image/jpeg',
        })
      ).status,
    ).toBe(415);
    expect(
      (await request('/api/photos', 'POST', admin, image(1601))).status,
    ).toBe(400);
    expect(
      (
        await request(
          '/api/photos',
          'POST',
          admin,
          new ArrayBuffer(maxPhotoBytes + 1),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await request('/api/photos', 'POST', admin, image(), {
          'Content-Length': String(maxPhotoBytes + 1),
        })
      ).status,
    ).toBe(413);
  });
  it('uploads idempotently, lists metadata without binaries, serves protected images, and deletes safely', async () => {
    const first = await request('/api/photos', 'POST', admin, image());
    expect(first.status).toBe(201);
    const result = (await first.json()) as {photo: PhotoMetadata};
    expect(result.photo.uploadedBy).toBe('one@example.test');
    expect(isPhotoMetadata(result.photo)).toBe(true);
    const retry = await request('/api/photos', 'POST', admin, image());
    expect(await retry.json()).toMatchObject({
      duplicate: true,
      photo: result.photo,
    });
    const getSpy = vi.spyOn(env.PHOTOS!, 'getWithMetadata');
    const list = await request();
    expect(await list.json()).toMatchObject({
      photos: [result.photo],
      cursor: null,
      approximate: true,
    });
    expect(getSpy).not.toHaveBeenCalled();
    getSpy.mockRestore();
    const displayCatalog = await request(
      '/api/photos',
      'GET',
      `__Secure-dayframe_display=${display}`,
    );
    expect(JSON.stringify(await displayCatalog.json())).not.toContain(
      'uploadedBy',
    );
    const photoPath = `/api/photos/${result.photo.id}`;
    const photo = await request(photoPath);
    expect(photo.headers.get('Cache-Control')).toBe('private, no-store');
    expect(photo.headers.get('Cross-Origin-Resource-Policy')).toBe(
      'same-origin',
    );
    expect(await photo.arrayBuffer()).toEqual(image());
    expect(await (await request(photoPath, 'HEAD')).text()).toBe('');
    expect((await request(photoPath, 'DELETE')).status).toBe(200);
    expect((await request(photoPath, 'DELETE')).status).toBe(200);
    expect((await request(photoPath)).status).toBe(404);
  });
  it('preserves existing content on quota failures and handles invalid catalog/cursors', async () => {
    const put = vi
      .spyOn(env.PHOTOS!, 'put')
      .mockRejectedValueOnce(new Error('quota'));
    expect((await request('/api/photos', 'POST', admin, image())).status).toBe(
      503,
    );
    put.mockRestore();
    expect((await request('/api/photos?cursor=%3Cbad%3E')).status).toBe(400);
    const list = vi.spyOn(env.PHOTOS!, 'list').mockResolvedValueOnce({
      keys: [{name: 'photo:bad', metadata: {}}],
      list_complete: true,
    });
    expect((await request()).status).toBe(503);
    list.mockRestore();
  });
  it('carries opaque pagination even when an intermediate page is empty', async () => {
    const list = vi
      .spyOn(env.PHOTOS!, 'list')
      .mockResolvedValueOnce({keys: [], list_complete: false, cursor: 'next'});
    expect(await listPhotos(env.PHOTOS!)).toMatchObject({
      photos: [],
      cursor: 'next',
    });
    list.mockRestore();
  });
});

describe('M4 administration with real SQLite Durable Object storage', () => {
  it('authorizes every configuration and credential route by role and origin', async () => {
    for (const path of ['/api/config', '/api/config/display', '/api/display']) {
      expect((await request(path, 'GET', '')).status).toBe(401);
      expect((await request(path, 'GET')).status).toBe(200);
      expect(
        (
          await request(path, 'PATCH', '', undefined, {
            Origin: 'https://evil.test',
          })
        ).status,
      ).toBe(403);
    }

    for (const [path, method] of [
      ['/api/config', 'GET'],
      ['/api/config', 'PATCH'],
      ['/api/display', 'GET'],
      ['/api/display', 'POST'],
      ['/api/display', 'DELETE'],
      ['/api/config/display', 'PATCH'],
    ]) {
      expect(
        (await request(path, method, `__Secure-dayframe_display=${display}`))
          .status,
      ).toBe(403);
    }

    const safe = await request(
      '/api/config/display',
      'GET',
      `__Secure-dayframe_display=${display}`,
    );
    expect(safe.status).toBe(200);
    expect(JSON.stringify(await safe.json())).not.toMatch(
      /digest|token|example.test|network|credential/iv,
    );
    expect(safe.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('persists validated settings, applies partial changes, and rejects oversized or malformed data', async () => {
    const patch = async (value: unknown, headers = {}) =>
      request(
        '/api/config',
        'PATCH',
        admin,
        new TextEncoder().encode(JSON.stringify(value)).buffer,
        {'Content-Type': 'application/json', ...headers},
      );
    expect(
      (
        await patch({
          location: 'Test household',
          slideshowIntervalSeconds: 45,
          fit: 'cover',
        })
      ).status,
    ).toBe(200);
    const saved = await request('/api/config');
    expect(await saved.json()).toMatchObject({
      location: 'Test household',
      slideshowIntervalSeconds: 45,
      fit: 'cover',
      timezone: 'Europe/Paris',
    });
    expect(
      await (
        await request(
          '/api/config/display',
          'GET',
          `__Secure-dayframe_display=${display}`,
        )
      ).json(),
    ).toMatchObject({location: 'Test household'});
    for (const invalid of [
      null,
      [],
      {secret: 'no'},
      {timezone: 'invalid/time'},
      {latitude: 91},
      {longitude: -181},
      {slideshowIntervalSeconds: 0},
      {overrideTimeoutSeconds: 29},
      {fit: 'stretch'},
      {
        schedule: [
          {start: '21:00', end: '06:00', mode: 'night'},
          {start: '05:59', end: '10:00', mode: 'morning'},
        ],
      },
    ]) {
      expect((await patch(invalid)).status).toBe(400);
    }

    expect(
      (await patch({location: 'x'}, {'Content-Type': 'text/plain'})).status,
    ).toBe(415);
    expect((await patch({location: 'x'.repeat(9000)})).status).toBe(413);
    expect(await (await request('/api/config')).json()).toMatchObject({
      location: 'Test household',
    });
  });

  it('rejects off-network, missing and malformed addresses on every display read and exchange', async () => {
    const token = `__Secure-dayframe_display=${display}`;
    for (const ip of [
      '',
      '192.0.2.11',
      '2001:db8:9999::1',
      '192.0.2.010',
      '2001:db8:1234:::1',
    ]) {
      for (const path of [
        '/api/session',
        '/api/config/display',
        '/api/photos',
        `/api/photos/${'b'.repeat(64)}`,
      ]) {
        expect(
          (
            await request(path, 'GET', token, undefined, {
              'CF-Connecting-IP': ip,
            })
          ).status,
        ).toBe(401);
      }

      expect(
        (
          await request('/api/session/display', 'POST', '', undefined, {
            Authorization: `Bearer ${display}`,
            'CF-Connecting-IP': ip,
          })
        ).status,
      ).toBe(401);
    }

    for (const ip of [
      '2001:db8:1234::1',
      '2001:0db8:1234:ffff:0000:0000:0000:0001',
    ]) {
      expect(
        (
          await request('/api/photos', 'GET', token, undefined, {
            'CF-Connecting-IP': ip,
          })
        ).status,
      ).toBe(200);
    }

    // Admin recovery does not depend on the household network.
    expect(
      (
        await request('/api/config', 'GET', admin, undefined, {
          'CF-Connecting-IP': '203.0.113.9',
        })
      ).status,
    ).toBe(200);
  });

  it('rotates and revokes credentials without stale KV authorization, and never returns stored hashes', async () => {
    const old = display;
    const issued = await request('/api/display', 'POST');
    const result = (await issued.json()) as {token: string; expiresAt: number};
    expect(result.token).toMatch(/^[0-9a-f]{64}$/v);
    expect(result.token).not.toBe(old);
    expect(
      JSON.stringify(await (await request('/api/display')).json()),
    ).not.toMatch(/token|digest/v);
    expect(
      (await request('/api/photos', 'GET', `__Secure-dayframe_display=${old}`))
        .status,
    ).toBe(401);
    display = result.token;
    expect(
      (
        await request(
          '/api/photos',
          'GET',
          `__Secure-dayframe_display=${display}`,
        )
      ).status,
    ).toBe(200);
    expect((await request('/api/display', 'DELETE')).status).toBe(200);
    expect(
      (
        await request(
          '/api/photos',
          'GET',
          `__Secure-dayframe_display=${display}`,
        )
      ).status,
    ).toBe(401);
    expect(
      (
        await request('/api/session/display', 'POST', '', undefined, {
          Authorization: `Bearer ${display}`,
        })
      ).status,
    ).toBe(401);
    // Logout clears a stale/revoked cookie too.
    const logout = await request(
      '/api/session',
      'DELETE',
      `__Secure-dayframe_display=${display}`,
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('fails closed during administration storage outages while admin photo access remains independent', async () => {
    const broken = {
      ...env,
      ADMINISTRATION: {
        idFromName: () => 'test',
        get: () => ({
          async fetch() {
            throw new Error('quota');
          },
        }),
      },
    };
    const response = await worker.fetch(
      new Request(`${origin}/api/photos`, {
        headers: {
          Cookie: `__Secure-dayframe_display=${'a'.repeat(64)}`,
          'CF-Connecting-IP': '192.0.2.10',
        },
      }),
      broken,
    );
    expect(response.status).toBe(503);
    expect(
      (
        await worker.fetch(
          new Request(`${origin}/api/photos`, {headers: {Cookie: admin}}),
          broken,
        )
      ).status,
    ).toBe(200);
  });
});
