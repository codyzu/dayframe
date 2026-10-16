import {hourLabel, type Weather} from './adapter.ts';
import {wmoConditions} from './conditions.ts';

export function forecastHours(weather: Weather, now: number) {
  const start = Math.floor(now / 3_600_000) * 3_600_000;
  return weather.hourly.filter(
    (hour) => hour.time >= start && hour.time < start + 12 * 3_600_000,
  );
}

// A risk is >=50% probability or >=0.1 mm forecast precipitation. It is not an observation.
// Describe the 12 hourly samples (starting with this hour); never infer "dry all day" from a partial forecast.
export function summarize(weather: Weather, now: number) {
  const kind =
    weather.current.code === undefined
      ? undefined
      : wmoConditions[weather.current.code];
  const current =
    kind === 'snow'
      ? 'Neige actuellement.'
      : kind === 'freezing'
        ? 'Risque de verglas actuellement.'
        : kind === 'storm' || kind === 'hail'
          ? 'Orage actuellement.'
          : weather.current.precipitation >= 0.1 ||
              ['rain', 'drizzle', 'showers'].includes(kind ?? '')
            ? 'Pluie actuellement.'
            : kind === undefined
              ? 'Précipitations actuelles inconnues.'
              : 'Pas de pluie actuellement.';
  const hours = forecastHours(weather, now);
  if (hours.length < 12) {
    return {current, outlook: 'Prévisions à venir indisponibles.'};
  }

  const wet = hours.find(
    (hour) => hour.probability >= 50 || hour.precipitation >= 0.1,
  );
  const outlook = wet
    ? `${wet.time <= now ? 'Précipitations possibles cette heure' : `Précipitations possibles vers ${hourLabel(wet.time)}`} ; prévoyez un parapluie.`
    : 'Faible risque de précipitations sur la période affichée.';
  return {current, outlook};
}
