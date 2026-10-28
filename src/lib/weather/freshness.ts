import {dateKey, hourLabel, staleAfter, type Weather} from './adapter.ts';

export function isWeatherStale(
  weather: Weather,
  now: number,
  hasFailed = false,
) {
  return (
    hasFailed ||
    now - Math.min(weather.fetchedAt, weather.current.time) >= staleAfter
  );
}

export function staleWeatherLabel(weather: Weather, now: number) {
  const {time} = weather.current;
  const today = dateKey(now);
  const date = dateKey(time);
  if (date === today) {
    return `Météo de ${hourLabel(time)} · non actualisée`;
  }

  const formatted = new Intl.DateTimeFormat('fr-FR', {
    timeZone: weather.timezone,
    day: 'numeric',
    month: 'short',
    ...(date.slice(0, 4) !== today.slice(0, 4) && {year: 'numeric'}),
  }).format(time);
  return `Météo du ${formatted} à ${hourLabel(time)} · non actualisée`;
}

export const recoveryAdvice =
  'Actualisation automatique en cours. Vérifiez la météo avant de partir.';
export const unavailableAdvice =
  'Météo indisponible. Nouvelle tentative automatique. Vérifiez la météo avant de partir.';

export function readingAgeLabel(weather: Weather, now: number) {
  const {time} = weather.current;
  const date = dateKey(time);
  const today = dateKey(now);
  const previousDate = new Date(Date.parse(`${today}T12:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
  // A different year always gets an explicit date, even on New Year's Day.
  if (date.slice(0, 4) !== today.slice(0, 4)) {
    return datedReading(weather, true);
  }

  if (date === previousDate) {
    return `Relevé hier à ${hourLabel(time)}`;
  }

  if (date !== today) {
    return datedReading(weather, false);
  }

  const minutes = Math.floor((now - time) / 60_000);
  if (minutes < 0) {
    return `Relevé de ${hourLabel(time)}`;
  }

  if (minutes === 0) {
    return 'Relevé à l’instant';
  }

  return minutes < 60
    ? `Relevé il y a ${minutes} min`
    : `Relevé il y a ${Math.floor(minutes / 60)} h`;
}

function datedReading(weather: Weather, shouldIncludeYear: boolean) {
  const date = new Intl.DateTimeFormat('fr-FR', {
    timeZone: weather.timezone,
    day: 'numeric',
    month: 'short',
    ...(shouldIncludeYear && {year: 'numeric'}),
  }).format(weather.current.time);
  return `Relevé du ${date} à ${hourLabel(weather.current.time)}`;
}

export function weatherReadingLabel(
  weather: Weather,
  now: number,
  hasFailed = false,
) {
  return `${readingAgeLabel(weather, now)}${isWeatherStale(weather, now, hasFailed) ? ' · non actualisé' : ''}`;
}

export function renderReadingTime(
  element: HTMLTimeElement,
  weather: Weather,
  now: number,
  hasFailed: boolean,
) {
  const label = weatherReadingLabel(weather, now, hasFailed);
  const exact = new Intl.DateTimeFormat('fr-FR', {
    timeZone: weather.timezone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(weather.current.time);
  const title = `${exact} (${weather.timezone})`;
  if (element.textContent !== label) {
    element.textContent = label;
  }

  if (element.title !== title) {
    element.title = title;
  }

  const timestamp = new Date(weather.current.time).toISOString();
  if (element.dateTime !== timestamp) {
    element.dateTime = timestamp;
  }

  const accessible = `${label}. ${title}`;
  if (element.getAttribute('aria-label') !== accessible) {
    element.setAttribute('aria-label', accessible);
  }

  element.dataset.stale = String(isWeatherStale(weather, now, hasFailed));
  element.hidden = false;
}
