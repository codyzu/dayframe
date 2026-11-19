import {type Hour} from '../weather/adapter.ts';
import {hourlyForecastAt} from '../weather/morning.ts';
import {observanceText, type dayContext} from '../dashboard/day-planning.ts';
import {photoRequest} from '../photos/client.ts';
import {conditionFor} from '../weather/conditions.ts';
import {
  agendaObservanceLimit,
  localDate,
  type Agenda,
  type AgendaEvent,
} from './contracts.ts';
import {
  agendaClock,
  agendaTimeline,
  comparableTitle,
  isAgendaObservance,
  isBirthdayEntry,
  type DatedCheckpoints,
  type ForecastPoint,
  type TimelineEntry,
} from './timeline.ts';

type DayContext = ReturnType<typeof dayContext>;
type Notice = {
  label: string;
  tags: Array<{
    label: string;
    type: 'public' | 'school' | 'observed' | 'tentative';
  }>;
};

function noticesForToday(
  data: Agenda | undefined,
  day: DayContext | undefined,
  date: string,
) {
  const holiday = day?.holiday;
  const notices: Notice[] =
    holiday === undefined
      ? []
      : [
          {
            label: holiday,
            tags: [
              {label: 'Jour férié', type: 'public'},
              {label: 'École fermée', type: 'school'},
            ],
          },
        ];
  if (day?.vacation) {
    notices.push({
      label: day.vacation.label,
      tags: [{label: 'Vacances scolaires', type: 'school'}],
    });
  }

  const observed =
    data?.observances?.filter(({start, end}) => start <= date && date < end) ??
    [];
  for (const entry of observed) {
    const isAlreadyShown = notices.some(
      ({label}) => comparableTitle(label) === comparableTitle(entry.title),
    );
    if (!isAlreadyShown) {
      notices.push({
        label: entry.title,
        tags: [
          {label: 'Fête observée', type: 'observed'},
          ...(entry.tentative
            ? [{label: 'Date à confirmer', type: 'tentative'} as const]
            : []),
        ],
      });
    }
  }

  if (day && /indisponible|en cache/v.test(day.note)) {
    notices.push({label: day.note, tags: []});
  }

  if (data?.observanceUnavailable) {
    notices.push({
      label: 'Calendrier des fêtes observées indisponible.',
      tags: [],
    });
  }

  return {notices, observedTitles: observed.map(({title}) => title)};
}

function noticeRows(
  root: HTMLElement,
  notices: Notice[],
  day: DayContext | undefined,
) {
  const template = root.querySelector<HTMLTemplateElement>(
    '[data-observance-template]',
  )!;
  const tagTemplate = root.querySelector<HTMLTemplateElement>(
    '[data-observance-tag-template]',
  )!;
  return notices.map(({label, tags}) => {
    const notice = template.content.firstElementChild!.cloneNode(
      true,
    ) as HTMLElement;
    notice.querySelector('[data-observance-name]')!.textContent = label;
    notice.title = day?.vacation?.label === label ? observanceText(day) : label;
    notice.querySelector('[data-observance-tags]')!.append(
      ...tags.map((tag) => {
        const span = tagTemplate.content.firstElementChild!.cloneNode(
          true,
        ) as HTMLElement;
        span.dataset.type = tag.type;
        span.textContent = tag.label;
        return span;
      }),
    );
    return notice;
  });
}

function appointmentForecast(
  event: AgendaEvent | undefined,
  hours: readonly Hour[],
  date: string,
  timezone: string,
) {
  if (!event || event.allDay) {
    return undefined;
  }

  const start = Date.parse(event.start);
  return localDate(start, timezone) >= date
    ? hourlyForecastAt(hours, start)
    : undefined;
}

function displayWeather(
  row: HTMLElement,
  point: Pick<ForecastPoint, 'forecast' | 'probabilityPeriod'> | undefined,
) {
  const hour = point?.forecast;
  const weather = row.querySelector<HTMLElement>('[data-event-weather]')!;
  weather.hidden = !hour;
  if (!hour) {
    return;
  }

  const condition = conditionFor(hour.code, hour.isDay);
  const temperature = Math.round(hour.temperature);
  weather
    .querySelector('[data-event-weather-icon]')!
    .classList.add(condition.icon);
  weather.querySelector('[data-event-temperature]')!.textContent =
    `${temperature}°`;
  weather.querySelector('[data-event-rain]')!.textContent =
    `${hour.probability} %`;
  weather.setAttribute('role', 'img');
  weather.setAttribute(
    'aria-label',
    `${condition.label} · ${temperature} °C · Probabilité de pluie : maximum horaire ${hour.probability} %, source ${point.probabilityPeriod}`,
  );
}

