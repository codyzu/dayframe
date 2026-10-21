import type {DisplayMode} from './config.ts';

export const weekdays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;
const weekdayNames = {
  monday: 'Lundi',
  tuesday: 'Mardi',
  wednesday: 'Mercredi',
  thursday: 'Jeudi',
  friday: 'Vendredi',
  saturday: 'Samedi',
  sunday: 'Dimanche',
};
export type DayProfile = (typeof weekdays)[number] | 'dayOff';
export type Period = {start: string; end: string; mode: DisplayMode};
export type RoutinePoint = {time: string; label: string};
export type DayPlanning = {
  schoolCalendar: boolean;
  schedules: Partial<Record<DayProfile, Period[]>>;
  checkpoints: Partial<Record<DayProfile, RoutinePoint[]>>;
};
export const emptyPlanning: DayPlanning = {
  schoolCalendar: false,
  schedules: {},
  checkpoints: {},
};
export const dayOffSchedule: Period[] = [
  {start: '08:00', end: '11:00', mode: 'morning'},
  {start: '11:00', end: '23:00', mode: 'photos'},
  {start: '23:00', end: '08:00', mode: 'night'},
];
export type OfficialCalendar = {
  year: number;
  fetchedAt: number;
  knownFrom: string;
  knownUntil: string;
  vacations: Array<{start: string; end: string; label: string}>;
  holidays: Record<string, string>;
};
export const calendarMaximumAge = 30 * 86_400_000;
const parisDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function frenchDate(time: number) {
  return parisDate.format(new Date(time));
}

function isCalendarKnown(
  now: number,
  timezone: string,
  planning: DayPlanning,
  calendar: OfficialCalendar | undefined,
): calendar is OfficialCalendar {
  const date = frenchDate(now);
  return (
    planning.schoolCalendar &&
    timezone === 'Europe/Paris' &&
    calendar?.year === Number(date.slice(0, 4)) &&
    now >= calendar.fetchedAt &&
    now - calendar.fetchedAt < calendarMaximumAge &&
    date >= calendar.knownFrom &&
    date < calendar.knownUntil
  );
}

let weekdayTimezone: string | undefined;
let weekdayFormatter: Intl.DateTimeFormat;
export function dayContext(
  now: number,
  timezone: string,
  planning: DayPlanning,
  calendar?: OfficialCalendar,
) {
  if (weekdayTimezone !== timezone) {
    weekdayTimezone = timezone;
    weekdayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
    });
  }

  const weekday = weekdayFormatter
    .format(now)
    .toLowerCase() as (typeof weekdays)[number];
  const date = frenchDate(now);
  const isKnown = isCalendarKnown(now, timezone, planning, calendar);
  const vacation = isKnown
    ? calendar.vacations.find(({start, end}) => date >= start && date < end)
    : undefined;
  const holiday = isKnown ? calendar.holidays[date] : undefined;
  const isWeekend = weekday === 'saturday' || weekday === 'sunday';
  const isDayOff = isWeekend || Boolean(vacation ?? holiday);
  const profile: DayProfile =
    vacation !== undefined ||
    holiday !== undefined ||
    (isWeekend &&
      planning.schedules[weekday] === undefined &&
      planning.checkpoints[weekday] === undefined)
      ? 'dayOff'
      : weekday;
  const isStale = isKnown && now - calendar.fetchedAt >= 86_400_000;
  const label =
    holiday ??
    vacation?.label ??
    (isWeekend ? 'Week-end' : weekdayNames[weekday]);
  return {
    profile,
    weekday,
    isDayOff,
    isKnown,
    label,
    vacation,
    holiday,
    note: planning.schoolCalendar
      ? isKnown
        ? isStale
          ? 'Calendrier scolaire en cache · mise à jour en attente'
          : 'Zone A · académie de Grenoble'
        : 'Calendrier scolaire indisponible · à confirmer'
      : '',
  };
}

function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/v.test(value)) {
    return false;
  }

  const instant = Date.parse(`${value}T12:00:00Z`);
  return (
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === value
  );
}

export function validateOfficialCalendar(value: unknown): OfficialCalendar {
  const calendar = value as OfficialCalendar;
  if (
    value === null ||
    typeof value !== 'object' ||
    !Number.isSafeInteger(calendar.year) ||
    !Number.isFinite(calendar.fetchedAt) ||
    !isDate(calendar.knownFrom) ||
    !isDate(calendar.knownUntil) ||
    calendar.knownFrom >= calendar.knownUntil ||
    !Array.isArray(calendar.vacations) ||
    calendar.vacations.length > 100 ||
    calendar.holidays === null ||
    typeof calendar.holidays !== 'object' ||
    Array.isArray(calendar.holidays) ||
    Object.keys(calendar.holidays).length > 20
  ) {
    throw new Error('Calendrier invalide.');
  }

  for (const entry of calendar.vacations) {
    validateVacation(entry);
  }

  for (const [date, label] of Object.entries(calendar.holidays)) {
    if (typeof label !== 'string' || label.length > 100 || !isDate(date)) {
      throw new Error('Calendrier invalide.');
    }
  }

  return calendar;
}

function validateVacation(entry: OfficialCalendar['vacations'][number]) {
  if (
    entry === null ||
    typeof entry !== 'object' ||
    !isDate(entry.start) ||
    !isDate(entry.end) ||
    entry.start >= entry.end ||
    typeof entry.label !== 'string' ||
    entry.label.length > 100
  ) {
    throw new Error('Calendrier invalide.');
  }
}

const returnFormatter = new Intl.DateTimeFormat('fr-FR', {
  timeZone: 'Europe/Paris',
  day: 'numeric',
  month: 'long',
});
export function observanceText(context: ReturnType<typeof dayContext>) {
  return [
    context.holiday === undefined ? '' : `Férié : ${context.holiday}`,
    context.vacation
      ? `${context.vacation.label} · jusqu’au ${returnFormatter.format(Date.parse(`${context.vacation.end}T12:00:00Z`) - 86_400_000)}`
      : '',
    context.note.includes('indisponible') || context.note.includes('en cache')
      ? context.note
      : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
