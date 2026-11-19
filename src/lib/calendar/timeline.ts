import type {Hour} from '../weather/adapter.ts';
import type {
  checkpointForecasts,
  hourlyForecastAt,
} from '../weather/morning.ts';
import {
  agendaObservanceTitleLimit,
  isCivilDate,
  dayEnd,
  localDate,
  remainingAgendaEvents,
  tomorrowAgendaEvents,
  type AgendaEvent,
  type AgendaObservance,
} from './contracts.ts';

export type ForecastPoint = ReturnType<typeof checkpointForecasts>[number];
export type DatedCheckpoints = {
  date: string;
  timezone: string;
  points: readonly ForecastPoint[];
  hours?: readonly Hour[];
};
export type TimelineEntry = {
  event?: AgendaEvent;
  point?: ForecastPoint;
  appointmentWeather?: ReturnType<typeof hourlyForecastAt>;
  time: string;
};

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

export function agendaClock(now: number, timezone: string) {
  let formatter = timeFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
    });
    timeFormatters.set(timezone, formatter);
  }

  return formatter.format(now);
}

export function comparableTitle(label: string) {
  return label
    .normalize('NFD')
    .replaceAll(/\p{Mark}/gv, '')
    .toLocaleLowerCase('fr-FR')
    .replaceAll(/[^\p{Letter}\p{Number}]+/gv, ' ')
    .trim();
}

export function isBirthdayEntry(event: AgendaEvent) {
  if (!event.allDay) {
    return false;
  }

  const title = comparableTitle(event.title);
  const hasBirthdayPrefix =
    /^(?:anniversaire|anniv|birthday|bday|b day)(?: |$)/v.test(title);
  const hasBirthdaySuffix =
    / (?:anniversaire|anniv|birthday|bday|b day)$/v.test(title) &&
    !/ (?:d|de|for) (?:anniversaire|anniv|birthday|bday|b day)$/v.test(title);
  return hasBirthdayPrefix || hasBirthdaySuffix;
}

const schoolPickup = new Set([
  'sortie',
  'sortie d ecole',
  'sortie de l ecole',
  'sortie ecole',
]);

function sameActivity(checkpoint: string, appointment: string) {
  const point = comparableTitle(checkpoint);
  const event = comparableTitle(appointment);
  return (
    point !== '' &&
    (point === event || (schoolPickup.has(point) && schoolPickup.has(event)))
  );
}

function isMatchingPoint(event: AgendaEvent, point: ForecastPoint) {
  return (
    !event.allDay &&
    (event.calendar ?? 'family') === 'family' &&
    point.at !== undefined &&
    Math.floor(Date.parse(event.start) / 60_000) ===
      Math.floor(point.at / 60_000) &&
    sameActivity(point.label, event.title)
  );
}

export function agendaTimeline(
  events: AgendaEvent[],
  now: number,
  timezone: string,
  points: readonly ForecastPoint[] = [],
) {
  const todayCapacity = 10;
  const date = localDate(now, timezone);
  const localTime = agendaClock(now, timezone);
  const minute = Math.floor(now / 60_000);
  const appointments = remainingAgendaEvents(events, now, timezone);
  const rows: TimelineEntry[] = appointments.map((event) => ({
    event,
    time:
      event.allDay || localDate(Date.parse(event.start), timezone) < date
        ? ''
        : agendaClock(Date.parse(event.start), timezone),
  }));

  for (const point of points) {
    const hasPassed =
      point.at === undefined
        ? point.time < localTime
        : Math.floor(point.at / 60_000) < minute;
    if (hasPassed) {
      continue;
    }

    const matching = rows.filter(
      ({event, point: previous}) =>
        event && !previous && isMatchingPoint(event, point),
    );
    if (matching.length === 1) {
      matching[0].point = point;
    } else if (rows.length < todayCapacity) {
      rows.push({time: point.time, point});
    }
  }

  const tomorrowStart = dayEnd(now, timezone);
  // Preserve actual appointments first and give the divider its own row.
  const spare = Math.min(
    4,
    Math.max(0, todayCapacity - Math.max(1, rows.length) - 1),
  );
  return {
    today: rows.toSorted((a, b) => a.time.localeCompare(b.time)),
    tomorrow: tomorrowAgendaEvents(events, tomorrowStart, timezone).slice(
      0,
      spare,
    ),
    tomorrowStart,
    shouldShowTomorrow: spare > 0,
  };
}

export function isAgendaObservance(value: unknown): value is AgendaObservance {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const {title, start, end, tentative} = value as Partial<AgendaObservance>;
  return (
    typeof title === 'string' &&
    title.trim().length > 0 &&
    title.length <= agendaObservanceTitleLimit &&
    isCivilDate(start) &&
    isCivilDate(end) &&
    start < end &&
    (tentative === undefined || typeof tentative === 'boolean')
  );
}
