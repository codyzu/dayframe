/* eslint-disable no-await-in-loop -- Delete a bounded set of fallback cache versions sequentially. */
import {isDashboardUrl} from './navigation-policy.ts';

declare const __FALLBACK_VERSION__: string;
declare const __IS_OFFLINE_RETIRED__: boolean;
const scope = globalThis as unknown as ServiceWorkerGlobalScope;
const prefix = 'dayframe.fallback.';
const cacheName = prefix + __FALLBACK_VERSION__;
let isRetired = __IS_OFFLINE_RETIRED__;

async function clearCaches(except?: string) {
  for (const name of await caches.keys()) {
    if (name !== except && name.startsWith(prefix)) {
      await caches.delete(name);
    }
  }
}

scope.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      if (!isRetired) {
        const response = await fetch('/offline.html', {
          cache: 'no-store',
          redirect: 'error',
        });
        if (
          !response.ok ||
          !response.headers.get('content-type')?.includes('text/html')
        ) {
          throw new Error('Invalid fallback');
        }

        const html = await response.clone().text();
        if (
          !html.includes('data-offline') ||
          !html.includes('Content-Security-Policy')
        ) {
          throw new Error('Incomplete fallback');
        }

        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(html),
        );
        const actual = [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('');
        if (actual !== __FALLBACK_VERSION__) {
          throw new Error('Mismatched fallback deployment');
        }

        // Never overwrite the active version; activate only after the entire write.
        const cache = await caches.open(cacheName);
        await cache.put('/offline.html', response);
      }

      await scope.skipWaiting();
    })(),
  );
});

scope.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await clearCaches(isRetired ? undefined : cacheName);
      if (isRetired) {
        await scope.registration.unregister();
      } else {
        await scope.clients.claim();
      }
    })(),
  );
});

scope.addEventListener('message', (event) => {
  if (event.data !== 'RETIRE_DAYFRAME_OFFLINE') {
    return;
  }

  isRetired = true;
  event.waitUntil(
    (async () => {
      await clearCaches();
      await scope.registration.unregister();
      event.ports[0]?.postMessage('retired');
    })(),
  );
});

scope.addEventListener('fetch', (event) => {
  const {request} = event;
  const url = new URL(request.url);
  if (
    isRetired ||
    request.method !== 'GET' ||
    request.mode !== 'navigate' ||
    url.origin !== scope.location.origin ||
    !isDashboardUrl(url)
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort();
      }, 5000);
      try {
        // HTTP failures and redirects remain HTTP failures. Never replace auth errors.
        const response = await fetch(request, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok || response.redirected) {
          return response;
        }

        const body = await response.arrayBuffer();
        // Fetch() exposes decoded bytes; do not describe them as compressed.
        const headers = new Headers(response.headers);
        headers.delete('Content-Encoding');
        headers.delete('Content-Length');
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch {
        return await fallback();
      } finally {
        clearTimeout(timer);
      }
    })(),
  );
});

async function fallback() {
  const cache = await caches.open(cacheName);
  const response = await cache.match('/offline.html');
  return (
    response ??
    new Response('Dayframe hors connexion. Reconnectez-vous puis réessayez.', {
      status: 503,
      headers: {'Content-Type': 'text/plain; charset=utf-8'},
    })
  );
}

// Return only our installed public document. The startup guard replaces a broken
// document in place, without a special navigation URL or a persisted force flag.
scope.addEventListener('message', (event) => {
  if (
    event.data !== 'DAYFRAME_STARTUP_FAILED' ||
    !event.source ||
    !('url' in event.source) ||
    !isDashboardUrl(new URL(event.source.url))
  ) {
    return;
  }

  event.waitUntil(
    (async () => {
      const response = await fallback();
      if (response.ok) {
        event.ports[0]?.postMessage(await response.text());
      }
    })(),
  );
});
