import {type AgendaEvent} from '../calendar/contracts.ts';
import {adviceHours, temperatureOutlook} from './outlook.ts';
import {dateKey, hourLabel, type Hour, type Weather} from './adapter.ts';

export function dayHours(weather: Weather, now: number) {
  const today = dateKey(now);
  return weather.hourly.filter((hour) => {
    const label = hourLabel(hour.time);
    return dateKey(hour.time) === today && label >= '06:00' && label <= '22:00';
  });
}

// Timed events provide an absolute instant, including during a repeated DST hour.
export function hourlyForecastAt(hours: readonly Hour[], instant: number) {
  const index = hours.findLastIndex((hour) => hour.time <= instant);
  const before = index === -1 ? undefined : hours.at(index);
  if (!before || instant - before.time >= 3_600_000) {
    return undefined;
  }

  const fraction = (instant - before.time) / 3_600_000;
  if (fraction === 0) {
    return {forecast: before, probabilityPeriod: hourLabel(before.time)};
  }

  const after = hours.at(index + 1);
  if (!after || after.time - before.time !== 3_600_000) {
    return undefined;
  }

  return {
    forecast: {
      ...before,
      temperature:
        before.temperature +
        (after.temperature - before.temperature) * fraction,
      probability: Math.max(before.probability, after.probability),
      precipitation: Math.max(before.precipitation, after.precipitation),
    },
    probabilityPeriod: `${hourLabel(before.time)}–${hourLabel(after.time)}`,
  };
}

export function twoHourRain(hours: Hour[]) {
  const result: Array<{start: number; end: number; probability: number}> = [];
  for (const hour of hours) {
    const localHour = Number(hourLabel(hour.time).slice(0, 2));
    if (localHour % 2 !== 0 || localHour >= 22) {
      continue;
    }

    const next = hours.find(
      (candidate) => candidate.time === hour.time + 3_600_000,
    );
    if (next) {
      result.push({
        start: hour.time,
        end: hour.time + 2 * 3_600_000,
        probability: Math.max(hour.probability, next.probability),
      });
    }
  }

  return result;
}

const hasRainRisk = (hour: Hour) =>
  hour.probability >= 50 || hour.precipitation >= 0.2;

function eventRainAdvice(
  weather: Weather,
  now: number,
  events: readonly AgendaEvent[],
) {
  const today = dateKey(now);
  const first = events
    .filter(
      ({weatherRelevant, allDay, calendar}) =>
        weatherRelevant === true && !allDay && calendar !== 'massages',
    )
    .map(({title, start}) => ({title, time: Date.parse(start)}))
    .filter(({time}) => time >= now && dateKey(time) === today)
    .toSorted((a, b) => a.time - b.time)
    .find(({time}) => {
      const forecast = hourlyForecastAt(weather.hourly, time)?.forecast;
      return forecast && hasRainRisk(forecast);
    });

  if (!first) {
    return;
  }

  const time = hourLabel(first.time).replace(':', 'h');
  return `Pour « ${first.title} » à ${time}, prévoyez un parapluie.`;
}

export function morningAdvice(
  weather: Weather,
  now: number,
  events: readonly AgendaEvent[] = [],
) {
  const future = adviceHours(weather, now);
  if (future.length === 0) {
    return {
      title: 'Consultez la météo avant de partir.',
      detail: 'Prévisions de la journée indisponibles.',
    };
  }

  const wet = future.find((hour) => hasRainRisk(hour));
  const feels = weather.current.feelsLike;
  const remainingLow = Math.min(...future.map((hour) => hour.temperature));
  const isCold = Math.min(feels, remainingLow) <= 3;
  const isJacket = Math.min(feels, remainingLow) < 15;
  const isHazardous =
    future.some((hour) =>
      [56, 57, 66, 67, 95, 96, 97, 99].includes(hour.code ?? -1),
    ) || [56, 57, 66, 67, 95, 96, 97, 99].includes(weather.current.code ?? -1);
  const title = isHazardous
    ? 'Prudence pour les trajets.'
    : isCold
      ? 'Habillez-vous chaudement.'
      : wet
        ? 'Prenez un parapluie.'
        : isJacket
          ? 'Prévoyez une veste.'
          : 'Une tenue légère devrait suffire.';
  const details: string[] = [];
  if (isHazardous) {
    details.push(
      'Orage ou verglas possible : vérifiez les conditions avant de partir.',
    );
  } else if (wet) {
    details.push(
      wet.time <= now
        ? 'Pluie possible dès maintenant.'
        : `Pluie possible ${dateKey(wet.time) === dateKey(now) ? '' : 'demain '}vers ${hourLabel(wet.time).replace(':', 'h')}.`,
    );
    const eventAdvice = eventRainAdvice(weather, now, events);
    if (isCold) {
      details.push('Bonnet, gants et parapluie conseillés.');
    } else if (eventAdvice !== undefined) {
      details.push(eventAdvice);
    } else if (isJacket) {
      details.push('Une veste sera aussi utile.');
    }
  } else {
    if (isCold) {
      details.push('Bonnet et gants conseillés.');
    }

    details.push(temperatureOutlook(weather, now));
  }

  return {title, detail: details.slice(0, 2).join(' ')};
}

export function forecastAdvice(weather: Weather, date: string) {
  const hours = weather.hourly.filter(
    (hour) =>
      dateKey(hour.time) === date &&
      hourLabel(hour.time) >= '06:00' &&
      hourLabel(hour.time) <= '22:00',
  );
  if (hours.length === 0) {
    return {
      title: 'Consultez la météo avant de partir.',
      detail: 'Prévisions de la journée indisponibles.',
    };
  }

  const low = Math.min(...hours.map((hour) => hour.temperature));
  const high = Math.max(...hours.map((hour) => hour.temperature));
  const wet = hours.find(
    (hour) => hour.probability >= 50 || hour.precipitation >= 0.2,
  );
  const isHazardous = hours.some((hour) =>
    [56, 57, 66, 67, 95, 96, 97, 99].includes(hour.code ?? -1),
  );
  return {
    title: isHazardous
      ? 'Prudence pour les trajets.'
      : low <= 3
        ? 'Habillez-vous chaudement.'
        : wet
          ? 'Prenez un parapluie.'
          : low < 15
            ? 'Prévoyez une veste.'
            : 'Une tenue légère devrait suffire.',
    detail: isHazardous
      ? 'Orage ou verglas possible : vérifiez les conditions avant de partir.'
      : `${Math.round(low)}° à ${Math.round(high)}° sur les heures disponibles.${wet ? ` Pluie possible vers ${hourLabel(wet.time).replace(':', 'h')}.` : ''}`,
  };
}
