/* global browser, document, window, location, requestAnimationFrame */
// SPDX-License-Identifier: MIT
// Isolated extension world. No page messages, inputs, credentials, photos or URLs are forwarded.
(() => {
  // The page Window and isolated extension global are different objects in content scripts.
  // eslint-disable-next-line unicorn/prefer-global-this
  if (window.top !== window) {
    return;
  }

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
