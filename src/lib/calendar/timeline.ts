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
    return {start: 'Journée', end: '', endDate: '', isOngoing: false};
  }

  const start = Date.parse(event.start);
  const end = Date.parse(event.end);
  const endDate = localDate(end, timezone);
  const [, month, day] = endDate.split('-', 3);
  return {
    start: agendaClock(start, timezone),
    end: agendaClock(end, timezone),
    endDate: endDate === localDate(start, timezone) ? '' : `(${day}/${month})`,
    isOngoing: start <= now && now < end,
  };
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
  const tomorrowStart = dayEnd(now, timezone);
  return {
    today: remainingAgendaEvents(events, now, timezone),
    tomorrow: tomorrowAgendaEvents(events, tomorrowStart, timezone),
    tomorrowStart,
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
