// IndexedDB DOM declarations return any; every read below supplies the record type.
/* eslint-disable @typescript-eslint/no-unsafe-argument -- IndexedDB DOM declarations use any; reads supply explicit record types. */
import {hasPhotoSize, shaPattern} from './contracts.ts';
import type {DisplayPhoto} from './client.ts';

export const offlineLeaseMs = 7 * 86_400_000;
export const offlinePhotoLimit = 100;
export const offlineByteLimit = 100_000_000;
const controlKey = 'dayframe.offline-photos.v1';
const databaseName = 'dayframe.offline-photos.v1';
const listeners = new Set<() => void>();
type Control = {token: string; enabled: boolean};
type Playback = {fit: 'contain' | 'cover'; interval: number};
type Lease = Playback & {verifiedAt: number; checkedAt: number; token: string};
let lastWall = 0;
let lastMonotonic = 0;
let isDenied = false;
let invalidationRevision = 0;
let retentionTimer: ReturnType<typeof setTimeout> | undefined;

let channel: BroadcastChannel | undefined;

export function offlineControl(): Control | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(controlKey) ?? 'null') as
      | {
          token?: unknown;
          enabled?: unknown;
        }
      | undefined;
    if (
      isDenied ||
      typeof value?.token !== 'string' ||
      value.enabled !== true
    ) {
      return undefined;
    }

    return {token: value.token, enabled: true};
  } catch {
    return undefined;
  }
}

async function openStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    let isBlocked = false;
    request.onupgradeneeded = () => {
      for (const name of ['photos', 'blobs', 'state']) {
        request.result.createObjectStore(name);
      }
    };

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Stockage indisponible.'));
    });

    request.onblocked = () => {
      isBlocked = true;
      reject(new Error('Stockage occupé.'));
    };

    request.onsuccess = () => {
      if (
        isBlocked ||
        ['photos', 'blobs', 'state'].some(
          (name) => !request.result.objectStoreNames.contains(name),
        )
      ) {
        request.result.close();
        reject(new Error('Stockage local invalide.'));
        return;
      }

      request.result.onversionchange = () => {
        request.result.close();
      };

      resolve(request.result);
    };
  });
}

async function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.addEventListener('error', () => {
      reject(request.error ?? new Error('Stockage indisponible.'));
    });
  });
}

async function transaction<T>(
  action: (tx: IDBTransaction) => Promise<T>,
): Promise<T> {
  const database = await openStore();
  const tx = database.transaction(['photos', 'blobs', 'state'], 'readwrite');
  const completed = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };

    tx.addEventListener('abort', () => {
      reject(tx.error ?? new Error('Écriture interrompue.'));
    });
  });
  try {
    const result = await action(tx);
    await completed;
    return result;
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /*
      Already completed/aborted.
      */
    }

    await completed.catch(() => undefined);
    throw error;
  } finally {
    database.close();
  }
}

export async function clearOfflinePhotos() {
  await transaction(async (tx) => {
    for (const name of ['photos', 'blobs', 'state']) {
      tx.objectStore(name).clear();
    }
  });
}

// The synchronous tombstone fences pending writes before asynchronous deletion.
// If deletion fails, every subsequent access retries it and remains denied.
export function invalidateOfflinePhotos() {
  invalidationRevision++;
  channel?.postMessage('deny');
  clearTimeout(retentionTimer);
  isDenied = true;
  try {
    localStorage.setItem(
      controlKey,
      JSON.stringify({token: crypto.randomUUID(), enabled: false}),
    );
  } catch {
    /*
    This page still fails closed if storage becomes unavailable.
    */
  }

  for (const listener of listeners) {
    listener();
  }

  void clearOfflinePhotos().catch(() => {
    setTimeout(() => {
      if (!offlineControl()) {
        invalidateOfflinePhotos();
      }
    }, 60_000);
  });
}

