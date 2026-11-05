import {afterEach, describe, expect, it, vi} from 'vitest';
import {positionCity, resolvePosition} from '../src/lib/weather/position.ts';
import {
  locationKey,
  parseLocations,
  readLocation,
  validateLocation,
} from '../src/lib/weather/location.ts';

const location = {
  location: 'Annecy',
  latitude: 45.8992,
  longitude: 6.1294,
  timezone: 'Europe/Paris',
};

describe('device weather location', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it('validates and reconstructs only weather fields', () => {
    expect(validateLocation({...location, secret: 'excluded'})).toEqual(
      location,
    );
    for (const invalid of [
      null,
      [],
      {},
      {...location, latitude: NaN},
      {...location, latitude: 91},
      {...location, longitude: -181},
      {...location, latitude: '45'},
      {...location, timezone: 'invalid'},
      {...location, location: ''},
      {...location, location: '\u{202E}evil'},
      {...location, location: 'x'.repeat(161)},
      {...location, source: 'untrusted'},
    ]) {
      expect(() => validateLocation(invalid)).toThrow();
    }
  });

  it('keeps browser coordinate precision and the optional geolocation source', () => {
    const precise = {
      ...location,
      latitude: 45.899234567,
      longitude: 6.129456789,
      source: 'geolocation',
    };
    expect(validateLocation(precise)).toEqual(precise);
    expect(readLocation({getItem: () => JSON.stringify(precise)})).toEqual(
      precise,
    );
  });

  it('accepts only a short place name from the reverse lookup', () => {
    const result = (name: unknown, osmValue = 'city') => ({
      features: [{properties: {name, osm_key: 'place', osm_value: osmValue}}],
    });
    for (const kind of ['city', 'town', 'village', 'hamlet']) {
      expect(positionCity(result(' Annecy ', kind))).toBe('Annecy');
    }

    for (const invalid of [
      null,
      {},
      {features: []},
      {features: [null]},
      result('Road', 'street'),
      result(''),
      result('x'.repeat(141)),
      result('\u{202E}bad'),
      result(12),
    ]) {
      expect(positionCity(invalid)).toBeUndefined();
    }
  });

  it('uses the original point, not provider coordinates, and isolates naming failures', async () => {
    const requests: URL[] = [];
    const fetcher = vi.fn(async (input: URL) => {
      requests.push(input);
      return Response.json(
        input.hostname === 'photon.komoot.io'
          ? {
              features: [
                {
                  properties: {
                    osm_key: 'place',
                    osm_value: 'city',
                    name: 'Annecy',
                  },
                  geometry: {coordinates: [0, 0]},
                },
              ],
            }
          : {timezone: 'Europe/Paris', latitude: 46, longitude: 6},
        {headers: {'Content-Type': 'application/json'}},
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const coordinates = {latitude: 45.899234567, longitude: 6.129456789};
    const {signal} = new AbortController();
    const result = await resolvePosition(coordinates, signal);
    expect(result).toEqual({
      ...coordinates,
      source: 'geolocation',
      timezone: 'Europe/Paris',
      location: 'Près d’Annecy',
      label: 'Près d’Annecy · ville estimée',
    });
    expect(requests).toHaveLength(2);
    expect(requests[0].searchParams.get('latitude')).toBe(
      String(coordinates.latitude),
    );
    expect(requests[1].searchParams.get('lat')).toBe(
      String(coordinates.latitude),
    );
    fetcher.mockImplementation(async (input: URL) => {
      if (input.hostname === 'photon.komoot.io') {
        throw new Error('offline');
      }

      return Response.json({timezone: 'Europe/Paris'});
    });
    await expect(resolvePosition(coordinates, signal)).resolves.toMatchObject({
      ...coordinates,
      location: 'Ma position',
    });
    const aborted = new AbortController();
    aborted.abort();
    const calls = fetcher.mock.calls.length;
    await expect(
      resolvePosition(coordinates, aborted.signal),
    ).rejects.toThrow();
    await expect(
      resolvePosition({...coordinates, latitude: NaN}, signal),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(calls);
  });

  it.each(['empty', 'malformed', 'unavailable', 'timeout'])(
    'keeps precise GPS weather when the city lookup is %s',
    async (failure) => {
      vi.useFakeTimers();
      // Node's native AbortSignal timeout uses real time independently of Vitest.
      vi.spyOn(AbortSignal, 'timeout').mockImplementation((delay) => {
        const controller = new AbortController();
        setTimeout(() => {
          controller.abort(new DOMException('Timeout', 'TimeoutError'));
        }, delay);
        return controller.signal;
      });
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: URL, options: RequestInit) => {
          if (url.hostname !== 'photon.komoot.io') {
            return Response.json({timezone: 'Europe/Paris'});
          }

          if (failure === 'timeout') {
            return new Promise<Response>((_resolve, reject) => {
              options.signal!.addEventListener('abort', () => {
                reject(new DOMException('Aborted', 'AbortError'));
              });
            });
          }

          return failure === 'unavailable'
            ? new Response(null, {status: 503})
            : Response.json({
                features:
                  failure === 'empty'
                    ? []
                    : [
                        {
                          properties: {
                            name: '\u{202E}invalid',
                            osm_key: 'place',
                            osm_value: 'city',
                          },
                        },
                      ],
              });
        }),
      );
      const coordinates = {latitude: 45.899234567, longitude: 6.129456789};
      const pending = resolvePosition(
        coordinates,
        new AbortController().signal,
      );
      await vi.advanceTimersByTimeAsync(4000);
      await expect(pending).resolves.toEqual({
        ...coordinates,
        source: 'geolocation',
        timezone: 'Europe/Paris',
        location: 'Ma position',
        label: 'Ma position · ville indisponible',
      });
      expect(fetch).toHaveBeenCalledTimes(2);
    },
  );

  it('ignores absent, corrupt and inaccessible storage', () => {
    expect(readLocation()).toBeUndefined();
    expect(readLocation({getItem: () => '{'})).toBeUndefined();
    expect(
      readLocation({
        getItem() {
          throw new Error('denied');
        },
      }),
    ).toBeUndefined();
    expect(
      readLocation({
        getItem: (key) =>
          key === locationKey ? JSON.stringify(location) : null,
      }),
    ).toEqual(location);
  });

  it('keeps disambiguating names and rejects malformed provider results', () => {
    expect(
      parseLocations({
        results: [
          {
            ...location,
            name: 'Annecy',
            admin1: 'Auvergne-Rhône-Alpes',
            country: 'France',
          },
        ],
      }),
    ).toEqual([{...location, label: 'Annecy, Auvergne-Rhône-Alpes, France'}]);
    expect(parseLocations({})).toEqual([]);
    expect(() => parseLocations({results: 'invalid'})).toThrow();
    expect(() => parseLocations({results: [null]})).toThrow();
    expect(() =>
      parseLocations({results: Array.from({length: 11}, () => location)}),
    ).toThrow();
  });
});
