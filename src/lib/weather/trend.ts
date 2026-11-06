import {type Weather} from './adapter.ts';

const amountFormatter = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 1,
});
export function precipitationLabel(amount: number | undefined) {
  if (amount === undefined) {
    return '—';
  }

  return amount > 0 && amount < 0.1 ? '<0,1' : amountFormatter.format(amount);
}

// Independent scales. The amount axis always starts at zero and spans at least
// 30mm, so a few millimetres never become a deceptively tall dry-week bar.
export function trendGeometry(
  dates: string[],
  daily: Weather['daily'],
  width: number,
) {
  const gutter = 104;
  const slot = (width - gutter) / dates.length;
  const highs = daily
    .filter((day) => dates.includes(day.date))
    .map((day) => day.high);
  const low = highs.length > 0 ? Math.min(...highs) - 3 : 0;
  const high = highs.length > 0 ? Math.max(...highs) + 3 : 1;
  const amounts = daily
    .filter((day) => dates.includes(day.date))
    .map((day) => day.precipitation ?? 0);
  const amountCeiling = Math.max(
    30,
    Math.ceil(Math.max(0, ...amounts) / 10) * 10,
  );
  let path = '';
  let hasPrevious = false;
  const points = dates.map((date, index) => {
    const day = daily.find((entry) => entry.date === date);
    const x = gutter + (index + 0.3) * slot;
    const rainX = gutter + (index + 0.75) * slot;
    const y = day ? 48 - ((day.high - low) / (high - low)) * 28 : 38;
    if (day) {
      path += `${hasPrevious ? ' L' : ' M'}${x},${y}`;
    }

    hasPrevious = day !== undefined;
    const rainHeight =
      day?.precipitation === undefined
        ? 0
        : (day.precipitation / amountCeiling) * 32;
    return {date, day, x, y, rainX, rainHeight, rainY: 54 - rainHeight};
  });
  return {points, path: path.trim(), amountCeiling};
}
