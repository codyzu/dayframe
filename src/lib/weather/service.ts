import {
  cacheKey,
  fetchWeather,
  parseWeather,
  refreshInterval,
  type Weather,
} from './adapter.ts';

export type WeatherState = {weather?: Weather; failed: boolean};
export type WeatherCache = Pick<Storage, 'getItem' | 'setItem'>;
const retryDelays = [60_000, 5 * 60_000, 15 * 60_000, refreshInterval];

export function readCache(storage: WeatherCache | undefined, now: number) {
  try {
    const entry = JSON.parse(storage?.getItem(cacheKey) ?? 'null') as
      | {
          raw?: unknown;
          fetchedAt?: unknown;
        }
      | undefined;
    return !entry ||
      typeof entry.fetchedAt !== 'number' ||
      !Number.isFinite(entry.fetchedAt) ||
      entry.fetchedAt > now ||
      now - entry.fetchedAt > 3 * 86_400_000
      ? undefined
      : parseWeather(entry.raw, entry.fetchedAt);
  } catch {
    return undefined;
  }
}

// One scheduler and one in-flight request per display. Resume/online cannot bypass backoff.
export function createWeatherService(
  render: (state: WeatherState) => void,
  storage?: WeatherCache,
  now = Date.now,
) {
  let state: WeatherState = {weather: readCache(storage, now()), failed: false};
  let due = state.weather ? state.weather.fetchedAt + refreshInterval : 0;
  let failures = 0;
  let isRunning = false;
  let generation = 0;
  let pending: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function tick() {
    if (!isRunning || pending) {
      return;
    }

    clearTimeout(timer);
    if (now() >= due) {
      const epoch = generation;
      const controller = new AbortController();
      pending = controller;
      const timeout = setTimeout(() => {
        controller.abort();
      }, 12_000);
      try {
        const result = await fetchWeather(controller.signal, now);
        if (!isRunning || epoch !== generation || controller.signal.aborted) {
          return;
        }

        state = {weather: result.weather, failed: false};
        failures = 0;
        due = now() + refreshInterval;
        try {
          storage?.setItem(
            cacheKey,
            JSON.stringify({raw: result.raw, fetchedAt: result.fetchedAt}),
          );
        } catch {
          // Storage can be unavailable or full. Keep validated weather in memory.
        }
      } catch {
        if (!isRunning || epoch !== generation) {
          return;
        }

        state = {...state, failed: true};
        due = now() + retryDelays[Math.min(failures, retryDelays.length - 1)];
        failures++;
      } finally {
        clearTimeout(timeout);
        pending = undefined;
        if (isRunning && epoch !== generation) {
          void tick();
        }
      }
    }

    if (!isRunning) {
      return;
    }

    render(state);
    const delay = Math.min(60_000, due - now());
    timer = setTimeout(
      () => {
        void tick();
      },
      Math.max(1, delay),
    );
  }

  return {
    start() {
      if (isRunning) {
        return;
      }

      isRunning = true;
      render(state);
      void tick();
    },
    wake() {
      void tick();
    },
    stop() {
      isRunning = false;
      generation++;
      clearTimeout(timer);
      pending?.abort();
    },
  };
}
