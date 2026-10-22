import {isDashboardUrl} from './navigation-policy.ts';

export function mountUpdates(root: HTMLElement, beforeReload: () => void) {
  if (!isDashboardUrl(new URL(location.href))) {
    return;
  }

  const build = import.meta.env.PUBLIC_BUILD_ID as string;
  root.dataset.build = build;
  const attemptedKey = 'dayframe.update-target';
  let isPending = false;
  let target: string | undefined;
  let isReloading = false;
  let isActive = true;

  function reload() {
    if (target === undefined || isReloading || !isActive) {
      return;
    }

    try {
      // Persist before navigation: stale HTML must not repeatedly reload.
      sessionStorage.setItem(attemptedKey, target);
      beforeReload();
    } catch {
      return;
    }

    isReloading = true;
    location.reload();
  }

  async function check() {
    if (isPending || isReloading || !isActive) {
      return;
    }

    isPending = true;
    try {
      const response = await fetch('/version.json', {
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
      });
      const value = (await response.json()) as {build?: unknown};
      if (
        !response.ok ||
        typeof value.build !== 'string' ||
        !/^[\d\-a-f]{36}$/v.test(value.build) ||
        value.build === build ||
        value.build === sessionStorage.getItem(attemptedKey)
      ) {
        return;
      }

      target = value.build;
      if (
        root.dataset.mode !== 'photos' ||
        !root.querySelector(':scope [data-photo-stage] img')
      ) {
        setTimeout(reload, 0);
      }
    } catch {
      // Failed/version-invalid checks leave display and private lease untouched.
    } finally {
      isPending = false;
    }
  }

  globalThis.addEventListener('dayframe:slide', reload);
  globalThis.addEventListener('online', () => {
    void check();
  });
  const observer = new MutationObserver(() => {
    if (target !== undefined && root.dataset.mode !== 'photos') {
      setTimeout(reload, 0);
    }
  });
  observer.observe(root, {attributes: true, attributeFilter: ['data-mode']});
  let timer: ReturnType<typeof setInterval> | undefined = setInterval(() => {
    void check();
  }, 30 * 60_000);
  globalThis.addEventListener('pagehide', () => {
    isActive = false;
    clearInterval(timer);
    timer = undefined;
    observer.disconnect();
  });
  globalThis.addEventListener('pageshow', () => {
    if (isActive) {
      return;
    }

    isActive = true;
    observer.observe(root, {attributes: true, attributeFilter: ['data-mode']});
    timer = setInterval(() => {
      void check();
    }, 30 * 60_000);
    void check();
  });
  void check();
}
