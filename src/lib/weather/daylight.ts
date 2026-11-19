import {dateKey, hourLabel, staleAfter, type Weather} from './adapter.ts';

export type LightPhase = 'night' | 'dawn' | 'day' | 'dusk';

export function daylightFor(weather: Weather | undefined, now: number) {
  const today = dateKey(now);
  return weather?.daily.find((entry) => entry.date === today)?.daylight;
}

export function weatherLightPhase(
  weather: Weather | undefined,
  now: number,
): LightPhase {
  const {sunrise, sunset} = daylightFor(weather, now) ?? {};
  const minute = 60_000;
  if (
    sunrise !== undefined &&
    now >= sunrise - 40 * minute &&
    now < sunrise + 30 * minute
  ) {
    return 'dawn';
  }

  if (
    sunset !== undefined &&
    now >= sunset - 30 * minute &&
    now < sunset + 40 * minute
  ) {
    return 'dusk';
  }

  if (sunrise !== undefined && sunset !== undefined) {
    return now >= sunrise && now < sunset ? 'day' : 'night';
  }

  if (weather && Math.abs(now - weather.current.time) < staleAfter) {
    return weather.current.isDay ? 'day' : 'night';
  }

  // This only chooses decorative artwork. Never present approximate solar times.
  const hour = hourLabel(now);
  return hour >= '07:00' && hour < '19:00' ? 'day' : 'night';
}
