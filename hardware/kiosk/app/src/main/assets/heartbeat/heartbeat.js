/* global browser, document, window, location, requestAnimationFrame */
// SPDX-License-Identifier: MIT
// Isolated extension world. No page messages, inputs, credentials, photos or URLs are forwarded.
(() => {
  // The page Window and isolated extension global are different objects in content scripts.
  // eslint-disable-next-line unicorn/prefer-global-this
  if (window.top !== window) {
    return;
  }

  const offlineReady = () => {
    const offline = document.querySelector('[data-offline]');
    const image = offline?.querySelector(':scope [data-stage] img');
    const retry = offline?.querySelector('button');
    const offlineStatus = offline?.querySelector('[data-status]');
    const visible = (element) =>
      element && !element.hidden && element.getBoundingClientRect().height > 0;
    const isOfflineReady = Boolean(
      offline?.dataset.offlineState === 'playback'
        ? visible(image) && image.complete && image.naturalWidth > 0
        : offline?.dataset.offlineState === 'retry' &&
            visible(retry) &&
            visible(offlineStatus) &&
            offlineStatus.textContent?.trim(),
    );
    return isOfflineReady;
  };

  const report = () => {
    if (document.hidden) {
      return;
    }

    // A requestAnimationFrame liveness signal is distinct from first paint or page load success.
    requestAnimationFrame(() => {
      const isSetup = ['/setup', '/setup/'].includes(location.pathname);
      const root = document.querySelector('[data-dashboard]');
      const mode = root?.dataset.mode;
      const selectors = {
        morning: '[data-mode-panel="morning"]',
        photos: '[data-mode-panel="photos"]',
        home: '[data-mode-panel="home"]',
        night: '[data-mode-panel="night"]',
      };
      const panel = root?.querySelector(selectors[mode] ?? '[data-no-mode]');
      const clock = root?.querySelector('[data-clock]')?.textContent?.trim();
      const status =
        root?.querySelector('[data-photo-status]')?.textContent ?? '';
      const isReady =
        isSetup ||
        offlineReady() ||
        Boolean(
          panel &&
          clock &&
          clock !== '--:--' &&
          !panel.hidden &&
          panel.getBoundingClientRect().height > 0 &&
          ['morning', 'photos', 'home', 'night'].includes(mode),
        );
      browser.runtime
        .sendNativeMessage('dayframe', {
          kind: isSetup ? 'setup' : 'dashboard',
          ready: isReady,
          denied: status.startsWith('Accès privé requis.'),
        })
        .catch(() => {});
    });
  };

  report();
  setInterval(report, 5000);
})();
