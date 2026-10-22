/* eslint-disable unicorn/no-await-expression-member -- Keep response parsing beside each small administration request. */
/* eslint-disable no-alert -- Confirm credential rotation/revocation before disconnecting the household frame. */
import {invalidateOfflinePhotos} from '../photos/offline.ts';
import {ApiError, photoRequest} from '../photos/client.ts';
import {
  emptyPlanning,
  dayOffSchedule,
  type DayPlanning,
  type DayProfile,
  type RoutinePoint,
} from './day-planning.ts';
import {validateSettings, type Settings} from './settings.ts';

const adminRoot = document.querySelector<HTMLElement>('[data-settings-admin]');
if (adminRoot) {
  mount(adminRoot);
}

function mount(root: HTMLElement) {
  root
    .querySelector('a[href="/cdn-cgi/access/logout"]')
    ?.addEventListener('click', invalidateOfflinePhotos);
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const form = root.querySelector<HTMLFormElement>('form')!;
  const controls = root.querySelector<HTMLFieldSetElement>('[data-controls]')!;
  const periods = root.querySelector<HTMLElement>('[data-schedule]')!;
  const token = root.querySelector<HTMLOutputElement>('[data-token]')!;
  const panel = root.querySelector<HTMLElement>('[data-token-panel]')!;
  const credential = root.querySelector<HTMLElement>(
    '[data-credential-status]',
  )!;
  const issue = root.querySelector<HTMLButtonElement>('[data-issue]')!;
  const revoke = root.querySelector<HTMLButtonElement>('[data-revoke]')!;
  const profile = root.querySelector<HTMLSelectElement>('[data-day-profile]')!;
  const dayPeriods = root.querySelector<HTMLElement>('[data-day-schedule]')!;
  const pointRows = root.querySelector<HTMLElement>('[data-day-checkpoints]')!;
  const schoolCalendar = root.querySelector<HTMLInputElement>(
    '[data-school-calendar]',
  )!;
  let planning: DayPlanning = structuredClone(emptyPlanning);
  let activeProfile: DayProfile = 'dayOff';
  const readPeriods = (container: HTMLElement) =>
    [...container.children].map((row) => ({
      start: row.querySelector<HTMLInputElement>('[data-start]')!.value,
      end: row.querySelector<HTMLInputElement>('[data-end]')!.value,
      mode: row.querySelector<HTMLSelectElement>('[data-mode]')!
        .value as Settings['schedule'][number]['mode'],
    }));
  function retainProfile() {
    const entries = readPeriods(dayPeriods);
    if (entries.length > 0) {
      planning.schedules[activeProfile] = entries;
    } else {
      Reflect.deleteProperty(planning.schedules, activeProfile);
    }

    const points = [...pointRows.children].map((row) => ({
      time: row.querySelector<HTMLInputElement>('[data-point-time]')!.value,
      label: row.querySelector<HTMLInputElement>('[data-point-label]')!.value,
    }));
    if (points.length > 0) {
      planning.checkpoints[activeProfile] = points;
    } else {
      Reflect.deleteProperty(planning.checkpoints, activeProfile);
    }
  }

  function addPoint(point: RoutinePoint) {
    const template = root.querySelector<HTMLTemplateElement>(
      '[data-checkpoint-template]',
    )!;
    const row = template.content.firstElementChild!.cloneNode(
      true,
    ) as HTMLElement;
    row.querySelector<HTMLInputElement>('[data-point-time]')!.value =
      point.time;
    row.querySelector<HTMLInputElement>('[data-point-label]')!.value =
      point.label;
    row.querySelector('[data-remove]')!.addEventListener('click', () => {
      row.remove();
    });
    pointRows.append(row);
  }

  function showProfile() {
    dayPeriods.replaceChildren();
    pointRows.replaceChildren();
    for (const entry of planning.schedules[activeProfile] ?? []) {
      addPeriod(entry, dayPeriods);
    }

    for (const point of planning.checkpoints[activeProfile] ?? []) {
      addPoint(point);
    }

    root.querySelector('[data-day-fallback]')!.textContent =
      activeProfile === 'saturday' || activeProfile === 'sunday'
        ? 'Les horaires de ce jour priment le week-end. Pendant les vacances et jours fériés, Jours de repos reste prioritaire.'
        : 'Sans horaires spécifiques, le programme quotidien est conservé.';
  }

  profile.addEventListener('change', () => {
    retainProfile();
    activeProfile = profile.value as DayProfile;
    showProfile();
  });
  root.querySelector('[data-add-day-period]')!.addEventListener('click', () => {
    if (dayPeriods.children.length === 0) {
      for (const entry of activeProfile === 'dayOff'
        ? dayOffSchedule
        : readPeriods(periods)) {
        addPeriod(entry, dayPeriods);
      }
    } else if (dayPeriods.children.length < 24) {
      addPeriod({start: '00:00', end: '01:00', mode: 'photos'}, dayPeriods);
    }
  });
  root
    .querySelector('[data-reset-day-periods]')!
    .addEventListener('click', () => {
      dayPeriods.replaceChildren();
    });
  root.querySelector('[data-add-checkpoint]')!.addEventListener('click', () => {
    if (pointRows.children.length < 4) {
      addPoint({time: '', label: ''});
    }
  });
  root
    .querySelector('[data-reset-checkpoints]')!
    .addEventListener('click', () => {
      pointRows.replaceChildren();
    });
  let isBusy = false;
  let isAuthorized = false;
  const hideToken = () => {
    token.textContent = '';
    panel.hidden = true;
  };

  const lock = () => {
    controls.disabled = isBusy || !isAuthorized;
    issue.disabled = isBusy || !isAuthorized;
    revoke.disabled = isBusy || !isAuthorized;
  };

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
        error instanceof Error ? error.message : 'Action indisponible.';
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        isAuthorized = false;
        hideToken();
        credential.textContent = '';
        form.reset();
        periods.replaceChildren();
        planning = structuredClone(emptyPlanning);
        dayPeriods.replaceChildren();
        pointRows.replaceChildren();
      }
    } finally {
      isBusy = false;
      lock();
    }
  }

  function addPeriod(entry: Settings['schedule'][number], container = periods) {
    const template = root.querySelector<HTMLTemplateElement>(
      '[data-period-template]',
    )!;
    const row = template.content.firstElementChild!.cloneNode(
      true,
    ) as HTMLElement;
    row.querySelector<HTMLInputElement>('[data-start]')!.value = entry.start;
    row.querySelector<HTMLInputElement>('[data-end]')!.value = entry.end;
    row.querySelector<HTMLSelectElement>('[data-mode]')!.value = entry.mode;
    row.querySelector('[data-remove]')!.addEventListener('click', () => {
      row.remove();
    });
    container.append(row);
  }

  function readForm() {
    retainProfile();
    planning.schoolCalendar = schoolCalendar.checked;
    const values = Object.fromEntries(new FormData(form));
    for (const key of [
      'latitude',
      'longitude',
      'slideshowIntervalSeconds',
      'overrideTimeoutSeconds',
    ]) {
      (values as Record<string, unknown>)[key] = Number(values[key]);
    }

    return validateSettings({
      ...values,
      schedule: readPeriods(periods),
      planning,
    });
  }

  async function initialize() {
    const session = (await (await photoRequest('/api/session')).json()) as {
      role: string;
      subject: string;
    };
    if (session.role !== 'admin') {
      throw new ApiError('Accès administrateur requis.', 403);
    }

    const settings = validateSettings(
      await (await photoRequest('/api/config')).json(),
    );
    for (const [name, value] of Object.entries(settings)) {
      if (name === 'schedule' || typeof value === 'object') {
        continue;
      }

      const input = form.elements.namedItem(name) as
        HTMLInputElement | undefined;
      if (input) {
        input.value = String(value);
      }
    }

    planning = structuredClone(settings.planning);
    schoolCalendar.checked = planning.schoolCalendar;
    activeProfile = profile.value as DayProfile;
    showProfile();
    periods.replaceChildren();
    for (const entry of settings.schedule) {
      addPeriod(entry);
    }

    const state = (await (await photoRequest('/api/display')).json()) as
      | {
          expiresAt: number;
        }
      | undefined;
    credential.textContent = state
      ? `Clé valable jusqu’au ${new Date(state.expiresAt).toLocaleDateString('fr-FR')}. Remplacez-la pour reconnecter le cadre.`
      : 'Aucun cadre connecté.';
    isAuthorized = true;
    status.textContent = `Connecté : ${session.subject}`;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    // Read before disabling the fieldset: disabled controls are absent from FormData.
    let settings: Settings;
    try {
      settings = readForm();
    } catch (error) {
      status.textContent = (error as Error).message;
      return;
    }

    void run(async () => {
      await photoRequest('/api/config', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(settings),
      });
      status.textContent = 'Réglages enregistrés.';
    });
  });
  root.querySelector('[data-reload]')!.addEventListener('click', () => {
    void run(initialize);
  });
  root.querySelector('[data-add-period]')!.addEventListener('click', () => {
    if (periods.children.length < 24) {
      addPeriod({start: '00:00', end: '01:00', mode: 'photos'});
    }
  });
  issue.addEventListener('click', () => {
    if (
      !confirm(
        'Remplacer la clé et déconnecter le cadre actuellement connecté ?',
      )
    ) {
      return;
    }

    hideToken();
    void run(async () => {
      const result = (await (
        await photoRequest('/api/display', {method: 'POST'})
      ).json()) as {token: string; expiresAt: number};
      token.textContent = result.token;
      panel.hidden = false;
      credential.textContent = `Nouvelle clé valable jusqu’au ${new Date(result.expiresAt).toLocaleDateString('fr-FR')}.`;
      status.textContent = 'Clé créée. Saisissez-la dans /setup sur le cadre.';
    });
  });
  revoke.addEventListener('click', () => {
    if (!confirm('Révoquer la clé et déconnecter le cadre ?')) {
      return;
    }

    hideToken();
    void run(async () => {
      await photoRequest('/api/display', {method: 'DELETE'});
      credential.textContent = 'Clé révoquée.';
      status.textContent = 'Les prochaines requêtes du cadre seront refusées.';
    });
  });
  root.querySelector('[data-hide-token]')!.addEventListener('click', hideToken);
  root.querySelector('[data-export]')!.addEventListener('click', () => {
    void run(async () => {
      const response = await photoRequest('/api/config');
      const settings = validateSettings(await response.json());
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(settings, null, 2)], {
          type: 'application/json',
        }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = 'dayframe-settings.json';
      link.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
    });
  });
  globalThis.addEventListener('pagehide', hideToken);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hideToken();
    }
  });
  void run(initialize);
}
