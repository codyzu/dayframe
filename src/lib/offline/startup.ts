import {isDashboardUrl} from './navigation-policy.ts';

if (isDashboardUrl(new URL(location.href)) && 'serviceWorker' in navigator) {
  let isReady = false;
  globalThis.addEventListener(
    'dayframe:ready',
    () => {
      isReady = true;
      try {
        sessionStorage.removeItem('dayframe.offline-return');
        sessionStorage.removeItem('dayframe.offline-return-delay');
      } catch {
        // Storage denial must not turn successful startup into a fault.
      }
    },
    {once: true},
  );
  void navigator.serviceWorker
    .register('/sw.js', {scope: '/', updateViaCache: 'none'})
    .catch(() => undefined);
  setTimeout(() => {
    if (isReady) {
      return;
    }

    const worker = navigator.serviceWorker.controller;
    if (!worker) {
      return;
    }

    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
    }, 5000);
    channel.port1.addEventListener(
      'message',
      (event: MessageEvent<unknown>) => {
        clearTimeout(timer);
        channel.port1.close();
        if (
          isReady ||
          typeof event.data !== 'string' ||
          !event.data.startsWith('<!doctype html>') ||
          !event.data.includes('data-offline')
        ) {
          return;
        }

        // Only the installed worker's public, hash-CSP document enters this sink.
        // Replace the failed document at its existing URL; no iframe/native URL
        // exception, reload marker, or full-dashboard cache is involved.
        globalThis.stop();
        document.open();
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- Trusted standalone document replacement must execute its hash-authorized script in this same top-level URL.
        document.write(event.data);
        document.close();
      },
    );
    channel.port1.start();

    worker.postMessage('DAYFRAME_STARTUP_FAILED', [channel.port2]);
  }, 20_000);
}
