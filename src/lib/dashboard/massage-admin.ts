/* eslint-disable no-alert -- Confirm an action that can restore private photo playback. */
import {photoRequest} from '../photos/client.ts';

const section = document.querySelector<HTMLElement>('[data-massage-admin]');
if (section) {
  mount(section);
}

function mount(root: HTMLElement) {
  const enabled = root.querySelector<HTMLInputElement>(
    '[data-massage-enabled]',
  )!;
  const end = root.querySelector<HTMLButtonElement>('[data-massage-end]')!;
  const status = root.querySelector<HTMLElement>('[data-massage-status]')!;
  const path = '/api/calendar/massage-welcome';
  let isEnabled = false;
  let isReady = false;

  async function run(action: () => Promise<string>) {
    enabled.disabled = true;
    end.disabled = true;
    try {
      status.textContent = await action();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'Accueil indisponible.';
    } finally {
      enabled.checked = isEnabled;
      enabled.disabled = !isReady;
      end.disabled = !isReady || !isEnabled;
    }
  }

  enabled.addEventListener('change', () => {
    const isNextEnabled = enabled.checked;
    if (
      !isNextEnabled &&
      !globalThis.confirm(
        'Désactiver l’accueil ? Le cadre pourra afficher les photos de famille.',
      )
    ) {
      enabled.checked = isEnabled;
      return;
    }

    void run(async () => {
      await photoRequest(path, {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(isNextEnabled),
      });
      isEnabled = isNextEnabled;
      return isNextEnabled
        ? 'Accueil activé. Vérifiez que le cadre est connecté pour recevoir ce réglage.'
        : 'Accueil désactivé. Le cadre reprendra son programme à la prochaine vérification.';
    });
  });

  end.addEventListener('click', () => {
    if (
      globalThis.confirm(
        'Terminer l’accueil en cours ? Le cadre reprendra son programme, qui peut afficher les photos de famille.',
      )
    ) {
      void run(async () => {
        await photoRequest(path, {method: 'POST'});
        return 'Accueil en cours terminé. Le cadre reprendra son programme à la prochaine vérification.';
      });
    }
  });

  void run(async () => {
    const response = await photoRequest(path);
    const body = (await response.json()) as {enabled?: unknown};
    if (typeof body.enabled !== 'boolean') {
      throw new TypeError('Réglage de l’accueil indisponible.');
    }

    isEnabled = body.enabled;
    isReady = true;
    return '';
  });
}
