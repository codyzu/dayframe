import {
  hashPattern,
  isPhotoMetadata,
  shaPattern,
  type PhotoMetadata,
} from '../src/lib/photos/contracts.ts';
import {adminApi} from './admin-api.ts';
import {calendarApi, type CalendarEnv} from './calendar.ts';
import {failure, privateJson} from './private-response.ts';
import {
  authenticate,
  displayCookie,
  displaySession,
  type AuthEnv,
  type Identity,
} from './auth/access.ts';
import {
  listPhotos,
  PhotoError,
  readBounded,
  webpDimensions,
  type PhotoKV,
} from './photos.ts';

export type PhotoEnv = AuthEnv &
  CalendarEnv & {PHOTOS_ENABLED?: string; PHOTOS?: PhotoKV};
export async function photoApi(
  request: Request,
  env: PhotoEnv,
): Promise<Response> {
  if (!hasPhotoConfiguration(env)) {
    return Response.json(
      {error: {code: 'NOT_FOUND', message: 'Cette API est indisponible.'}},
      {status: 404, headers: {'Cache-Control': 'no-store'}},
    );
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const isMutation = !['GET', 'HEAD'].includes(request.method);
  if (isMutation && !hasMutationOrigin(request, url)) {
    return failure(403, 'ORIGIN_REJECTED', 'Origine de la requête refusée.');
  }

  try {
    if (path === '/api/session/display' && request.method === 'POST') {
      if (url.protocol !== 'https:') {
        return failure(
          400,
          'HTTPS_REQUIRED',
          'Une connexion HTTPS est nécessaire.',
        );
      }

      const token = request.headers
        .get('Authorization')
        ?.replace(/^Bearer /v, '');
      const session = await displaySession(request, token, env);
      const maxAge = Math.max(
        0,
        Math.floor(((session.expiresAt ?? 0) - Date.now()) / 1000),
      );
      return session.valid
        ? privateJson({role: 'display'}, 200, {
            'Set-Cookie': `${displayCookie}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`,
          })
        : failure(401, 'UNAUTHORIZED', 'Accès privé requis.');
    }

    if (path === '/api/session' && request.method === 'DELETE') {
      return privateJson({ok: true}, 200, {
        'Set-Cookie': `${displayCookie}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`,
      });
    }

    const identity = await authenticate(request, env);
    if (!identity) {
      return failure(
        401,
        'UNAUTHORIZED',
        'Connectez-vous pour accéder aux photos.',
      );
    }

    if (path === '/api/session' && request.method === 'GET') {
      return privateJson(identity);
    }

    if (isMutation && identity.role !== 'admin') {
      return failure(
        403,
        'FORBIDDEN',
        'Un accès administrateur est nécessaire.',
      );
    }

    if (path === '/api/calendar' || path.startsWith('/api/calendar/')) {
      return await calendarApi(request, env, identity);
    }

    return ['/api/config', '/api/config/display', '/api/display'].includes(path)
      ? await adminApi(request, env, identity)
      : await routePhotos(request, env.PHOTOS, identity, url);
  } catch (error) {
    return error instanceof PhotoError
      ? failure(error.status, error.code, error.message)
      : failure(
          503,
          'STORAGE_UNAVAILABLE',
          'Stockage indisponible ou quota atteint. Réessayez plus tard ; les photos existantes sont conservées.',
        );
  }
}

async function routePhotos(
  request: Request,
  kv: PhotoKV,
  identity: Identity,
  url: URL,
): Promise<Response> {
  const path = url.pathname;
  if (path === '/api/photos' && request.method === 'GET') {
    const cursor = url.searchParams.get('cursor') ?? undefined;
    if (
      cursor !== undefined &&
      (cursor.length > 2048 || !/^[\w+\-\/=]+$/v.test(cursor))
    ) {
      return failure(400, 'INVALID_CURSOR', 'Page invalide.');
    }

    const page = await listPhotos(kv, cursor);
    return privateJson({
      ...page,
      photos:
        identity.role === 'admin'
          ? page.photos
          : page.photos.map(({id, width, height, size, contentType}) => ({
              id,
              width,
              height,
              size,
              contentType,
            })),
    });
  }

  if (path === '/api/photos' && request.method === 'POST') {
    return uploadPhoto(request, kv, identity.subject);
  }

  const match = /^\/api\/photos\/(?<id>[0-9a-f]{64})$/v.exec(path);
  if (match) {
    if (request.method === 'GET' || request.method === 'HEAD') {
      return imageResponse(request, kv, match.groups!.id);
    }

    if (request.method === 'DELETE') {
      await kv.delete(`photo:${match.groups!.id}`);
      return privateJson({ok: true});
    }
  }

  return failure(404, 'NOT_FOUND', 'Cette API est indisponible.');
}

async function uploadPhoto(
  request: Request,
  kv: PhotoKV,
  subject: string,
): Promise<Response> {
  if (request.headers.get('Content-Type') !== 'image/webp') {
    return failure(415, 'INVALID_TYPE', 'Seul le format WebP est accepté.');
  }

  const id = request.headers.get('X-Photo-Sha256') ?? '';
  const perceptualHash = request.headers.get('X-Photo-Dhash') ?? '';
  if (!shaPattern.test(id) || !hashPattern.test(perceptualHash)) {
    return failure(400, 'INVALID_METADATA', 'Empreintes invalides.');
  }

  const body = await readBounded(request);
  const dimensions = webpDimensions(body);
  const key = `photo:${id}`;
  const existing = await kv.getWithMetadata<PhotoMetadata>(key, 'arrayBuffer');
  if (existing.value) {
    if (
      !isPhotoMetadata(existing.metadata) ||
      existing.metadata.id !== id ||
      existing.value.byteLength !== existing.metadata.size
    ) {
      throw new PhotoError(
        503,
        'STORAGE_INVALID',
        'Photo à vérifier par un administrateur.',
      );
    }

    return privateJson({photo: existing.metadata, duplicate: true});
  }

  const metadata: PhotoMetadata = {
    id,
    sha256: id,
    perceptualHash,
    ...dimensions,
    size: body.byteLength,
    contentType: 'image/webp',
    uploadedAt: new Date().toISOString(),
    uploadedBy: subject,
  };
  // A single record atomically couples bytes and listable key metadata.
  // Concurrent cross-location writes still use KV's last-write-wins semantics.
  await kv.put(key, body, {metadata});
  return privateJson({photo: metadata, duplicate: false}, 201);
}

function hasPhotoConfiguration(
  env: PhotoEnv,
): env is PhotoEnv & {PHOTOS: PhotoKV} {
  return !(
    env.PHOTOS_ENABLED !== 'true' ||
    !env.PHOTOS ||
    (env.ACCESS_TEAM_DOMAIN ?? '').length === 0 ||
    (env.ACCESS_AUD ?? '').length === 0 ||
    (env.ADMIN_EMAILS ?? '').length === 0
  );
}

async function imageResponse(
  request: Request,
  kv: PhotoKV,
  id: string,
): Promise<Response> {
  const key = `photo:${id}`;
  const record = await kv.getWithMetadata<PhotoMetadata>(key, 'arrayBuffer');
  if (!record.value) {
    return failure(404, 'PHOTO_NOT_FOUND', 'Photo introuvable.');
  }

  if (
    !isPhotoMetadata(record.metadata) ||
    record.metadata.id !== id ||
    record.value.byteLength !== record.metadata.size
  ) {
    throw new PhotoError(
      503,
      'STORAGE_INVALID',
      'Photo à vérifier par un administrateur.',
    );
  }

  return new Response(request.method === 'HEAD' ? null : record.value, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(record.metadata.size),
      'Cache-Control': 'private, no-store',
      Vary: 'Cookie, Cf-Access-Jwt-Assertion',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    },
  });
}

function hasMutationOrigin(request: Request, url: URL) {
  return (
    request.headers.get('Origin') === url.origin &&
    request.headers.get('X-Dayframe-Request') === '1' &&
    request.headers.get('Sec-Fetch-Site') !== 'cross-site'
  );
}
