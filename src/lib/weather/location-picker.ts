// @unocss-include
import {
  locationKey,
  locationRequest,
  parseLocations,
  readLocation,
  validateLocation,
  type WeatherLocation,
} from './location.ts';

export function mountLocationPicker(
  root: HTMLElement,
  change: (location?: WeatherLocation) => void,
  current: () => WeatherLocation,
) {
  let storage: Storage | undefined;
  try {
    storage = localStorage;
  } catch {
    // This visit can still use a location when browser storage is blocked.
  }

  let selected = readLocation(storage);
  const openers = [
    ...root.querySelectorAll<HTMLButtonElement>('[data-location-open]'),
  ];
  let opener = openers[0];
  const dialog = root.querySelector<HTMLDialogElement>(
    '[data-location-dialog]',
  )!;
  // Vigilance can hide the decorative header; its modal must remain available.
  root.append(dialog);
  const form = dialog.querySelector<HTMLFormElement>('form')!;
  const input = form.querySelector<HTMLInputElement>('input')!;
  const status = dialog.querySelector<HTMLElement>('[data-location-status]')!;
  const results = dialog.querySelector<HTMLElement>('[data-location-results]')!;
  let pending: AbortController | undefined;

  function cancel() {
    pending?.abort();
    pending = undefined;
  }

  function update() {
    const location = current();
    root.querySelector<HTMLElement>('[data-location-scope]')!.hidden =
      !selected;
    dialog.querySelector('[data-location-current]')!.textContent =
      `${location.location} · ${location.timezone}${selected ? ' · Sur cet appareil' : ' · Lieu de la maison'}`;
  }

  function choose(location?: WeatherLocation) {
    cancel();
    selected = location ? validateLocation(location) : undefined;
    let isSaved = true;
    try {
      if (location) {
        storage?.setItem(locationKey, JSON.stringify(selected));
      } else {
        storage?.removeItem(locationKey);
      }

      isSaved = storage !== undefined;
    } catch {
      isSaved = false;
    }

    change(selected);
    update();
    results.replaceChildren();
    status.textContent = isSaved
      ? 'Lieu météo mis à jour. Vous pouvez fermer cette fenêtre.'
      : 'Lieu changé pour cette visite. Le navigateur ne permet pas d’enregistrer ce choix.';
  }

  async function run(
    request: (
      signal: AbortSignal,
    ) => Promise<Array<WeatherLocation & {label?: string}>>,
  ) {
    cancel();
    const controller = new AbortController();
    pending = controller;
    results.replaceChildren();
    status.textContent = 'Recherche en cours…';
    try {
      const locations = await request(controller.signal);
      if (controller.signal.aborted) {
        return;
      }

      status.textContent =
        locations.length > 0
          ? 'Choisissez un lieu.'
          : 'Aucun lieu trouvé. Précisez la ville et le pays.';
      results.replaceChildren(
        ...locations.map((location) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className =
            'min-h-12 rounded-xl border border-border px-4 py-2 text-left font-bold hover:bg-elevated';
          button.textContent = location.label ?? location.location;
          button.addEventListener('click', () => {
            choose(location);
          });
          return button;
        }),
      );
    } catch {
      if (!controller.signal.aborted) {
        status.textContent =
          'Localisation indisponible ou refusée. Recherchez une ville ou réessayez.';
      }
    } finally {
      if (pending === controller) {
        pending = undefined;
      }
    }
  }

  function openDialog(event: Event) {
    opener = event.currentTarget as HTMLButtonElement;
    update();
    status.textContent = '';
    results.replaceChildren();
    dialog.showModal();
    input.focus();
  }

  for (const button of openers) {
    button.addEventListener('click', openDialog);
  }

  dialog
    .querySelector('[data-location-close]')!
    .addEventListener('click', () => {
      dialog.close();
    });
  dialog.addEventListener('close', () => {
    cancel();
    const target =
      opener.getClientRects().length > 0
        ? opener
        : openers.find((button) => button.getClientRects().length > 0);
    target?.focus({preventScroll: true});
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void run(async (signal) => {
      const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
      url.search = new URLSearchParams({
        name: input.value.trim(),
        language: 'fr',
        count: '8',
      }).toString();
      return parseLocations(await locationRequest(url, signal));
    });
  });
  dialog
    .querySelector('[data-location-reset]')!
    .addEventListener('click', () => {
      choose();
    });
  dialog
    .querySelector('[data-location-geolocate]')!
    .addEventListener('click', () => {
      void run(async (signal) => {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              maximumAge: 300_000,
              timeout: 10_000,
            });
          },
        );
        signal.throwIfAborted();
        // Weather needs only approximate coordinates; never persist precise GPS.
        const latitude = Math.round(position.coords.latitude * 100) / 100;
        const longitude = Math.round(position.coords.longitude * 100) / 100;
        const url = new URL('https://api.open-meteo.com/v1/forecast');
        url.search = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          timezone: 'auto',
          forecast_days: '1',
          current: 'temperature_2m',
        }).toString();
        const data = (await locationRequest(url, signal)) as {
          timezone?: unknown;
        };
        const location = validateLocation({
          location: 'Ma position',
          latitude,
          longitude,
          timezone: data.timezone,
        });
        return [location];
      });
    });
  globalThis.addEventListener('pagehide', () => {
    cancel();
    dialog.close();
  });
  globalThis.addEventListener('storage', (event) => {
    if (!(event.key === locationKey || event.key === null)) {
      return;
    }

    selected = readLocation(storage);
    cancel();
    change(selected);
    update();
  });
  return {selected, update};
}