function agendaRow(
  template: HTMLTemplateElement,
  {event, point, time, appointmentWeather}: TimelineEntry,
  isNext: boolean,
) {
  const row = template.content.firstElementChild!.cloneNode(
    true,
  ) as HTMLElement;
  const source = event ? (event.calendar ?? 'family') : undefined;
  const label =
    source === 'massages'
      ? 'Massages'
      : source === 'family'
        ? 'Famille'
        : 'Repère';
  const name = event?.title ?? point!.label;
  if (source !== undefined) {
    row.dataset.eventCalendar = source;
  }

  row
    .querySelector('[data-birthday-icon]')!
    .toggleAttribute('hidden', !event || !isBirthdayEntry(event));

  if (point) {
    row.dataset.checkpoint = point.time;
  }

  row.toggleAttribute('data-next', isNext);
  row.querySelector('[data-event-time]')!.textContent = time;
  const title = row.querySelector('[data-event-title]')!;
  title.textContent = name;
  title.toggleAttribute('data-next', isNext);
  row.querySelector('[data-event-source]')!.textContent = label;
  row.title = `${label} · ${name}`;
  displayWeather(row, appointmentWeather ?? point);
  return row;
}

function validateResponse(body: Agenda, now: number) {
  if (
    !Array.isArray(body.events) ||
    body.events.length > 12 ||
    typeof body.connected !== 'boolean' ||
    typeof body.fetchedAt !== 'number' ||
    body.fetchedAt > now + 5000 ||
    now - body.fetchedAt >= 300_000 ||
    typeof body.timezone !== 'string' ||
    body.events.some(
      (event) =>
        (event.calendar !== undefined &&
          !['family', 'massages'].includes(event.calendar)) ||
        typeof event.title !== 'string' ||
        typeof event.allDay !== 'boolean' ||
        !Number.isFinite(Date.parse(event.start)) ||
        !Number.isFinite(Date.parse(event.end)),
    )
  ) {
    throw new Error('Invalid agenda');
  }

  localDate(now, body.timezone);
  // The optional source can fail without hiding valid appointments.
  const isObservanceInvalid =
    body.observances !== undefined &&
    (!Array.isArray(body.observances) ||
      body.observances.length > agendaObservanceLimit ||
      body.observances.some((entry) => !isAgendaObservance(entry)));
  return {
    ...body,
    observances: isObservanceInvalid ? undefined : body.observances,
    observanceUnavailable:
      isObservanceInvalid || body.observanceUnavailable === true,
  };
}

