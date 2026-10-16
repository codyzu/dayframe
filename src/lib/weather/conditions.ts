// @unocss-include
// Literal classes keep all icon variants in the production bundle.
export const conditions = {
  clear: {
    label: 'Ciel dégagé',
    day: 'i-meteocons-clear-day-fill',
    night: 'i-meteocons-clear-night-fill',
  },
  fair: {
    label: 'Quelques éclaircies',
    day: 'i-meteocons-partly-cloudy-day-fill',
    night: 'i-meteocons-partly-cloudy-night-fill',
  },
  cloudy: {
    label: 'Ciel couvert',
    day: 'i-meteocons-overcast-day-fill',
    night: 'i-meteocons-overcast-night-fill',
  },
  fog: {
    label: 'Brouillard',
    day: 'i-meteocons-fog-day-fill',
    night: 'i-meteocons-fog-night-fill',
  },
  drizzle: {
    label: 'Bruine',
    day: 'i-meteocons-partly-cloudy-day-drizzle-fill',
    night: 'i-meteocons-partly-cloudy-night-drizzle-fill',
  },
  freezing: {
    label: 'Précipitations verglaçantes',
    day: 'i-meteocons-partly-cloudy-day-sleet-fill',
    night: 'i-meteocons-partly-cloudy-night-sleet-fill',
  },
  rain: {
    label: 'Pluie',
    day: 'i-meteocons-partly-cloudy-day-rain-fill',
    night: 'i-meteocons-partly-cloudy-night-rain-fill',
  },
  snow: {
    label: 'Neige',
    day: 'i-meteocons-partly-cloudy-day-snow-fill',
    night: 'i-meteocons-partly-cloudy-night-snow-fill',
  },
  showers: {
    label: 'Averses',
    day: 'i-meteocons-overcast-day-rain-fill',
    night: 'i-meteocons-overcast-night-rain-fill',
  },
  storm: {
    label: 'Orage',
    day: 'i-meteocons-thunderstorms-day-fill',
    night: 'i-meteocons-thunderstorms-night-fill',
  },
  hail: {
    label: 'Orage avec grêle',
    day: 'i-meteocons-extreme-day-hail-fill',
    night: 'i-meteocons-extreme-night-hail-fill',
  },
  unknown: {
    label: 'Conditions inconnues',
    day: 'i-meteocons-not-available-fill',
    night: 'i-meteocons-not-available-fill',
  },
} as const;

export const wmoConditions: Record<number, keyof typeof conditions> = {
  0: 'clear',
  1: 'fair',
  2: 'fair',
  3: 'cloudy',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  56: 'freezing',
  57: 'freezing',
  61: 'rain',
  63: 'rain',
  65: 'rain',
  66: 'freezing',
  67: 'freezing',
  71: 'snow',
  73: 'snow',
  75: 'snow',
  77: 'snow',
  80: 'showers',
  81: 'showers',
  82: 'showers',
  85: 'snow',
  86: 'snow',
  95: 'storm',
  96: 'hail',
  97: 'storm',
  99: 'hail',
};

export function conditionFor(code: number | undefined, isDay: boolean) {
  const condition =
    conditions[
      code === undefined ? 'unknown' : (wmoConditions[code] ?? 'unknown')
    ];
  return {
    label: condition.label,
    icon: isDay ? condition.day : condition.night,
  };
}
