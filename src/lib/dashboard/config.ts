/**
Public example defaults only. Household settings and credentials do not belong here.
*/
export const displayConfig = {
  locale: 'fr-FR',
  timezone: 'Europe/Paris',
  location: 'Annecy',
  latitude: 45.8992,
  longitude: 6.1294,
  initialMode: 'morning',
  slideshowIntervalSeconds: 20,
  overrideTimeoutSeconds: 300,
  schedule: [
    {start: '06:00', end: '10:00', mode: 'morning'},
    {start: '10:00', end: '17:00', mode: 'photos'},
    {start: '17:00', end: '21:00', mode: 'home'},
    {start: '21:00', end: '06:00', mode: 'night'},
  ],
} as const;

// Updated only from a validated, authorized display configuration on startup and refresh.
export const runtimeConfig: {
  timezone: string;
  location: string;
  latitude: number;
  longitude: number;
} = {...displayConfig};

export const modes = ['morning', 'photos', 'home', 'night'] as const;
export type DisplayMode = (typeof modes)[number];
export function isDisplayMode(value: string): value is DisplayMode {
  return (modes as readonly string[]).includes(value);
}

let clockTimezone: string | undefined;
let clockTime: Intl.DateTimeFormat;
let clockDate: Intl.DateTimeFormat;

export function formatClock(now: Date) {
  if (clockTimezone !== runtimeConfig.timezone) {
    clockTime = new Intl.DateTimeFormat(displayConfig.locale, {
      timeZone: runtimeConfig.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    clockDate = new Intl.DateTimeFormat(displayConfig.locale, {
      timeZone: runtimeConfig.timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    clockTimezone = runtimeConfig.timezone;
  }

  return {time: clockTime.format(now), date: clockDate.format(now)};
}
