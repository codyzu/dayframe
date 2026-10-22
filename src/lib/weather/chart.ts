import {type Hour} from './adapter.ts';
import {twoHourRain} from './morning.ts';

// Coordinates use a 600 × 100 viewBox; CSS controls the displayed chart width.
export function chartGeometry(hours: Hour[]) {
  if (hours.length < 2) {
    return undefined;
  }

  const low = Math.min(...hours.map((hour) => hour.temperature));
  const high = Math.max(...hours.map((hour) => hour.temperature));
  const x = (time: number) =>
    ((time - hours[0].time) / (hours.at(-1)!.time - hours[0].time)) * 600;
  const y = (temperature: number) =>
    92 - ((temperature - (low - 3)) / (high - low + 6)) * 64;
  // Horizontal cubic handles give a smooth bounded curve, without overshoot.
  let path = `M${x(hours[0].time)},${y(hours[0].temperature)}`;
  for (let index = 1; index < hours.length; index++) {
    const before = hours[index - 1];
    const hour = hours[index];
    const middle = (x(before.time) + x(hour.time)) / 2;
    path += ` C${middle},${y(before.temperature)} ${middle},${y(hour.temperature)} ${x(hour.time)},${y(hour.temperature)}`;
  }

  const rain = twoHourRain(hours).map((bar) => ({
    ...bar,
    x: x(bar.start) + 4,
    y: 100 - bar.probability * 0.8,
    width: Math.max(1, x(bar.end) - x(bar.start) - 8),
    height: bar.probability * 0.8,
  }));
  // Label only the first highest interval; dry days still get a useful 0% label.
  let peak: (typeof rain)[number] | undefined;
  for (const bar of rain) {
    if (!peak || bar.probability > peak.probability) {
      peak = bar;
    }
  }

  return {low, high, x, path, rain, peak};
}
