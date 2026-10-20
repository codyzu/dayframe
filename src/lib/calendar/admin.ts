import {ApiError, photoRequest} from '../photos/client.ts';

type CalendarStatus = {
  configured: boolean;
  connected: boolean;
  selected: {id: string; name: string} | undefined;
};
const adminRoot = document.querySelector<HTMLElement>('[data-calendar-admin]');
if (adminRoot) {
  mount(adminRoot);
}

function mount(root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-calendar-status]')!;
  const controls = root.querySelector<HTMLFieldSetElement>('fieldset')!;
  const connect = root.querySelector<HTMLButtonElement>(
    '[data-calendar-connect]',
  )!;
  const disconnect = root.querySelector<HTMLButtonElement>(
    '[data-calendar-disconnect]',
  )!;
  const select = root.querySelector<HTMLSelectElement>('select')!;
  const save = root.querySelector<HTMLButtonElement>('[data-calendar-save]')!;
  let isBusy = false;
  let state: CalendarStatus | undefined;
  function lock() {
    controls.disabled = isBusy || !state?.configured;
    disconnect.hidden = !state?.connected;
    select.disabled = !state?.connected;
    save.disabled = !state?.connected;
    connect.textContent = state?.connected
      ? 'Reconnecter Google Calendar'
      : 'Connecter Google Calendar';
  }

  async function run(action: () => Promise<void>) {
    if (isBusy) {
      return;
    }

    isBusy = true;
    lock();
    try {
      await action();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'Agenda indisponible.';
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        state = undefined;
        select.replaceChildren();
      }
    } finally {
      isBusy = false;
      lock();
    }
  }

  async function load() {
    const response = await photoRequest('/api/calendar');
    state = (await response.json()) as CalendarStatus;
    select.replaceChildren(new Option('Choisir votre agenda partagé', ''));
    status.textContent = state.configured
      ? state.connected
        ? state.selected
          ? `Agenda affiché : ${state.selected.name}`
          : 'Google connecté. Choisissez l’agenda à afficher.'
        : 'Aucun agenda connecté.'
      : 'La configuration Google Calendar reste à terminer sur le serveur.';
    if (!state.connected) {
      return;
    }

    {
      const calendarResponse = await photoRequest('/api/calendar/calendars');
      const body = (await calendarResponse.json()) as {
        calendars: Array<{id: string; name: string}>;
      };
      for (const calendar of body.calendars) {
        select.add(new Option(calendar.name, calendar.id));
      }

      select.value = state.selected?.id ?? '';
    }
  }

  connect.addEventListener('click', () => {
    void run(async () => {
      const response = await photoRequest('/api/calendar/connect', {
        method: 'POST',
      });
      const {url} = (await response.json()) as {url: string};
      if (new URL(url).origin !== 'https://accounts.google.com') {
        throw new Error('Adresse Google invalide.');
      }

      location.assign(url);
    });
  });
  save.addEventListener('click', () => {
    void run(async () => {
      if (select.value === '') {
        throw new Error('Choisissez votre agenda partagé.');
      }

      await photoRequest('/api/calendar', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: select.value}),
      });
      await load();
    });
  });
  disconnect.addEventListener('click', () => {
    void run(async () => {
      await photoRequest('/api/calendar', {method: 'DELETE'});
      await load();
    });
  });
  root
    .querySelector('[data-calendar-refresh]')!
    .addEventListener('click', () => {
      void run(load);
    });
  const result = new URL(location.href).searchParams.get('calendar');
  if (result !== null && result !== 'connected') {
    root.querySelector('[data-calendar-result]')!.textContent =
      'Connexion Google non terminée. Vous pouvez réessayer.';
  }

  void run(load);
}
