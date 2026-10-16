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
import {listPhotos, webpDimensions, type PhotoKV} from '../worker/photos.ts';
import {stripWebpMetadata} from '../src/lib/photos/webp.ts';
import {shufflePhotos} from '../src/lib/photos/slideshow.ts';
import {
  photoAuthority,
  testAudience,
  testIssuer,
} from './fixtures/photo-auth.ts';

const authority = await photoAuthority();
const display = 'a'.repeat(64);
let platform: Awaited<ReturnType<typeof getPlatformProxy<{PHOTOS: PhotoKV}>>>;
let env: Env;
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
  platform = await getPlatformProxy<{PHOTOS: PhotoKV}>({
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
  env = {
    ASSETS: {fetch: vi.fn()},
    DEPLOYMENT_STAGE: 'test',
    PHOTOS_ENABLED: 'true',
    PHOTOS: binding,
    ACCESS_TEAM_DOMAIN: testIssuer,
    ACCESS_AUD: testAudience,
    ADMIN_EMAILS: 'one@example.test,two@example.test',
    DISPLAY_TOKEN_SHA256: await sha256(
      new TextEncoder().encode(display).buffer,
    ),
  };
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await platform?.dispose();
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
      {iat: now - 7200},
    ]) {
      const token = await authority.token('one@example.test', claims);
      expect(
        (await request('/api/photos', 'GET', `CF_Authorization=${token}`))
          .status,
      ).toBe(401);
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
      'Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=86400',
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
      {...env, DISPLAY_TOKEN_SHA256: '0'.repeat(64)},
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