// No persistent event cache: privacy expires after five minutes, including offline.
export function mountAgenda(
  root: HTMLElement,
  onObservance?: (isObserved: boolean, titles?: readonly string[]) => void,
) {
  const status = root.querySelector<HTMLElement>('[data-agenda-status]')!;
  const list = root.querySelector<HTMLElement>('[data-agenda-events]')!;
  const dayNotices = root.querySelector<HTMLElement>('[data-day-observance]')!;
  const template = root.querySelector<HTMLTemplateElement>(
    '[data-agenda-template]',
  )!;
  const tomorrow = root.querySelector<HTMLElement>('[data-agenda-tomorrow]')!;
  const tomorrowTitle = root.querySelector<HTMLElement>(
    '[data-agenda-tomorrow-title]',
  )!;
  const tomorrowList = root.querySelector<HTMLElement>(
    '[data-agenda-tomorrow-events]',
  )!;
  const tomorrowEmpty = root.querySelector<HTMLElement>(
    '[data-agenda-tomorrow-empty]',
  )!;
  let pending: AbortController | undefined;
  let nextRefresh = 0;
  let lease = 0;
  let leaseMonotonic = 0;
  let data: Agenda | undefined;
  let previous = '';
  let renderedRows = '';
  let isActive = false;
  let checkpoints: DatedCheckpoints | undefined;
  let day: DayContext | undefined;
  let householdTimezone = 'Europe/Paris';
  let statusMessage = status.textContent?.trim() ?? '';
  let observedSignature = '[]';

  function clear(message: string) {
    data = undefined;
    statusMessage = message;
    render();
  }

  function render() {
    const now = Date.now();
    const timezone = data?.timezone ?? householdTimezone;
    const date = localDate(now, timezone);
    const matchingWeather =
      checkpoints?.timezone === timezone && checkpoints.date === date
        ? checkpoints
        : undefined;
    const preview = agendaTimeline(
      data?.events ?? [],
      now,
      timezone,
      matchingWeather?.points,
    );
    const hours = matchingWeather?.hours ?? [];
    const weatherToday = preview.today.map(({event}) =>
      appointmentForecast(event, hours, date, timezone),
    );
    const weatherTomorrow = preview.tomorrow.map((event) =>
      appointmentForecast(event, hours, date, timezone),
    );
    const {notices, observedTitles} = noticesForToday(data, day, date);
    const observed = JSON.stringify(observedTitles);
    const next = [
      ...preview.today.flatMap(({event}) => (event ? [event] : [])),
      ...preview.tomorrow,
    ].find((event) => !event.allDay && Date.parse(event.start) > now);
    const timeFor = (event: AgendaEvent, isUpcoming = false) =>
      event.allDay
        ? 'Journée'
        : !isUpcoming && Date.parse(event.start) <= now
          ? 'En cours'
          : agendaClock(Date.parse(event.start), timezone);
    const times = preview.today.map(({event, time}) =>
      event ? timeFor(event) : time,
    );
    const rowsSignature = JSON.stringify({
      preview,
      times,
      next,
      timezone,
      weatherToday,
      weatherTomorrow,
    });
    const signature = JSON.stringify({
      rowsSignature,
      notices,
      statusMessage,
      day,
      observed,
      connected: Boolean(data?.connected),
    });
    if (signature === previous) {
      return;
    }

    previous = signature;
    if (observed !== observedSignature) {
      observedSignature = observed;
      onObservance?.(observedTitles.length > 0, observedTitles);
    }

    dayNotices.replaceChildren(...noticeRows(root, notices, day));
    dayNotices.hidden = notices.length === 0;
    if (rowsSignature !== renderedRows) {
      renderedRows = rowsSignature;
      list.replaceChildren(
        ...preview.today.map((entry, index) =>
          agendaRow(
            template,
            {
              ...entry,
              time: times[index],
              appointmentWeather: weatherToday[index],
            },
            Boolean(entry.event && entry.event === next),
          ),
        ),
      );
      list.hidden = preview.today.length === 0;
      tomorrowList.replaceChildren(
        ...preview.tomorrow.map((event, index) =>
          agendaRow(
            template,
            {
              event,
              time: timeFor(event, true),
              appointmentWeather: weatherTomorrow[index],
            },
            event === next,
          ),
        ),
      );
    }

    tomorrowTitle.textContent = `Demain · ${new Intl.DateTimeFormat('fr-FR', {timeZone: timezone, weekday: 'long'}).format(preview.tomorrowStart)}`;
    tomorrow.hidden = !data?.connected || !preview.shouldShowTomorrow;
    tomorrowList.hidden = preview.tomorrow.length === 0;
    tomorrowEmpty.hidden = preview.tomorrow.length > 0;
    status.hidden = Boolean(
      data?.connected && preview.today.some(({event}) => event),
    );
    status.textContent = data?.connected
      ? 'Aucun autre événement aujourd’hui.'
      : statusMessage;
  }

  async function refresh() {
    if (pending !== undefined || !isActive) {
      return;
    }

    const controller = new AbortController();
    pending = controller;
    nextRefresh = Date.now() + 60_000;
    try {
      const response = await photoRequest('/api/calendar/events', {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15_000),
        ]),
      });
      const payload = (await response.json()) as Agenda;
      if (controller.signal.aborted) {
        return;
      }

      const body = validateResponse(payload, Date.now());
      if (
        body.connected ||
        (body.observances?.length ?? 0) > 0 ||
        body.observanceUnavailable
      ) {
        data = body;
        statusMessage = 'Aucun agenda connecté.';
        lease = body.fetchedAt + 300_000;
        leaseMonotonic = performance.now() + Math.max(0, lease - Date.now());
        render();
      } else {
        clear('Aucun agenda connecté.');
      }

      nextRefresh = Date.now() + 240_000;
    } catch {
      if (!controller.signal.aborted) {
        clear('Agenda indisponible. Vérifiez la connexion.');
      }
    } finally {
      pending = undefined;
    }
  }

  return {
    setCheckpoints(value: DatedCheckpoints | undefined) {
      checkpoints = value;
      if (isActive) {
        render();
      }
    },
    setDayContext(context: DayContext, timezone = householdTimezone) {
      day = context;
      householdTimezone = timezone;
    },
    tick(isVisible: boolean) {
      isActive = isVisible;
      if (
        data &&
        (Date.now() >= lease ||
          performance.now() >= leaseMonotonic ||
          Date.now() < data.fetchedAt ||
          localDate(Date.now(), data.timezone) !==
            localDate(data.fetchedAt, data.timezone))
      ) {
        clear('Agenda à actualiser.');
        nextRefresh = 0;
      }

      if (!isVisible) {
        return;
      }

      render();
      if (Date.now() >= nextRefresh) {
        void refresh();
      }
    },
    deny() {
      pending?.abort();
      checkpoints = undefined;
      day = undefined;
      clear('Accès privé requis pour l’agenda.');
      nextRefresh = 0;
    },
    pause() {
      isActive = false;
      pending?.abort();
      clear('Agenda à actualiser.');
      nextRefresh = 0;
    },
    wake() {
      nextRefresh = 0;
    },
  };
}
