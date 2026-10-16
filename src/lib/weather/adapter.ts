import {displayConfig} from '../dashboard/config.ts';

export type Hour = {
  time: number;
  temperature: number;
  probability: number;
  precipitation: number;
  code: number | undefined;
  isDay: boolean;
};
export type Weather = {
  location: string;
  timezone: string;
  units: {temperature: '°C'; precipitation: 'mm'; probability: '%'};
  fetchedAt: number;
  current: {
    time: number;
    temperature: number;
    feelsLike: number;
    code: number | undefined;
    isDay: boolean;
    precipitation: number;
  };
  hourly: Hour[];
  daily: Array<{date: string; high: number; low: number}>;
};

export const refreshInterval = 30 * 60_000;
export const staleAfter = 45 * 60_000;
export const cacheKey = `dayframe.weather.v1.${displayConfig.latitude}.${displayConfig.longitude}.${displayConfig.timezone}`;

export function weatherUrl() {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(displayConfig.latitude),
    longitude: String(displayConfig.longitude),
    timezone: displayConfig.timezone,
    timeformat: 'unixtime',
    forecast_days: '2',
    temperature_unit: 'celsius',
    precipitation_unit: 'mm',
    current:
      'temperature_2m,apparent_temperature,weather_code,is_day,precipitation',
    hourly:
      'temperature_2m,precipitation_probability,precipitation,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min',
  }).toString();
  return url.href;
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid weather object');
  }

  return value as Record<string, unknown>;
}

function number(value: unknown, min: number, max: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    throw new Error('Invalid weather number');
  }

  return value;
}

function code(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function day(value: unknown) {
  if (value !== 0 && value !== 1) {
    throw new Error('Invalid day flag');
  }

  return value === 1;
}

export function dateKey(time: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: displayConfig.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(time);
}

export function hourLabel(time: number) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: displayConfig.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(time);
}

// Unix timestamps avoid parsing offset-free provider strings in the browser's timezone.
export function parseWeather(input: unknown, fetchedAt: number): Weather {
  const root = record(input);
  if (root.timezone !== displayConfig.timezone) {
    throw new Error('Unexpected timezone');
  }

  const current = record(root.current);
  const hourly = record(root.hourly);
  const daily = record(root.daily);
  const offset = number(root.utc_offset_seconds, -43_200, 50_400);
  // Provider daily boundaries use the request's fixed offset, even across DST.
  // Hourly timestamps still use Intl for the actual IANA offset at each instant.
  const providerDate = (time: number) =>
    new Date(time + offset * 1000).toISOString().slice(0, 10);
  for (const [section, fields] of [
    [
      'current_units',
      {
        time: 'unixtime',
        temperature_2m: '°C',
        apparent_temperature: '°C',
        precipitation: 'mm',
      },
    ],
    [
      'hourly_units',
      {
        time: 'unixtime',
        temperature_2m: '°C',
        precipitation_probability: '%',
        precipitation: 'mm',
      },
    ],
    [
      'daily_units',
      {time: 'unixtime', temperature_2m_max: '°C', temperature_2m_min: '°C'},
    ],
  ] as const) {
    const units = record(root[section]);
    for (const [field, unit] of Object.entries(fields)) {
      if (units[field] !== unit) {
        throw new Error('Unexpected weather units');
      }
    }
  }

  function rows(
    section: Record<string, unknown>,
    fields: string[],
    min: number,
    max: number,
  ) {
    const times = section.time;
    if (!Array.isArray(times) || times.length < min || times.length > max) {
      throw new Error('Invalid forecast length');
    }

    for (const field of fields) {
      if (
        !Array.isArray(section[field]) ||
        section[field].length !== times.length
      ) {
        throw new Error('Mismatched forecast arrays');
      }
    }

    return times.map((time: unknown, index: number) => {
      const timestamp = number(time, 1_577_836_800, 4_102_444_800) * 1000;
      if (index > 0 && timestamp <= Number(times[index - 1]) * 1000) {
        throw new Error('Unordered forecast');
      }

      return {
        time: timestamp,
        get: (field: string) => (section[field] as unknown[])[index],
      };
    });
  }

  const hours = rows(
    hourly,
    [
      'temperature_2m',
      'precipitation_probability',
      'precipitation',
      'weather_code',
      'is_day',
    ],
    24,
    72,
  ).map(({time, get}) => ({
    time,
    temperature: number(get('temperature_2m'), -100, 70),
    probability: number(get('precipitation_probability'), 0, 100),
    precipitation: number(get('precipitation'), 0, 1000),
    code: code(get('weather_code')),
    isDay: day(get('is_day')),
  }));
  if (
    hours.some(
      (hour, index) =>
        index > 0 && hour.time - hours[index - 1].time !== 3_600_000,
    )
  ) {
    throw new Error('Gapped forecast');
  }

  const days = rows(
    daily,
    ['temperature_2m_max', 'temperature_2m_min'],
    2,
    3,
  ).map(({time, get}) => {
    const high = number(get('temperature_2m_max'), -100, 70);
    const low = number(get('temperature_2m_min'), -100, 70);
    if (high < low) {
      throw new Error('Invalid daily range');
    }

    return {date: providerDate(time), high, low};
  });
  const time = number(current.time, 1_577_836_800, 4_102_444_800) * 1000;
  if (
    Math.abs(fetchedAt - time) > 2 * 3_600_000 ||
    hours[0].time > time ||
    hours.at(-1)!.time < time + 12 * 3_600_000 ||
    days.every((entry) => entry.date !== dateKey(time))
  ) {
    throw new Error('Outdated or incomplete forecast');
  }

  return {
    location: displayConfig.location,
    timezone: displayConfig.timezone,
    units: {temperature: '°C', precipitation: 'mm', probability: '%'},
    fetchedAt,
    current: {
      time,
      temperature: number(current.temperature_2m, -100, 70),
      feelsLike: number(current.apparent_temperature, -100, 70),
      code: code(current.weather_code),
      isDay: day(current.is_day),
      precipitation: number(current.precipitation, 0, 1000),
    },
    hourly: hours,
    daily: days,
  };
}

export async function fetchWeather(signal: AbortSignal, now = Date.now) {
  const response = await fetch(weatherUrl(), {
    signal,
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok) {
    throw new Error('Weather provider unavailable');
  }

  const raw: unknown = await response.json();
  const fetchedAt = now();
  return {raw, fetchedAt, weather: parseWeather(raw, fetchedAt)};
}
