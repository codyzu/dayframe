import {
  savedPhotos,
  savedPhoto,
  savedLease,
  forgetSavedPhoto,
  onOfflineInvalidation,
} from '../photos/offline.ts';

const stage = document.querySelector<HTMLElement>('[data-stage]')!;
const status = document.querySelector<HTMLElement>('[data-status]')!;
const retry = document.querySelector<HTMLButtonElement>('button')!;
const root = document.body;

// Fixed readiness labels for the isolated native probe; never photo/lease data.
// A document background alone must not satisfy the native load watchdog.
function showRetry(message: string) {
  status.textContent = message;
  root.dataset.offlineState = 'retry';
}

let generation = 0;
let currentUrl: string | undefined;
let loading: {image: HTMLImageElement; url: string} | undefined;
let pendingRun: number | undefined;
let slideTimer: ReturnType<typeof setTimeout> | undefined;
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
let isPending = false;
let delay = 15_000;
let previousId = '';
let isStopped = false;

function isCurrent(turn: number) {
  return turn === generation && !isStopped && !document.hidden;
}

function releaseCurrent() {
  stage.querySelector('img')?.removeAttribute('src');
  stage.replaceChildren();
  if (currentUrl !== undefined) {
    URL.revokeObjectURL(currentUrl);
  }

  currentUrl = undefined;
}

function discard(candidate: {image: HTMLImageElement; url: string}) {
  candidate.image.removeAttribute('src');
  URL.revokeObjectURL(candidate.url);
  if (loading === candidate) {
    loading = undefined;
  }
}

function release() {
  generation++;
  root.dataset.offlineState = 'loading';
  clearTimeout(slideTimer);
  releaseCurrent();
  if (loading) {
    discard(loading);
  }
}

onOfflineInvalidation(() => {
  release();
  showRetry('Accès aux photos expiré. Reconnectez-vous à Dayframe.');
});

function playbackInterval(value: number) {
  return Number.isFinite(value) ? Math.min(3600, Math.max(5, value)) : 20;
}

async function play() {
  if (pendingRun === generation || !isCurrent(generation)) {
    return;
  }

  const turn = generation;
  pendingRun = turn;
  try {
    const lease = await savedLease();
    const photos = await savedPhotos();
    if (!isCurrent(turn)) {
      return;
    }

    if (!lease || photos.length === 0) {
      release();
      showRetry('Aucune photo hors connexion. Reconnectez-vous à Dayframe.');
      return;
    }

    const candidates = photos.filter(({id}) => id !== previousId);
    const pool = candidates.length > 0 ? candidates : photos;
    const photo = pool[Math.floor(Math.random() * pool.length)];
    const blob = await savedPhoto(photo.id);
    if (!isCurrent(turn)) {
      return;
    }

    if (!blob) {
      await forgetSavedPhoto(photo.id);
      if (isCurrent(turn)) {
        slideTimer = setTimeout(() => {
          void play();
        }, 1000);
      }

      return;
    }

    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.alt = 'Photo de la collection hors connexion';
    image.src = url;
    const candidate = {image, url};
    loading = candidate;
    try {
      let decodeTimer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          image.decode(),
          new Promise<never>((_resolve, reject) => {
            decodeTimer = setTimeout(() => {
              reject(new Error('Image illisible'));
            }, 3000);
          }),
        ]);
      } finally {
        clearTimeout(decodeTimer);
      }

      const latestLease = await savedLease();
      if (!latestLease || !isCurrent(turn)) {
        discard(candidate);
        return;
      }

      // The generation check follows the final asynchronous read; only this
      // run can own a candidate now.
      loading = undefined;

      image.dataset.fit = lease.fit === 'cover' ? 'cover' : 'contain';
      releaseCurrent();
      stage.replaceChildren(image);

      currentUrl = url;
      previousId = photo.id;
      status.textContent = 'Hors connexion · photos enregistrées';
      root.dataset.offlineState = 'playback';
    } catch {
      discard(candidate);

      if (!isCurrent(turn)) {
        return;
      }

      await forgetSavedPhoto(photo.id);
      if (isCurrent(turn)) {
        slideTimer = setTimeout(() => {
          void play();
        }, 1000);
      }

      return;
    }

    if (isCurrent(turn)) {
      const interval = playbackInterval(lease.interval);
      slideTimer = setTimeout(() => {
        void play();
      }, interval * 1000);
    }
  } catch {
    if (!isCurrent(turn)) {
      return;
    }

    release();
    showRetry('Stockage des photos indisponible. Réessayez la connexion.');
  } finally {
    if (pendingRun === turn) {
      pendingRun = undefined;
    }
  }
}

async function reconnect(isManual = false) {
  if (isPending || isStopped) {
    return;
  }

  isPending = true;
  clearTimeout(recoveryTimer);
  retry.disabled = true;
  try {
    const response = await fetch('/api/health', {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    const body = (await response.json()) as {ok?: unknown; service?: unknown};
    if (!response.ok || body.ok !== true || body.service !== 'dayframe') {
      throw new Error('Unreachable');
    }

    // A healthy API alone does not prove the dashboard/assets work. The startup
    // guard retains this deadline if a partial load sends us back here.
    if (isStopped) {
      return;
    }

    try {
      const key = 'dayframe.offline-return';
      const until = Number(sessionStorage.getItem(key));
      if (!Number.isFinite(until) || Date.now() >= until) {
        const delayKey = 'dayframe.offline-return-delay';
        const savedDelay = Number(sessionStorage.getItem(delayKey));
        const returnDelay = Number.isFinite(savedDelay)
          ? Math.min(300_000, Math.max(60_000, savedDelay))
          : 60_000;
        sessionStorage.setItem(key, String(Date.now() + returnDelay));
        sessionStorage.setItem(
          delayKey,
          String(Math.min(returnDelay * 2, 300_000)),
        );
        location.reload();
      }
    } catch {
      // Without a durable loop fence, only an explicit retry may navigate.
      if (isManual) {
        location.reload();
      } else {
        status.textContent =
          'Connexion disponible. Réessayez pour ouvrir Dayframe.';
      }
    }
  } catch {
    // A transport, TLS, portal or server failure never renews photo access.
  } finally {
    isPending = false;
    retry.disabled = false;
    recoveryTimer = setTimeout(() => {
      void reconnect();
    }, delay);
    delay = Math.min(delay * 2, 300_000);
  }
}

retry.addEventListener('click', () => {
  void reconnect(true);
});
globalThis.addEventListener('online', () => {
  void reconnect();
});
globalThis.addEventListener('pagehide', () => {
  isStopped = true;
  release();
  clearTimeout(recoveryTimer);
});
globalThis.addEventListener('pageshow', () => {
  if (!isStopped) {
    return;
  }

  isStopped = false;
  void play();
  void reconnect();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    release();
  } else {
    void play();
  }
});
void play();
recoveryTimer = setTimeout(() => {
  void reconnect();
}, delay);
