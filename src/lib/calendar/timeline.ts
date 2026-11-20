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

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function agendaClock(now: number, timezone: string) {
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

export function agendaTimes(event: AgendaEvent, now: number, timezone: string) {
  if (event.allDay) {
    return {start: 'Journée', end: ''};
  }

  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  const isOngoing = start <= now;
  const endDate = localDate(end, timezone);
  const endClock = agendaClock(end, timezone);
  const [, month, day] = endDate.split('-', 3);
  const endLabel =
    endDate === localDate(Math.max(start, now), timezone)
      ? endClock
      : `${endClock} (${day}/${month})`;
  return isOngoing
    ? {start: 'En cours', end: `jusqu’à ${endLabel}`}
    : {start: agendaClock(start, timezone), end: `–${endLabel}`};
}

export function agendaDisplayTitle(event: AgendaEvent) {
  const original = {title: event.title, duration: ''};
  if (event.calendar !== 'massages' || event.allDay) {
    return original;
  }

  // Cal.com French template: service entre organisateur et client.
  const [service, people, extra] = event.title
    .trim()
    .replaceAll(/\s+/gv, ' ')
    .split(/ entre /iv, 3);
  if (
    extra !== undefined ||
    people === undefined ||
    people === '' ||
    !/^massage(?: |$)/iv.test(service)
  ) {
    return original;
  }

  const [host, client, ambiguous] = people.split(/ et /iv, 3);
  if (
    ambiguous !== undefined ||
    host === '' ||
    client === undefined ||
    client === ''
  ) {
    return original;
  }

  const minutes = Math.round(
    (Date.parse(event.end) - Date.parse(event.start)) / 60_000,
  );
  return {title: client, duration: `${minutes} min`};
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

export function agendaTimeline(
  events: AgendaEvent[],
  now: number,
  timezone: string,
) {
  const today = remainingAgendaEvents(events, now, timezone);
  const tomorrowStart = dayEnd(now, timezone);
  // Preserve today's appointments (or the empty message) and the divider.
  const spare = Math.min(4, 10 - Math.max(1, today.length) - 1);
  return {
    today,
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
