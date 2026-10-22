import {invalidateOfflinePhotos} from './offline.ts';
import {
  hasPhotoSize,
  isPhotoMetadata,
  shaPattern,
  type PhotoMetadata,
} from './contracts.ts';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function photoRequest(path: string, options: RequestInit = {}) {
  if (
    (path === '/api/session' && options.method === 'DELETE') ||
    (path === '/api/session/display' && options.method === 'POST')
  ) {
    invalidateOfflinePhotos();
  }

  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    signal: options.signal ?? AbortSignal.timeout(15_000),
    headers: {
      ...options.headers,
      ...(options.method !== undefined &&
        options.method !== 'GET' && {'X-Dayframe-Request': '1'}),
    },
  });
  if ([401, 403].includes(response.status)) {
    invalidateOfflinePhotos();
  }

  if (!response.ok) {
    let message =
      response.status === 401
        ? 'Session expirée. Reconnectez-vous puis réessayez.'
        : path === '/api/session' && response.status === 404
          ? 'L’espace photo n’est pas encore activé.'
          : 'Les photos sont indisponibles. Réessayez plus tard.';
    try {
      const body = (await response.json()) as {error?: {message?: string}};
      if (!(path === '/api/session' && response.status === 404)) {
        message = body.error?.message ?? message;
      }
    } catch {
      /*
      Access login pages are not JSON.
      */
    }

    throw new ApiError(message, response.status);
  }

  return response;
}

export type DisplayPhoto = Pick<
  PhotoMetadata,
  'id' | 'width' | 'height' | 'size' | 'contentType'
>;
export async function fetchCatalog(isAdmin = false, signal?: AbortSignal) {
  const photos: PhotoMetadata[] = [];
  const display: DisplayPhoto[] = [];
  let cursor: string | undefined;
  const seen = new Set<string>();
  do {
    const response = await photoRequest(
      `/api/photos${cursor === undefined ? '' : `?cursor=${encodeURIComponent(cursor)}`}`,
      {signal},
    );
    const body = (await response.json()) as {
      photos: unknown[];
      cursor: string | undefined;
    };
    if (
      !Array.isArray(body.photos) ||
      !(body.cursor === null || typeof body.cursor === 'string') ||
      (body.cursor !== null && seen.has(body.cursor))
    ) {
      throw new Error('Catalogue invalide.');
    }

    for (const value of body.photos) {
      if (isAdmin && !isPhotoMetadata(value)) {
        throw new Error('Catalogue invalide.');
      }

      const photo = value as PhotoMetadata;
      if (
        typeof value !== 'object' ||
        value === null ||
        typeof photo.id !== 'string' ||
        !shaPattern.test(photo.id) ||
        !hasPhotoSize(photo) ||
        photo.contentType !== 'image/webp'
      ) {
        throw new Error('Catalogue invalide.');
      }

      display.push(photo);
      if (isAdmin) {
        photos.push(photo);
      }
    }

    cursor = body.cursor ?? undefined;
    if (cursor !== undefined) {
      seen.add(cursor);
    }

    if (seen.size > 20 || display.length > 10_000) {
      throw new Error('Catalogue trop volumineux.');
    }
  } while (cursor !== undefined);

  return {
    photos,
    display: [...new Map(display.map((photo) => [photo.id, photo])).values()],
  };
}
