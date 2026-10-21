export type AgendaEvent = {
  calendar?: 'family' | 'massages';
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};
export type Agenda = {
  connected: boolean;
  massageConnected?: boolean;
  events: AgendaEvent[];
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

export function remainingEvents(
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
    .slice(0, 3);
}

// Bound each calendar independently so a busy workday cannot crowd out family.
export function remainingAgendaEvents(
  events: AgendaEvent[],
  now: number,
  timezone: string,
) {
  return (['family', 'massages'] as const)
    .flatMap((calendar) =>
      remainingEvents(
        events.filter((event) => (event.calendar ?? 'family') === calendar),
        now,
        timezone,
      ),
    )
    .toSorted((a, b) =>
      a.allDay === b.allDay
        ? Date.parse(a.start) - Date.parse(b.start)
        : Number(b.allDay) - Number(a.allDay),
    );
}
