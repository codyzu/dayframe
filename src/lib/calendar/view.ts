import {photoRequest} from '../photos/client.ts';
import {localDate, remainingEvents, type Agenda} from './contracts.ts';

// No persistent event cache: privacy expires after five minutes, including offline.
export function mountAgenda(root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-agenda-status]')!;
  const list = root.querySelector<HTMLElement>('[data-agenda-events]')!;
  const template = root.querySelector<HTMLTemplateElement>(
    '[data-agenda-template]',
  )!;
  let pending: AbortController | undefined;
  let nextRefresh = 0;
  let lease = 0;
  let leaseMonotonic = 0;
  let data: Agenda | undefined;
  let previous = '';
  let isActive = false;

  function clear(message: string) {
    data = undefined;
    previous = '';
    list.replaceChildren();
    list.hidden = true;
    status.hidden = false;
    status.textContent = message;
  }

  function render() {
    if (!data) {
      return;
    }

    const now = Date.now();
    const events = remainingEvents(data.events, now, data.timezone);
    const signature = JSON.stringify(
      events.map((event) => ({
        ...event,
        ongoing: Date.parse(event.start) <= now,
      })),
    );
    if (signature === previous) {
      return;
    }

    previous = signature;
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: data.timezone,
      hour: '2-digit',
      minute: '2-digit',
    });
    list.replaceChildren(
      ...events.map((event) => {
        const row = template.content.firstElementChild!.cloneNode(
          true,
        ) as HTMLElement;
        row.querySelector('[data-event-time]')!.textContent = event.allDay
          ? 'Journée'
          : Date.parse(event.start) <= now
            ? 'En cours'
            : formatter.format(Date.parse(event.start));
        row.querySelector('[data-event-title]')!.textContent = event.title;
        row.title = event.title;
        return row;
      }),
    );
    list.hidden = events.length === 0;
    status.hidden = events.length > 0;
    status.textContent = 'Aucun autre événement aujourd’hui.';
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
      const body = (await response.json()) as Agenda;
      if (controller.signal.aborted) {
        return;
      }

      if (
        !Array.isArray(body.events) ||
        body.events.length > 3 ||
        typeof body.connected !== 'boolean' ||
        typeof body.fetchedAt !== 'number' ||
        body.fetchedAt > Date.now() + 5000 ||
        Date.now() - body.fetchedAt >= 300_000 ||
        typeof body.timezone !== 'string' ||
        body.events.some(
          (event) =>
            typeof event.title !== 'string' ||
            typeof event.allDay !== 'boolean' ||
            !Number.isFinite(Date.parse(event.start)) ||
            !Number.isFinite(Date.parse(event.end)),
        )
      ) {
        throw new Error('Invalid agenda');
      }

      localDate(Date.now(), body.timezone);
      if (body.connected) {
        data = body;
        previous = '';
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
