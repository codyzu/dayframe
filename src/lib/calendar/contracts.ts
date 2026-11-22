export const appointmentCalendars = ['family', 'massages', 'routines'] as const;
export const agendaRowBudget = 10;
const appointmentsPerDay = agendaRowBudget - 1;
export const agendaAppointmentLimit = 2 * appointmentsPerDay;

export type AgendaEvent = {
  calendar?: (typeof appointmentCalendars)[number];
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  weatherRelevant?: true;
};
export type AgendaObservance = {
  title: string;
  start: string;
  end: string;
  tentative?: boolean;
};
export const agendaObservanceLimit = 2;
export const agendaObservanceTitleLimit = 120;
export function isCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/v.test(value)) {
    return false;
  }

  const instant = Date.parse(value);
  return (
    Number.isFinite(instant) &&
    new Date(instant).toISOString().slice(0, 10) === value
  );
}

export type Agenda = {
  connected: boolean;
  massageConnected?: boolean;
  routineConnected?: boolean;
  routineUnavailable?: boolean;
  events: AgendaEvent[];
  observances?: AgendaObservance[];
  observanceUnavailable?: boolean;
  timezone: string;
  fetchedAt: number;
};

let dateFormatter: Intl.DateTimeFormat | undefined;
let formatterTimezone: string | undefined;
export function localDate(time: number, timezone: string) {
  if (!dateFormatter || formatterTimezone !== timezone) {
    dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    formatterTimezone = timezone;
  }

  return dateFormatter.format(time);
}

// Find the next local date boundary on the UTC timeline, including 23/25-hour days.
export function dayEnd(now: number, timezone: string) {
  const date = localDate(now, timezone);
  let low = now;
  let high = now + 36 * 3_600_000;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localDate(middle, timezone) === date) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return high;
}

export function remainingAgendaEvents(
  events: AgendaEvent[],
  now: number,
  timezone: string,
) {
  const today = localDate(now, timezone);
  return events
    .filter((event) =>
      event.allDay
        ? event.start <= today && event.end > today
        : Date.parse(event.end) > now &&
          localDate(Date.parse(event.start), timezone) <= today,
    )
    .sort((a, b) =>
      a.allDay === b.allDay
        ? Date.parse(a.start) - Date.parse(b.start) ||
          appointmentCalendars.indexOf(a.calendar ?? 'family') -
            appointmentCalendars.indexOf(b.calendar ?? 'family')
        : Number(b.allDay) - Number(a.allDay),
    )
    .slice(0, appointmentsPerDay);
}

// Tomorrow contains new starts only; ongoing/multi-day events already belong to today.
// Bound each day across all calendars before the view applies its shared row budget.
export function agendaWindowEvents(
  events: AgendaEvent[],
  now: number,
  timezone: string,
) {
  const tomorrowStart = dayEnd(now, timezone);
  return [
    ...remainingAgendaEvents(events, now, timezone),
    ...tomorrowAgendaEvents(events, tomorrowStart, timezone),
  ];
}

export function tomorrowAgendaEvents(
  events: AgendaEvent[],
  tomorrowStart: number,
  timezone: string,
) {
  const tomorrow = localDate(tomorrowStart, timezone);
  const startsTomorrow = events.filter(
    (event) =>
      (event.allDay
        ? event.start
        : localDate(Date.parse(event.start), timezone)) === tomorrow,
  );
  return remainingAgendaEvents(startsTomorrow, tomorrowStart, timezone);
}
