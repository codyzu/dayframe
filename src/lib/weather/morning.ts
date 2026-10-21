import {
  dayContext,
  emptyPlanning,
  type DayPlanning,
  type OfficialCalendar,
  type RoutinePoint,
} from '../dashboard/day-planning.ts';
import {runtimeConfig} from '../dashboard/config.ts';
import {dateKey, hourLabel, type Hour, type Weather} from './adapter.ts';

export type Checkpoint = RoutinePoint & {weekendLabel?: string};
export const schoolCheckpoints: readonly Checkpoint[] = [
  {time: '08:00', label: 'École', weekendLabel: 'Matin'},
  {time: '11:30', label: 'Midi', weekendLabel: 'Midi'},
  {time: '16:30', label: 'Sortie', weekendLabel: 'Après-midi'},
  {time: '18:00', label: 'Activités', weekendLabel: 'Soir'},
];

export function isWeekend(now: number) {
  return ['Sat', 'Sun'].includes(
    new Intl.DateTimeFormat('en-US', {
      timeZone: runtimeConfig.timezone,
      weekday: 'short',
    }).format(now),
  );
}

export function dayHours(weather: Weather, now: number) {
  // Preserve the whole useful day even after a checkpoint has passed.
  const today = dateKey(now);
  return weather.hourly.filter((hour) => {
    const label = hourLabel(hour.time);
    return dateKey(hour.time) === today && label >= '06:00' && label <= '22:00';
  });
}

export function checkpointForecasts(
  weather: Weather,
  now: number,
  checkpoints = schoolCheckpoints,
) {
  const hours = weather.hourly.filter(
    (hour) => dateKey(hour.time) === dateKey(now),
  );
  const isWeekendDay = isWeekend(now);
  return checkpoints.map((checkpoint) => {
    const beforeLabel = `${checkpoint.time.slice(0, 2)}:00`;
    const before = hours.find((hour) => hourLabel(hour.time) === beforeLabel);
    const after =
      before && hours.find((hour) => hour.time === before.time + 3_600_000);
    const fraction = Number(checkpoint.time.slice(3)) / 60;
    const isNeedsInterpolation = fraction > 0;
    // No extrapolation or borrowing another day's weather when data is missing.
    const forecast =
      before && (!isNeedsInterpolation || after)
        ? {
            ...before,
            temperature: isNeedsInterpolation
              ? before.temperature +
                (after!.temperature - before.temperature) * fraction
              : before.temperature,
            probability: isNeedsInterpolation
              ? Math.max(before.probability, after!.probability)
              : before.probability,
            precipitation: isNeedsInterpolation
              ? Math.max(before.precipitation, after!.precipitation)
              : before.precipitation,
          }
        : undefined;
    return {
      ...checkpoint,
      label: isWeekendDay
        ? (checkpoint.weekendLabel ?? checkpoint.label)
        : checkpoint.label,
      forecast,
      at: before ? before.time + fraction * 3_600_000 : undefined,
      probabilityPeriod:
        isNeedsInterpolation && before && after
          ? `${hourLabel(before.time)}–${hourLabel(after.time)}`
          : beforeLabel,
    };
  });
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

export function morningAdvice(
  weather: Weather,
  now: number,
  checkpoints?: readonly Checkpoint[],
) {
  const hours = dayHours(weather, now);
  const future = hours.filter((hour) => hour.time + 3_600_000 > now);
  if (future.length === 0) {
    return {
      title: 'Consultez la météo avant de partir.',
      detail: 'Prévisions de la journée indisponibles.',
    };
  }

  const wet = future.find(
    (hour) => hour.probability >= 50 || hour.precipitation >= 0.2,
  );
  const pickup = checkpointForecasts(weather, now, checkpoints).find(
    (point) =>
      point.time >= '16:00' &&
      point.forecast &&
      point.at !== undefined &&
      point.at >= now &&
      (point.forecast.probability >= 50 || point.forecast.precipitation >= 0.2),
  );
  const daily = weather.daily.find((day) => day.date === dateKey(now));
  const feels = weather.current.feelsLike;
  const isCold = feels <= 3;
  const isJacket = feels < 15;
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
  } else if (isCold) {
    details.push(
      wet
        ? 'Bonnet, gants et parapluie conseillés.'
        : 'Bonnet et gants conseillés.',
    );
  } else if (wet && isJacket) {
    details.push('Une veste sera aussi utile.');
  }

  if (!isHazardous && wet) {
    details.push(
      pickup
        ? `Pluie possible vers ${pickup.time.replace(':', 'h')}.`
        : wet.time <= now
          ? 'Pluie possible en ce moment.'
          : `Pluie possible vers ${hourLabel(wet.time).replace(':', 'h')}.`,
    );
  } else if (!isHazardous && daily) {
    details.push(
      `${Math.round(weather.current.temperature)}° maintenant, jusqu’à ${Math.round(daily.high)}° aujourd’hui${daily.high - weather.current.temperature >= 8 ? ' : pensez aux couches légères' : ''}.`,
    );
  }

  return {title, detail: details.slice(0, 2).join(' ')};
}

export function routineForDay(
  now: number,
  planning: DayPlanning = emptyPlanning,
  calendar?: OfficialCalendar,
) {
  const context = dayContext(now, runtimeConfig.timezone, planning, calendar);
  const isUncertain = planning.schoolCalendar && !context.isKnown;
  const defaults =
    isUncertain || context.isDayOff || context.weekday === 'wednesday'
      ? schoolCheckpoints.map((point) => ({
          ...point,
          label: point.weekendLabel ?? point.label,
        }))
      : schoolCheckpoints;
  return {
    points: isUncertain
      ? defaults
      : (planning.checkpoints[context.profile] ??
        (context.isDayOff ? planning.checkpoints.dayOff : undefined) ??
        defaults),
    heading:
      Object.keys(planning.checkpoints).length > 0 || planning.schoolCalendar
        ? isUncertain
          ? 'Les repères · calendrier à confirmer'
          : `Les repères · ${context.label}`
        : isWeekend(now)
          ? 'Les repères du week-end'
          : 'Les repères · jour d’école habituel',
    note: context.note,
  };
}
