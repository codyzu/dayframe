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
let generation = 0;
let currentUrl: string | undefined;
let slideTimer: ReturnType<typeof setTimeout> | undefined;
let recoveryTimer: ReturnType<typeof setTimeout> | undefined;
let isPending = false;
let delay = 15_000;
let previousId = '';
let isStopped = false;

function release() {
  generation++;
  clearTimeout(slideTimer);
  stage.replaceChildren();
  if (currentUrl !== undefined) {
    URL.revokeObjectURL(currentUrl);
  }

  currentUrl = undefined;
}

onOfflineInvalidation(() => {
  release();
  status.textContent = 'Accès aux photos expiré. Reconnectez-vous à Dayframe.';
});

async function play() {
  const turn = generation;
  try {
    const lease = await savedLease();
    const photos = await savedPhotos();
    if (turn !== generation || isStopped) {
      return;
    }

    if (!lease || photos.length === 0) {
      release();
      status.textContent =
        'Aucune photo hors connexion. Reconnectez-vous à Dayframe.';
      return;
    }

    const candidates = photos.filter(({id}) => id !== previousId);
    const photo = (candidates.length > 0 ? candidates : photos)[
      Math.floor(
        Math.random() *
          (candidates.length > 0 ? candidates.length : photos.length),
      )
    ];
    const blob = await savedPhoto(photo.id);
    if (turn !== generation || isStopped) {
      return;
    }

    if (!blob) {
      await forgetSavedPhoto(photo.id);
      slideTimer = setTimeout(() => {
        void play();
      }, 1000);
      return;
    }

    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.alt = 'Photo de la collection hors connexion';
    image.src = url;
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

      if (turn !== generation || isStopped || !(await savedLease())) {
        URL.revokeObjectURL(url);
        return;
      }

      image.dataset.fit = lease.fit === 'cover' ? 'cover' : 'contain';
      stage.replaceChildren(image);
      if (currentUrl !== undefined) {
        URL.revokeObjectURL(currentUrl);
      }

      currentUrl = url;
      previousId = photo.id;
      status.textContent = 'Hors connexion · Photos enregistrées';
    } catch {
      URL.revokeObjectURL(url);
      await forgetSavedPhoto(photo.id);
      if (turn === generation && !isStopped) {
        slideTimer = setTimeout(() => {
          void play();
        }, 1000);
      }

      return;
    }

    if (turn === generation && !isStopped) {
      const interval = Number.isFinite(lease.interval)
        ? Math.min(300, Math.max(5, lease.interval))
        : 20;
      slideTimer = setTimeout(() => {
        void play();
      }, interval * 1000);
    }
  } catch {
    release();
    status.textContent =
      'Stockage des photos indisponible. Réessayez la connexion.';
  }
}

async function reconnect() {
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
    const key = 'dayframe.offline-return';
    const until = Number(sessionStorage.getItem(key));
    if (!Number.isFinite(until) || Date.now() >= until) {
      sessionStorage.setItem(key, String(Date.now() + 60_000));
      location.reload();
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
  void reconnect();
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
