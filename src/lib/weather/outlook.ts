import {dateKey, hourLabel, type Hour, type Weather} from './adapter.ts';

const temperature = (value: number) => `${Math.round(value)}°`;
const time = (hour: Hour) => hourLabel(hour.time).replace(':', 'h');

// Calendar keys avoid adding 24 hours across a local daylight-saving change.
function tomorrowKey(now: number) {
  return new Date(Date.parse(`${dateKey(now)}T12:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function adviceHours(weather: Weather, now: number) {
  const today = dateKey(now);
  const tomorrow = tomorrowKey(now);
  const isLate = hourLabel(now) >= '21:00';
  return weather.hourly.filter(
    (hour) =>
      hour.time + 3_600_000 > now &&
      (dateKey(hour.time) === today ||
        (isLate &&
          dateKey(hour.time) === tomorrow &&
          hourLabel(hour.time) <= '07:00')),
  );
}

export function temperatureOutlook(weather: Weather, now: number) {
  const current = `${temperature(weather.current.temperature)} maintenant`;
  const today = dateKey(now);
  const future = weather.hourly.filter((hour) => hour.time > now);
  const remainingToday = future.filter((hour) => dateKey(hour.time) === today);
  let peak: Hour | undefined;
  for (const hour of weather.hourly) {
    if (
      dateKey(hour.time) === today &&
      (!peak || hour.temperature > peak.temperature)
    ) {
      peak = hour;
    }
  }

  if (
    peak &&
    hourLabel(now) < '18:00' &&
    peak.time > now &&
    peak.temperature >= weather.current.temperature + 1
  ) {
    return `${current}, jusqu’à ${temperature(peak.temperature)} vers ${time(peak)}${peak.temperature - weather.current.temperature >= 8 ? ' : pensez aux couches légères' : ''}.`;
  }

  const isLate = hourLabel(now) >= '21:00';
  const isEarly = hourLabel(now) < '06:00';
  const targetDate = isLate ? tomorrowKey(now) : today;
  const targetTime = isLate || isEarly ? '07:00' : '21:00';
  const target = future.find(
    (hour) =>
      dateKey(hour.time) === targetDate && hourLabel(hour.time) === targetTime,
  );
  if (target) {
    const when = isLate
      ? 'demain matin vers 07h00'
      : isEarly
        ? 'ce matin vers 07h00'
        : 'ce soir vers 21h00';
    return `${current}, autour de ${temperature(target.temperature)} ${when}.`;
  }

  const last = remainingToday.at(-1);
  return last
    ? `${current}, autour de ${temperature(last.temperature)} vers ${time(last)}.`
    : `${current}. Suite des prévisions indisponible.`;
}

export function selectedDaySummary(hours: Hour[], now: number, date: string) {
  const remaining =
    date === dateKey(now)
      ? hours.filter((hour) => hour.time + 3_600_000 > now)
      : hours;
  if (remaining.length === 0) {
    return 'Suite des prévisions horaires indisponible.';
  }

  const low = Math.min(...remaining.map((hour) => hour.temperature));
  const high = Math.max(...remaining.map((hour) => hour.temperature));
  const wet = remaining.find(
    (hour) => hour.probability >= 50 || hour.precipitation >= 0.2,
  );
  return `${date === dateKey(now) ? 'À venir : ' : ''}${temperature(low)} à ${temperature(high)}C. ${wet ? (wet.time <= now ? 'Pluie possible en ce moment.' : `Pluie possible vers ${time(wet)}.`) : 'Pas de pluie marquée prévue sur les heures disponibles.'}`;
}
