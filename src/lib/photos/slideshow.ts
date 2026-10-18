import {defaultSettings, type Settings} from '../dashboard/settings.ts';
import {
  ApiError,
  fetchCatalog,
  photoRequest,
  type DisplayPhoto,
} from './client.ts';

export function shufflePhotos(
  ids: string[],
  previous?: string,
  random = Math.random,
) {
  const result = [...ids];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const swapped = result[i];
    result[i] = result[j];
    result[j] = swapped;
  }

  if (result.length > 1 && result[0] === previous) {
    const swapped = result[0];
    result[0] = result[1];
    result[1] = swapped;
  }

  return result;
}

type LoadedPhoto = {id: string; url: string; image: HTMLImageElement};
export function mountSlideshow(
  root: HTMLElement,
  settings: Settings = defaultSettings,
) {
  const stage = root.querySelector<HTMLElement>('[data-photo-stage]')!;
  const status = root.querySelector<HTMLElement>('[data-photo-status]')!;
  const empty = root.querySelector<HTMLElement>('[data-photo-empty]')!;
  const fit = root.querySelector<HTMLSelectElement>('[data-photo-fit]')!;
  let catalog: DisplayPhoto[] = [];
  let queue: string[] = [];
  let current: LoadedPhoto | undefined;
  let next: LoadedPhoto | undefined;
  let isActive = false;
  let generation = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let refreshAt = 0;
  let privacyTimer: ReturnType<typeof setTimeout> | undefined;
  let controller = new AbortController();
  let leaseWall = 0;
  let leaseMonotonic = 0;
  const release = (photo: LoadedPhoto | undefined) => {
    if (!photo) {
      return;
    }

    photo.image.removeAttribute('src');
    URL.revokeObjectURL(photo.url);
  };

  const clear = () => {
    release(current);
    release(next);
    current = undefined;
    next = undefined;
    stage.replaceChildren();
    catalog = [];
    queue = [];
    empty.hidden = false;
  };

  function expirePrivacy() {
    generation++;
    controller.abort();
    controller = new AbortController();
    clearTimeout(timer);
    clearTimeout(privacyTimer);
    clear();
    refreshAt = 0;
    status.textContent =
      'Accès privé à vérifier. Reconnectez le cadre au réseau.';
    if (isActive) {
      void tick();
    }
  }

  function renewPrivacyLease() {
    leaseWall = Date.now() + 300_000;
    leaseMonotonic = performance.now() + 300_000;
    clearTimeout(privacyTimer);
    privacyTimer = setTimeout(expirePrivacy, 300_000);
  }

  fit.addEventListener('change', () => {
    stage.dataset.fit = fit.value === 'cover' ? 'cover' : 'contain';
  });
  stage.dataset.fit = settings.fit;
  fit.value = settings.fit;

  async function load(id: string, signal: AbortSignal): Promise<LoadedPhoto> {
    const response = await photoRequest(`/api/photos/${id}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
    if (response.headers.get('Content-Type') !== 'image/webp') {
      throw new Error('Image invalide.');
    }

    if (!signal.aborted) {
      renewPrivacyLease();
    }

    const blob = await response.blob();
    if (blob.size > 2 * 1024 * 1024) {
      throw new Error('Image trop volumineuse.');
    }

    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.alt = 'Photo de la collection familiale';
    image.src = url;
    try {
      await image.decode();
      if (signal.aborted) {
        throw new Error('Interrompu.');
      }
    } catch (error) {
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
      throw error;
    }

    return {id, url, image};
  }

  // eslint-disable-next-line unicorn/consistent-boolean-name -- The refresh is the action; its result indicates whether a usable catalog remains.
  async function refreshCatalog(run: number, signal: AbortSignal) {
    const result = await fetchCatalog(
      false,
      AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    );
    if (run !== generation) {
      return false;
    }

    renewPrivacyLease();
    catalog = result.display;
    queue = queue.filter((id) => catalog.some((photo) => photo.id === id));
    if (next && catalog.every((photo) => photo.id !== next?.id)) {
      release(next);
      next = undefined;
    }

    refreshAt = Date.now() + 300_000;
    if (catalog.length === 0) {
      clear();
      status.textContent =
        'Ajoutez vos premiers souvenirs depuis l’espace privé.';
      return false;
    }

    if (current && catalog.every((photo) => photo.id !== current?.id)) {
      release(current);
      current = undefined;
      stage.replaceChildren();
    }

    return true;
  }

  async function tick() {
    const run = generation;
    const {signal} = controller;
    try {
      if (Date.now() >= refreshAt && !(await refreshCatalog(run, signal))) {
        return;
      }

      if (next) {
        const old = current;
        current = next;
        next = undefined;
        stage.replaceChildren(current.image);
        release(old);
      }

      if (!current) {
        if (queue.length === 0) {
          queue = shufflePhotos(catalog.map(({id}) => id));
        }

        const id = queue.shift();
        if (id !== undefined) {
          const loaded = await load(id, signal);
          if (run !== generation) {
            release(loaded);
            return;
          }

          current = loaded;
          stage.replaceChildren(current.image);
        }
      }

      empty.hidden = Boolean(current);
      status.textContent = '';
      // Only one upcoming image is held. Each new cycle excludes the current first.
      if (queue.length === 0) {
        queue = shufflePhotos(
          catalog.map(({id}) => id),
          current?.id,
        );
      }

      const candidate = queue.shift();
      if (candidate !== undefined && candidate !== current?.id) {
        const loaded = await load(candidate, signal);
        if (run !== generation) {
          release(loaded);
          return;
        }

        next = loaded;
      }
    } catch (error) {
      if (run !== generation) {
        return;
      }

      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        clear();
        status.textContent = 'Accès privé requis. Reconnectez cet affichage.';
      } else {
        status.textContent = current
          ? 'Connexion interrompue · photo conservée'
          : 'Photos indisponibles. Nouvelle tentative automatique.';
      }

      refreshAt = Date.now() + 60_000;
    } finally {
      if (isActive && run === generation) {
        timer = setTimeout(
          () => {
            void tick();
          },
          current ? settings.slideshowIntervalSeconds * 1000 : 60_000,
        );
      }
    }
  }

  function setActive(isActiveValue: boolean) {
    if (isActive === isActiveValue) {
      return;
    }

    isActive = isActiveValue;
    generation++;
    clearTimeout(timer);
    controller.abort();
    controller = new AbortController();
    // Exiting a mode releases all decoded private images; offline continuity is in-mode only.
    if (isActive) {
      void tick();
    } else {
      clearTimeout(privacyTimer);
      clear();
      refreshAt = 0;
    }
  }

  root.querySelector('[data-photo-next]')?.addEventListener('click', () => {
    if (!isActive) {
      return;
    }

    generation++;
    clearTimeout(timer);
    controller.abort();
    controller = new AbortController();
    void tick();
  });
  function wake() {
    if (!isActive) {
      return;
    }

    generation++;
    controller.abort();
    controller = new AbortController();
    clearTimeout(timer);
    refreshAt = 0;
    void tick();
  }

  return {
    setActive,
    wake,
    checkPrivacy() {
      if (
        current &&
        (Date.now() >= leaseWall || performance.now() >= leaseMonotonic)
      ) {
        expirePrivacy();
      }
    },
    configure(value: Settings) {
      settings = value;
      stage.dataset.fit = settings.fit;
      fit.value = settings.fit;
    },
    deny() {
      generation++;
      controller.abort();
      controller = new AbortController();
      clearTimeout(timer);
      clearTimeout(privacyTimer);
      clear();
      refreshAt = 0;
      status.textContent = 'Accès privé requis. Reconnectez cet affichage.';
      if (isActive) {
        timer = setTimeout(wake, 60_000);
      }
    },
  };
}
