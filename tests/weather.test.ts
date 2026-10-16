import {afterEach, describe, expect, it, vi} from 'vitest';
import icons from '@iconify-json/meteocons/icons.json';
import {
  type WeatherState,
  createWeatherService,
  readCache,
} from '../src/lib/weather/service.ts';
import {
  cacheKey,
  dateKey,
  fetchWeather,
  hourLabel,
  parseWeather,
  refreshInterval,
  weatherUrl,
} from '../src/lib/weather/adapter.ts';
import {
  conditionFor,
  conditions,
  wmoConditions,
} from '../src/lib/weather/conditions.ts';
import {summarize} from '../src/lib/weather/summary.ts';
import {fixtureNow, weatherFixture} from './fixtures/weather.ts';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('WMO and actual bundled Meteocons', () => {
  it('covers every required code and installed day/night icon', () => {
    const codes = [
      0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75,
      77, 80, 81, 82, 85, 86, 95, 96, 97, 99,
    ];
    expect(Object.keys(wmoConditions).map(Number)).toEqual(codes);
    for (const code of [...codes, 1234, NaN, undefined]) {
      for (const isDay of [false, true]) {
        const result = conditionFor(code, isDay);
        expect(result.label.length).toBeGreaterThan(3);
        expect(icons.icons).toHaveProperty(
          result.icon.replace('i-meteocons-', ''),
        );
      }
    }

    expect(conditionFor(0, false).icon).toContain('clear-night');
    expect(conditionFor(undefined, true).label).toBe(conditions.unknown.label);
  });
});

describe('provider boundary', () => {
  it('requests only needed fields in explicit metric units and Unix time', () => {
    const url = new URL(weatherUrl());
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('forecast_days')).toBe('2');
    expect(url.searchParams.get('daily')).toBe(
      'temperature_2m_max,temperature_2m_min',
    );
    const weather = parseWeather(weatherFixture(), fixtureNow);
    expect(weather.current.temperature).toBe(12);
    expect(weather.current.time).toBe(fixtureNow);
    expect(weather.hourly).toHaveLength(48);
    expect(weather.daily[0]).toEqual({date: '2026-10-16', high: 19, low: 8});
  });
  it.each([
    'length',
    'null',
    'units',
    'range',
    'order',
    'gap',
    'timezone',
    'old',
    'day',
    'daily',
  ])('rejects malformed %s responses', (kind) => {
    const raw = weatherFixture();
    switch (kind) {
      case 'length': {
        raw.hourly.temperature_2m.pop();

        break;
      }

      case 'null': {
        Object.assign(raw.current, {temperature_2m: null});

        break;
      }

      case 'units': {
        raw.current_units.temperature_2m = '°F';

        break;
      }

      case 'range': {
        raw.hourly.precipitation_probability[0] = 101;

        break;
      }

      case 'order': {
        raw.hourly.time.reverse();

        break;
      }

      case 'gap': {
        raw.hourly.time[1] += 10;

        break;
      }

      case 'timezone': {
        raw.timezone = 'UTC';

        break;
      }

      case 'old': {
        raw.current.time -= 86_400;

        break;
      }

      case 'day': {
        raw.current.is_day = 0.5;

        break;
      }

      case 'daily': {
        raw.daily.temperature_2m_min[0] = 50;

        break;
      }
      // No default
    }

    expect(() => parseWeather(raw, fixtureNow)).toThrow();
  });
  it('degrades unknown/missing codes without discarding valid temperatures', () => {
    const raw = weatherFixture();
    Object.assign(raw.current, {weather_code: null});
    expect(parseWeather(raw, fixtureNow).current.code).toBeUndefined();
  });
  it('formats absolute timestamps across repeated and missing Paris DST hours', () => {
    expect(hourLabel(Date.parse('2026-03-29T00:00:00Z'))).toBe('01:00');
    expect(hourLabel(Date.parse('2026-03-29T01:00:00Z'))).toBe('03:00');
    expect(hourLabel(Date.parse('2026-10-25T00:00:00Z'))).toBe('02:00');
    expect(hourLabel(Date.parse('2026-10-25T01:00:00Z'))).toBe('02:00');
    expect(dateKey(Date.parse('2026-10-15T23:30:00Z'))).toBe('2026-10-16');
  });
  it('keeps distinct provider daily dates across the autumn DST boundary', () => {
    const now = Date.parse('2026-10-25T00:30:00Z');
    const weather = parseWeather(weatherFixture(now), now);
    expect(weather.daily.map((entry) => entry.date)).toEqual([
      '2026-10-25',
      '2026-10-26',
    ]);
  });
  it('rejects HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', {status: 429})),
    );
    await expect(fetchWeather(new AbortController().signal)).rejects.toThrow();
  });
});

