import {defaultSettings, type Settings} from '../dashboard/settings.ts';
import {
  offlinePersistence,
  updateOfflinePlayback,
  enableOfflinePhotos,
  offlineRevision,
  invalidateOfflinePhotos,
  offlineControl,
  onOfflineInvalidation,
  savedPhotos,
  savedPhoto,
  savedLease,
  renewOfflineLease,
  reconcileSavedPhotos,
  savePhoto,
  forgetSavedPhoto,
  offlineLeaseMs,
  offlinePhotoLimit,
  offlineByteLimit,
} from './offline.ts';
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
  controlsRoot: HTMLElement,
  settings: Settings = defaultSettings,
) {
  const stage = root.querySelector<HTMLElement>('[data-photo-stage]')!;
  const status = controlsRoot.querySelector<HTMLElement>(
    '[data-photo-status]',
  )!;
  const controls = controlsRoot.querySelector<HTMLElement>(
    '[data-photo-controls]',
  )!;
  const empty = root.querySelector<HTMLElement>('[data-photo-empty]')!;
  const fit =
    controlsRoot.querySelector<HTMLButtonElement>('[data-photo-fit]')!;
  const fitKey = 'dayframe.photo-fit.v1';
  let preferredFit: Settings['fit'] | undefined;
  try {
    const saved = localStorage.getItem(fitKey);
    if (saved === 'contain' || saved === 'cover') {
      preferredFit = saved;
    }
  } catch {
    // Storage may be disabled; keep explicit choices for this page instead.
  }

  function applyFit() {
    stage.dataset.fit = preferredFit ?? settings.fit;
    const isCover = stage.dataset.fit === 'cover';
    fit.setAttribute('aria-pressed', String(isCover));
    fit.title = isCover ? 'Afficher la photo entière' : 'Remplir l’écran';
  }

  const offlineStatus = controlsRoot.querySelector<HTMLElement>(
    '[data-photo-offline-status]',
  )!;
  let isStoredPlayback = false;
  let savedSubset = new Set<string>();
  // Routine persistence/sync details belong in administration. This region only
  // announces storage failures that affect offline availability.
  function reportStorageFailure(message: string) {
    offlineStatus.textContent = message;
    offlineStatus.hidden = false;
  }

  let lastPrivacyWall = Date.now();
  let storageCheckAt = 0;
  let catalog: DisplayPhoto[] = [];
  let queue: string[] = [];
  let current: LoadedPhoto | undefined;
  let next: LoadedPhoto | undefined;
  let isActive = false;
  let hasFailed = false;
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
    controls.hidden = true;
  };

  function expirePrivacy() {
    if (offlineControl()) {
      invalidateOfflinePhotos();
    }

    hasFailed = true;
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

  function armPrivacyLease(verifiedAt: number, duration: number) {
    const remaining = Math.max(0, verifiedAt + duration - Date.now());
    leaseWall = verifiedAt + duration;
    leaseMonotonic = performance.now() + remaining;
    lastPrivacyWall = Date.now();
    clearTimeout(privacyTimer);
    privacyTimer = setTimeout(expirePrivacy, remaining);
  }

  async function renewPrivacyLease(token?: string) {
    armPrivacyLease(Date.now(), token === undefined ? 300_000 : offlineLeaseMs);
    if (token !== undefined) {
      await renewOfflineLease(token, {
        fit: preferredFit ?? settings.fit,
        interval: settings.slideshowIntervalSeconds,
      }).catch(() => {
        reportStorageFailure(
          'Copies locales indisponibles · lecture en ligne.',
        );
      });
    }
  }

  function deny() {
    hasFailed = true;
    generation++;
    controller.abort();
    controller = new AbortController();
    clearTimeout(timer);
    clearTimeout(privacyTimer);
    clear();
    isStoredPlayback = false;
    refreshAt = 0;
    offlineStatus.hidden = true;
    offlineStatus.textContent = '';
    status.textContent = 'Accès privé requis. Reconnectez cet affichage.';
    if (isActive) {
      timer = setTimeout(wake, 60_000);
    }
  }

  onOfflineInvalidation(deny);
  fit.addEventListener('click', () => {
    preferredFit = stage.dataset.fit === 'cover' ? 'contain' : 'cover';
    applyFit();
    if (offlineControl()) {
      void updateOfflinePlayback({
        fit: preferredFit,
        interval: settings.slideshowIntervalSeconds,
      }).catch(() => undefined);
    }

    try {
      localStorage.setItem(fitKey, preferredFit);
    } catch {
      // The selection still survives settings refreshes without storage.
    }
  });
  applyFit();

  async function download(id: string, signal: AbortSignal, token?: string) {
    if (isStoredPlayback) {
      throw new Error('Copie locale indisponible.');
    }

    const response = await photoRequest(`/api/photos/${id}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
    if (response.headers.get('Content-Type') !== 'image/webp') {
      throw new Error('Image invalide.');
    }

    const blob = await response.blob();
    if (signal.aborted) {
      throw new Error('Interrompu.');
    }

    if (blob.size > 2 * 1024 * 1024) {
      throw new Error('Image trop volumineuse.');
    }

    await renewPrivacyLease(token);
    const photo = catalog.find((photo) => photo.id === id);
    if (token !== undefined && photo && savedSubset.has(id)) {
      try {
        await savePhoto(photo, blob, token);
      } catch {
        reportStorageFailure('Copies locales incomplètes · lecture en ligne.');
      }
    }

    return blob;
  }

  async function load(id: string, signal: AbortSignal): Promise<LoadedPhoto> {
    const token = offlineControl()?.token;
    let blob: Blob | undefined;
    if (token !== undefined) {
      try {
        blob = await savedPhoto(id);
      } catch {
        /*
        Network playback still works.
        */
      }
    }

    blob ??= await download(id, signal, token);
    if (
      signal.aborted ||
      (token !== undefined && offlineControl()?.token !== token)
    ) {
      throw new Error('Interrompu.');
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
      if (token !== undefined && !signal.aborted) {
        await forgetSavedPhoto(id).catch(() => undefined);
        queue = queue.filter((candidate) => candidate !== id);
        catalog = catalog.filter((photo) => photo.id !== id);
      }

      throw error;
    }

    return {id, url, image};
  }

  async function prepareOfflineCatalog(revision: string) {
    try {
      const wasEnabled = Boolean(offlineControl());
      const token = await enableOfflinePhotos(revision);
      if (token !== undefined) {
        void offlinePersistence(!wasEnabled);
      }

      return token;
    } catch {
      reportStorageFailure('Copies locales indisponibles · lecture en ligne.');
      return undefined;
    }
  }

  // eslint-disable-next-line unicorn/consistent-boolean-name -- The refresh is the action; its result indicates whether a usable catalog remains.
  async function refreshCatalog(run: number, signal: AbortSignal) {
    const revision = offlineRevision();
    const result = await fetchCatalog(
      false,
      AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    );
    if (run !== generation) {
      return false;
    }

    offlineStatus.hidden = true;
    offlineStatus.textContent = '';
    const token = await prepareOfflineCatalog(revision);
    if (run !== generation) {
      return false;
    }

    await renewPrivacyLease(token);
    if (run !== generation) {
      return false;
    }

    isStoredPlayback = false;
    catalog = result.display;
    if (token !== undefined) {
      try {
        await reconcileSavedPhotos(catalog, token);
        const existing = await savedPhotos();
        const candidates = [
          ...existing.map(({id}) => id),
          ...shufflePhotos(catalog.map(({id}) => id)),
        ];
        savedSubset = new Set();
        let bytes = 0;
        for (const id of candidates) {
          const photo = catalog.find((photo) => photo.id === id);
          if (!(
            photo &&
            !savedSubset.has(id) &&
            savedSubset.size < offlinePhotoLimit &&
            bytes + photo.size <= offlineByteLimit
          )) {
            continue;
          }

          savedSubset.add(id);
          bytes += photo.size;
        }
      } catch {
        reportStorageFailure(
          'Copies locales indisponibles · lecture en ligne.',
        );
      }
    }

    if (run !== generation) {
      return false;
    }

    queue = queue.filter((id) => catalog.some((photo) => photo.id === id));
    if (next && catalog.every((photo) => photo.id !== next?.id)) {
      release(next);
      next = undefined;
    }

    refreshAt = Date.now() + 300_000;
    if (catalog.length === 0) {
      hasFailed = false;
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

  // eslint-disable-next-line unicorn/consistent-boolean-name -- Resolves the catalog and reports whether this run can continue.
  async function ensureCatalog(run: number, signal: AbortSignal) {
    if (Date.now() < refreshAt) {
      return true;
    }

    try {
      return await refreshCatalog(run, signal);
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof ApiError && [401, 403].includes(error.status))
      ) {
        throw error;
      }

      const stored = offlineControl()
        ? await savedPhotos().catch(() => [])
        : [];
      const lease =
        stored.length > 0
          ? await savedLease().catch(() => undefined)
          : undefined;
      if (run !== generation) {
        return false;
      }

      if (!lease) {
        throw error;
      }

      armPrivacyLease(lease.verifiedAt, offlineLeaseMs);
      isStoredPlayback = true;
      offlineStatus.hidden = true;
      offlineStatus.textContent = '';
      catalog = stored;
      queue = queue.filter((id) => stored.some((photo) => photo.id === id));
      refreshAt = Date.now() + 60_000;
      return true;
    }
  }

  function takeNext() {
    if (queue.length === 0) {
      queue = shufflePhotos(
        catalog.map(({id}) => id),
        current?.id,
      );
    }

    return queue.shift();
  }

  async function tick() {
    const run = generation;
    const {signal} = controller;
    try {
      if (!(await ensureCatalog(run, signal))) {
        return;
      }

      if (next) {
        const old = current;
        current = next;
        next = undefined;
        stage.replaceChildren(current.image);
        globalThis.dispatchEvent(new Event('dayframe:slide'));
        release(old);
      }

      if (!current) {
        const id = takeNext();
        if (id !== undefined) {
          const loaded = await load(id, signal);
          if (run !== generation) {
            release(loaded);
            return;
          }

          current = loaded;
          stage.replaceChildren(current.image);
          globalThis.dispatchEvent(new Event('dayframe:slide'));
        }
      }

      empty.hidden = Boolean(current);
      controls.hidden = !current;
      status.textContent = isStoredPlayback
        ? 'Hors connexion · photos enregistrées'
        : '';
      // Only one upcoming image is held.
      const candidate = takeNext();
      if (candidate !== undefined && candidate !== current?.id) {
        const loaded = await load(candidate, signal);
        if (run !== generation) {
          release(loaded);
          return;
        }

        next = loaded;
      }

      hasFailed = isStoredPlayback;
    } catch (error) {
      if (run !== generation) {
        return;
      }

      hasFailed = true;
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
    // Exiting a mode releases decoded images; opted-in disk copies remain lease-bound.
    if (isActive) {
      void tick();
    } else {
      clearTimeout(privacyTimer);
      clear();
      refreshAt = 0;
    }
  }

  controlsRoot
    .querySelector('[data-photo-next]')
    ?.addEventListener('click', () => {
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
    get hasFailed() {
      return hasFailed;
    },
    checkPrivacy() {
      if (Date.now() < lastPrivacyWall) {
        storageCheckAt = 0;
      }

      if (offlineControl() && Date.now() >= storageCheckAt) {
        storageCheckAt = Date.now() + 60_000;
        void savedLease().catch(() => undefined);
      }

      if (
        current &&
        (Date.now() >= leaseWall ||
          performance.now() >= leaseMonotonic ||
          Date.now() < lastPrivacyWall)
      ) {
        expirePrivacy();
      }

      lastPrivacyWall = Date.now();
    },
    configure(value: Settings) {
      settings = value;
      applyFit();
      if (offlineControl()) {
        void updateOfflinePlayback({
          fit: preferredFit ?? settings.fit,
          interval: settings.slideshowIntervalSeconds,
        }).catch(() => undefined);
      }
    },
    deny,
  };
}