export function onOfflineInvalidation(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof globalThis.addEventListener === 'function') {
  channel =
    typeof BroadcastChannel === 'function'
      ? new BroadcastChannel(controlKey)
      : undefined;
  channel?.addEventListener('message', () => {
    invalidationRevision++;
    isDenied = true;
    for (const listener of listeners) {
      listener();
    }

    void clearOfflinePhotos().catch(() => undefined);
  });

  globalThis.addEventListener('storage', (event) => {
    if (!(event.key === controlKey || event.key === null)) {
      return;
    }

    isDenied = false;
    // Another tab starting an authorized collection is not an access denial.
    if (offlineControl()) {
      return;
    }

    invalidationRevision++;
    for (const listener of listeners) {
      listener();
    }

    if (!offlineControl()) {
      void clearOfflinePhotos().catch(() => undefined);
    }
  });
}

// A revision fences authorization started before logout, denial or reprovisioning.
export function offlineRevision() {
  try {
    const value = JSON.parse(localStorage.getItem(controlKey) ?? 'null') as
      | {
          token?: unknown;
        }
      | undefined;
    const token = typeof value?.token === 'string' ? value.token : 'initial';
    return `${invalidationRevision}:${token}`;
  } catch {
    return `${invalidationRevision}:unavailable`;
  }
}

// Call only after a complete authenticated catalog succeeds.
export async function enableOfflinePhotos(
  expectedRevision = offlineRevision(),
) {
  if (expectedRevision !== offlineRevision()) {
    return undefined;
  }

  const existing = offlineControl();
  if (existing) {
    return existing.token;
  }

  // A denied or missing control starts a fresh collection after authorization.
  await clearOfflinePhotos();
  if (expectedRevision !== offlineRevision()) {
    return undefined;
  }

  const control: Control = {
    token: expectedRevision.slice(expectedRevision.indexOf(':') + 1),
    enabled: true,
  };
  localStorage.setItem(controlKey, JSON.stringify(control));
  isDenied = false;
  lastWall = 0;
  lastMonotonic = 0;
  return control.token;
}

export function isOfflineLeaseValid(
  lease: {verifiedAt: number; checkedAt: number},
  now: number,
) {
  return (
    Number.isFinite(now) &&
    Number.isFinite(lease.verifiedAt) &&
    Number.isFinite(lease.checkedAt) &&
    lease.verifiedAt > 0 &&
    lease.checkedAt >= lease.verifiedAt &&
    now >= lease.checkedAt &&
    now - lease.verifiedAt < offlineLeaseMs
  );
}

function hasMatchingToken(token: string) {
  return offlineControl()?.token === token;
}

function scheduleExpiration(verifiedAt: number, token: string) {
  if (!hasMatchingToken(token)) {
    return;
  }

  clearTimeout(retentionTimer);
  retentionTimer = setTimeout(
    () => {
      if (hasMatchingToken(token)) {
        invalidateOfflinePhotos();
      }
    },
    Math.max(0, verifiedAt + offlineLeaseMs - Date.now()),
  );
}

export async function renewOfflineLease(
  token: string,
  playback: Playback,
  verifiedAt = Date.now(),
) {
  await transaction(async (tx) => {
    if (!hasMatchingToken(token)) {
      return;
    }

    const now = verifiedAt;
    tx.objectStore('state').put(
      {...playback, token, verifiedAt: now, checkedAt: now},
      'lease',
    );
    lastWall = now;
    lastMonotonic = performance.now();
  });
  scheduleExpiration(verifiedAt, token);
}

async function validLease(tx: IDBTransaction, token: string) {
  const lease = await read<Lease | undefined>(
    tx.objectStore('state').get('lease'),
  );
  if (!hasMatchingToken(token)) {
    return undefined;
  }

  if (lease === undefined) {
    tx.objectStore('photos').clear();
    tx.objectStore('blobs').clear();
    return undefined;
  }

  const now = Date.now();
  const monotonic = performance.now();
  const hasBackwardClock =
    lastWall > 0 &&
    (now < lastWall || now - lastWall < monotonic - lastMonotonic - 5000);
  if (
    hasBackwardClock ||
    lease?.token !== token ||
    !isOfflineLeaseValid(lease, now)
  ) {
    invalidateOfflinePhotos();
    return undefined;
  }

  scheduleExpiration(lease.verifiedAt, token);
  lastWall = now;
  lastMonotonic = monotonic;
  tx.objectStore('state').put({...lease, checkedAt: now}, 'lease');
  return lease;
}