describe('deterministic precipitation advice', () => {
  it('uses documented thresholds and separates current conditions from future risk', () => {
    const weather = parseWeather(weatherFixture(), fixtureNow);
    expect(summarize(weather, fixtureNow)).toEqual({
      current: 'Pas de pluie actuellement.',
      outlook: 'Précipitations possibles vers 15:00 ; prévoyez un parapluie.',
    });
    for (const hour of weather.hourly) {
      hour.probability = 49;
      hour.precipitation = 0.09;
    }

    expect(summarize(weather, fixtureNow).outlook).toContain('Faible risque');
    weather.hourly[8].probability = 50;
    expect(summarize(weather, fixtureNow).outlook).toContain('cette heure');
    weather.hourly[8].probability = 0;
    weather.hourly[8].precipitation = 0.1;
    expect(summarize(weather, fixtureNow).outlook).toContain('cette heure');
    weather.current.precipitation = 0.1;
    expect(summarize(weather, fixtureNow).current).toBe('Pluie actuellement.');
    weather.current.code = 71;
    expect(summarize(weather, fixtureNow).current).toBe('Neige actuellement.');
    expect(summarize(weather, fixtureNow + 3 * 86_400_000).outlook).toContain(
      'indisponibles',
    );
  });
});

describe('cache and refresh lifecycle', () => {
  function storage() {
    let value: string | undefined;
    return {
      getItem: vi.fn(() => value ?? null),
      setItem: vi.fn((_key: string, next: string) => {
        value = next;
      }),
    };
  }

  it('validates cache, tolerates blocked storage, rejects future and expired entries', () => {
    const cache = storage();
    cache.setItem(cacheKey, '{broken');
    expect(readCache(cache, fixtureNow)).toBeUndefined();
    cache.setItem(
      cacheKey,
      JSON.stringify({raw: weatherFixture(), fetchedAt: fixtureNow}),
    );
    expect(readCache(cache, fixtureNow)?.current.temperature).toBe(12);
    expect(readCache(cache, fixtureNow - 1)).toBeUndefined();
    expect(readCache(cache, fixtureNow + 4 * 86_400_000)).toBeUndefined();
    expect(
      readCache(
        {
          getItem() {
            throw new Error('denied');
          },
          setItem() {
            /*
            Read-only test double.
            */
          },
        },
        fixtureNow,
      ),
    ).toBeUndefined();
  });
  it('uses fresh cache, deduplicates wake/start, refreshes at 30 minutes and cleans up', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixtureNow);
    const cache = storage();
    cache.setItem(
      cacheKey,
      JSON.stringify({raw: weatherFixture(), fetchedAt: fixtureNow}),
    );
    const fetcher = vi.fn(async () =>
      Response.json(weatherFixture(Date.now())),
    );
    vi.stubGlobal('fetch', fetcher);
    const render = vi.fn<(state: WeatherState) => void>();
    const service = createWeatherService(render, cache);
    service.start();
    service.start();
    service.wake();
    expect(fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(refreshInterval);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(render.mock.lastCall?.[0].failed).toBe(false);
    expect(cache.setItem).toHaveBeenCalledTimes(2);
    service.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retains last success through errors with bounded 1/5/15/30-minute retries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixtureNow);
    const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetcher);
    const cache = storage();
    cache.setItem(
      cacheKey,
      JSON.stringify({raw: weatherFixture(), fetchedAt: fixtureNow}),
    );
    vi.setSystemTime(fixtureNow + refreshInterval);
    const render = vi.fn<(state: WeatherState) => void>();
    const service = createWeatherService(render, cache);
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(render.mock.lastCall?.[0]).toMatchObject({
      failed: true,
      weather: {fetchedAt: fixtureNow},
    });
    for (const delay of [60_000, 300_000, 900_000, 1_800_000, 1_800_000]) {
      const calls = fetcher.mock.calls.length;
      service.wake();
      service.wake();
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(fetcher).toHaveBeenCalledTimes(calls);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetcher).toHaveBeenCalledTimes(calls + 1);
    }

    service.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('times out stalled requests and retries while initial failure remains usable', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixtureNow);
    const fetcher = vi.fn(
      async (_url: string, {signal}: {signal: AbortSignal}) =>
        new Promise<Response>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        }),
    );
    vi.stubGlobal('fetch', fetcher);
    const render = vi.fn<(state: WeatherState) => void>();
    const service = createWeatherService(render);
    service.start();
    service.wake();
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(render.mock.lastCall?.[0]).toEqual({failed: true});
    service.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts on page exit and resumes without a duplicate in-flight request', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixtureNow);
    const fetcher = vi.fn(
      async (_url: string, {signal}: {signal: AbortSignal}) => {
        if (fetcher.mock.calls.length > 1) {
          return Response.json(weatherFixture());
        }

        return new Promise<Response>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('aborted'));
          });
        });
      },
    );
    vi.stubGlobal('fetch', fetcher);
    const render = vi.fn<(state: WeatherState) => void>();
    const service = createWeatherService(render);
    service.start();
    service.stop();
    service.start();
    service.wake();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(render.mock.lastCall?.[0]).toMatchObject({
      failed: false,
      weather: {fetchedAt: fixtureNow},
    });
    expect(vi.getTimerCount()).toBe(1);
    service.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('keeps valid in-memory weather when a cache write exceeds quota', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixtureNow);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(weatherFixture())),
    );
    const cache = storage();
    cache.setItem.mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    const render = vi.fn<(state: WeatherState) => void>();
    const service = createWeatherService(render, cache);
    service.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(render.mock.lastCall?.[0]).toMatchObject({
      failed: false,
      weather: {fetchedAt: fixtureNow},
    });
    service.stop();
  });
});
