import {ApiError, photoRequest} from '../photos/client.ts';

type CalendarOption = {id: string; name: string};
type CalendarSelection = {
  selected?: CalendarOption;
  massageSelected?: CalendarOption;
  routineSelected?: CalendarOption;
  observanceSelected?: CalendarOption;
  secondObservanceSelected?: CalendarOption;
};
type CalendarStatus = CalendarSelection & {
  configured: boolean;
  connected: boolean;
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
  const massageSelect = root.querySelector<HTMLSelectElement>(
    '[data-massage-select]',
  )!;
  const routineSelect = root.querySelector<HTMLSelectElement>(
    '[data-routine-select]',
  )!;
  const observanceSelect = root.querySelector<HTMLSelectElement>(
    '[data-observance-select]',
  )!;
  const secondObservanceSelect = root.querySelector<HTMLSelectElement>(
    '[data-second-observance-select]',
  )!;
  const selects = [
    select,
    massageSelect,
    routineSelect,
    observanceSelect,
    secondObservanceSelect,
  ];
  const save = root.querySelector<HTMLButtonElement>('[data-calendar-save]')!;
  const refresh = root.querySelector<HTMLButtonElement>(
    '[data-calendar-refresh]',
  )!;
  let isBusy = false;
  let state: CalendarStatus | undefined;
  const values = () => JSON.stringify(selects.map((field) => field.value));
  let savedValues = '';

  function lock() {
    controls.disabled = isBusy || !state?.configured;
    disconnect.hidden = !state?.connected;
    for (const field of selects) {
      field.disabled = !state?.connected;
    }

    save.disabled = !state?.connected;
    refresh.disabled = isBusy;
    connect.textContent = state?.connected
      ? 'Reconnecter Google Calendar'
      : 'Connecter Google Calendar';
  }

  function savedLabel(selection: CalendarSelection) {
    const observances = [
      selection.observanceSelected?.name,
      selection.secondObservanceSelected?.name,
    ]
      .filter(Boolean)
      .join(', ');
    return [
      `Agenda affiché : ${selection.selected?.name ?? ''}`,
      selection.massageSelected &&
        `Massages : ${selection.massageSelected.name}`,
      selection.routineSelected &&
        `Routines : ${selection.routineSelected.name}`,
      observances !== '' && `Fêtes observées : ${observances}`,
    ]
      .filter(Boolean)
      .join(' · ');
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
        for (const field of selects) {
          field.replaceChildren();
        }
      }
    } finally {
      isBusy = false;
      lock();
    }
  }

  function connectionLabel(current: CalendarStatus) {
    if (!current.configured) {
      return 'La configuration Google Calendar reste à terminer sur le serveur.';
    }

    if (!current.connected) {
      return 'Aucun agenda connecté.';
    }

    return current.selected
      ? savedLabel(current)
      : 'Google connecté. Choisissez l’agenda à afficher.';
  }

  function showDraftStatus() {
    if (state) {
      status.textContent =
        values() === savedValues
          ? connectionLabel(state)
          : 'Modifications non enregistrées.';
    }
  }

  async function load(isPreservingEdits = false) {
    const draft =
      isPreservingEdits && values() !== savedValues
        ? selects.map((field) => field.value)
        : undefined;
    const response = await photoRequest('/api/calendar');
    state = (await response.json()) as CalendarStatus;
    select.replaceChildren(new Option('Choisir votre agenda partagé', ''));
    massageSelect.replaceChildren(new Option('Aucun agenda de massages', ''));
    routineSelect.replaceChildren(new Option('Aucun agenda de routines', ''));
    for (const field of [observanceSelect, secondObservanceSelect]) {
      field.replaceChildren(new Option('Aucun agenda de fêtes observées', ''));
    }

    status.textContent = connectionLabel(state);
    if (!state.connected) {
      return;
    }

    {
      const calendarResponse = await photoRequest('/api/calendar/calendars');
      const body = (await calendarResponse.json()) as {
        calendars: CalendarOption[];
      };
      for (const calendar of body.calendars) {
        for (const field of selects) {
          field.add(new Option(calendar.name, calendar.id));
        }
      }

      select.value = state.selected?.id ?? '';
      massageSelect.value = state.massageSelected?.id ?? '';
      routineSelect.value = state.routineSelected?.id ?? '';
      observanceSelect.value = state.observanceSelected?.id ?? '';
      secondObservanceSelect.value = state.secondObservanceSelected?.id ?? '';
      savedValues = values();
      if (draft) {
        for (const [index, field] of selects.entries()) {
          if (
            [...field.options].some((option) => option.value === draft[index])
          ) {
            field.value = draft[index];
          }
        }

        showDraftStatus();
      }
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

      status.textContent = 'Enregistrement des agendas…';
      const response = await photoRequest('/api/calendar', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          id: select.value,
          ...(massageSelect.value !== '' && {massageId: massageSelect.value}),
          routineId: routineSelect.value,
          observanceId: observanceSelect.value,
          secondObservanceId: secondObservanceSelect.value,
        }),
      });
      const selection = (await response.json()) as CalendarSelection;
      state = {...state!, ...selection};
      savedValues = values();
      status.textContent = `Agendas enregistrés. ${savedLabel(selection)}`;
    });
  });
  disconnect.addEventListener('click', () => {
    void run(async () => {
      await photoRequest('/api/calendar', {method: 'DELETE'});
      await load();
    });
  });
  refresh.addEventListener('click', () => {
    void run(async () => load(true));
  });
  for (const field of selects) {
    field.addEventListener('change', showDraftStatus);
  }

  const result = new URL(location.href).searchParams.get('calendar');
  if (result !== null && result !== 'connected') {
    root.querySelector('[data-calendar-result]')!.textContent =
      'Connexion Google non terminée. Vous pouvez réessayer.';
  }

  void run(load);
}
