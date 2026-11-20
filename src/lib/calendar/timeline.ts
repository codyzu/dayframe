import {
  agendaObservanceTitleLimit,
  isCivilDate,
  dayEnd,
  remainingAgendaEvents,
  tomorrowAgendaEvents,
  type AgendaEvent,
  type AgendaObservance,
} from './contracts.ts';

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
