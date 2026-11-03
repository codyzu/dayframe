import {photoCoordinates} from './gps.ts';
import {isPhotoPlace, type PhotoPlace} from './place.ts';

// Per-page, serial, capped queue. Cache keys exist in memory only and disappear
// on hide/denial. Saved labels mean playback never calls this service.
export function createPlaceLookup() {
  let tail = Promise.resolve();
  let calls = 0;
  let nextAt = 0;
  let isStopped = false;
  const cache = new Map<string, PhotoPlace | undefined>();
  return {
    clear() {
      cache.clear();
    },
    async lookup(
      file: File,
      signal: AbortSignal,
    ): Promise<{place?: PhotoPlace; message: string}> {
      const coordinates = photoCoordinates(await file.arrayBuffer());
      signal.throwIfAborted();
      if (!coordinates) {
        return {message: 'Aucun GPS lisible. Vous pouvez saisir le lieu.'};
      }

      const key = `${coordinates.latitude},${coordinates.longitude}`;
      let message = 'Lieu indisponible. Vous pouvez le saisir.';
      const task = tail.then(async () => {
        signal.throwIfAborted();
        if (cache.has(key)) {
          return cache.get(key);
        }

        if (isStopped || calls >= 100) {
          message =
            'Recherche suspendue pour cette session. Saisissez le lieu.';
          return undefined;
        }

        const delay = Math.max(0, nextAt - Date.now());
        if (delay > 0) {
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => {
              signal.removeEventListener('abort', abort);
              resolve();
            }, delay);
            const abort = () => {
              clearTimeout(timer);
              reject(new Error('Recherche annulée.'));
            };

            signal.addEventListener('abort', abort, {once: true});
          });
        }

        signal.throwIfAborted();
        calls++;
        nextAt = Date.now() + 1000;
        const url = new URL('https://photon.komoot.io/reverse');
        url.search = new URLSearchParams({
          lat: String(coordinates.latitude),
          lon: String(coordinates.longitude),
          lang: 'fr',
          layer: 'city',
          radius: '10',
          limit: '1',
        }).toString();
        cache.set(key, undefined);
        const response = await fetch(url, {
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          redirect: 'error',
          signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]),
        });
        if ([429, 403].includes(response.status)) {
          isStopped = true;
        }

        if (!response.ok) {
          return undefined;
        }

        const body = (await response.json()) as {
          features?: Array<{
            properties?: {
              name?: unknown;
              osm_key?: unknown;
              osm_value?: unknown;
            };
          }>;
        };
        const properties =
          body.features?.length === 1 ? body.features[0].properties : undefined;
        const place: PhotoPlace = {
          label:
            typeof properties?.name === 'string' ? properties.name.trim() : '',
          source: 'estimated',
        };
        const result =
          properties?.osm_key === 'place' &&
          ['city', 'town', 'village', 'hamlet'].includes(
            String(properties.osm_value),
          ) &&
          isPhotoPlace(place)
            ? place
            : undefined;
        signal.throwIfAborted();
        cache.set(key, result);
        return result;
      });
      tail = task.then(() => undefined).catch(() => undefined);
      try {
        const place = await task;
        signal.throwIfAborted();
        return {
          place,
          message: place ? 'Lieu trouvé automatiquement.' : message,
        };
      } catch {
        signal.throwIfAborted();
        return {message};
      }
    },
  };
}