export async function savedPhotos() {
  const control = offlineControl();
  if (!control) {
    await clearOfflinePhotos();
    return [];
  }

  return transaction(async (tx) => {
    if (!(await validLease(tx, control.token))) {
      return [];
    }

    const values = await read<unknown[]>(tx.objectStore('photos').getAll());
    return values.filter((value): value is DisplayPhoto => {
      if (typeof value !== 'object' || value === null) {
        return false;
      }

      const photo = value as DisplayPhoto;
      return (
        typeof photo.id === 'string' &&
        shaPattern.test(photo.id) &&
        hasPhotoSize(photo) &&
        photo.contentType === 'image/webp'
      );
    });
  });
}

export async function savedPhoto(id: string) {
  const control = offlineControl();
  if (!control) {
    return undefined;
  }

  return transaction(async (tx) => {
    if (!(await validLease(tx, control.token))) {
      return undefined;
    }

    const bytes = await read<ArrayBuffer | undefined>(
      tx.objectStore('blobs').get(id),
    );
    return hasMatchingToken(control.token) &&
      bytes instanceof ArrayBuffer &&
      bytes.byteLength <= 2 * 1024 * 1024
      ? new Blob([bytes], {type: 'image/webp'})
      : undefined;
  });
}

export async function forgetSavedPhoto(id: string) {
  await transaction(async (tx) => {
    tx.objectStore('photos').delete(id);
    tx.objectStore('blobs').delete(id);
  });
}

export async function reconcileSavedPhotos(
  photos: DisplayPhoto[],
  token: string,
) {
  const ids = new Set(photos.map(({id}) => id));
  await transaction(async (tx) => {
    const keys = await read(tx.objectStore('photos').getAllKeys());
    if (!hasMatchingToken(token)) {
      return;
    }

    for (const id of keys) {
      if (ids.has(id as string)) {
        continue;
      }

      tx.objectStore('photos').delete(id);
      tx.objectStore('blobs').delete(id);
    }
  });
}

export async function savePhoto(
  photo: DisplayPhoto,
  blob: Blob,
  token: string,
) {
  if (
    blob.type !== 'image/webp' ||
    blob.size !== photo.size ||
    !hasPhotoSize(photo) ||
    !shaPattern.test(photo.id)
  ) {
    return;
  }

  // Store encoded bytes: WebKit can reject Blob preparation in IndexedDB.
  // Convert outside the transaction so it never auto-commits across a blob read.
  const bytes = await blob.arrayBuffer();
  await transaction(async (tx) => {
    if (!(await validLease(tx, token))) {
      return;
    }

    const entries = await read<DisplayPhoto[]>(
      tx.objectStore('photos').getAll(),
    );
    if (!hasMatchingToken(token)) {
      return;
    }

    const others = entries.filter(({id}) => id !== photo.id);
    let size = others.reduce((sum, entry) => sum + entry.size, 0) + blob.size;
    while (others.length >= offlinePhotoLimit || size > offlineByteLimit) {
      const oldest = others.shift();
      if (!oldest) {
        return;
      }

      size -= oldest.size;
      tx.objectStore('photos').delete(oldest.id);
      tx.objectStore('blobs').delete(oldest.id);
    }

    // Explicit projection: no uploader, fingerprint or household settings persisted.
    const {id, width, height} = photo;
    tx.objectStore('photos').put(
      {id, width, height, size: blob.size, contentType: 'image/webp'},
      id,
    );
    tx.objectStore('blobs').put(bytes, id);
  });
}

export async function savedLease() {
  const control = offlineControl();
  return control
    ? transaction(async (tx) => validLease(tx, control.token))
    : undefined;
}

export async function updateOfflinePlayback(playback: Playback) {
  const control = offlineControl();
  if (!control) {
    return;
  }

  await transaction(async (tx) => {
    const lease = await validLease(tx, control.token);
    if (lease && hasMatchingToken(control.token)) {
      tx.objectStore('state').put({...lease, ...playback}, 'lease');
    }
  });
}

export async function offlinePersistence(shouldRequest = false) {
  try {
    const isPersistent = shouldRequest
      ? await navigator.storage?.persist?.()
      : await navigator.storage?.persisted?.();
    return {isPersistent};
  } catch {
    return {isPersistent: false};
  }
}
