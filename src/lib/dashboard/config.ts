/**
Public example defaults only. Household settings and credentials do not belong here.
*/
export const displayConfig = {
  locale: 'fr-FR',
  timezone: 'Europe/Paris',
  location: 'Annecy',
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

export const modes = ['morning', 'photos', 'home', 'night'] as const;
export type DisplayMode = (typeof modes)[number];
export function isDisplayMode(value: string): value is DisplayMode {
  return (modes as readonly string[]).includes(value);
}

export function formatClock(now: Date) {
  return {
    time: new Intl.DateTimeFormat(displayConfig.locale, {
      timeZone: displayConfig.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(now),
    date: new Intl.DateTimeFormat(displayConfig.locale, {
      timeZone: displayConfig.timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(now),
  };
}
