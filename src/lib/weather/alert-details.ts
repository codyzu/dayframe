// Keep touch-focused controls from disabling the kiosk's idle dismissal, while
// allowing keyboard users to read and navigate without a disappearing panel.
export function mountAlertDetails(root: HTMLElement) {
  const details = root.querySelector<HTMLDetailsElement>('.alert-details')!;
  const summary = details.querySelector<HTMLElement>('summary')!;
  const panel = details.querySelector<HTMLElement>('[data-alert-panel]')!;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let isKeyboard = false;

  function close() {
    clearTimeout(timer);
    if (!details.open) {
      return;
    }

    if (
      details.contains(document.activeElement) &&
      document.activeElement !== summary
    ) {
      summary.focus({preventScroll: true});
    }

    details.open = false;
  }

  function extend() {
    clearTimeout(timer);
    if (
      details.open &&
      !(isKeyboard && details.contains(document.activeElement))
    ) {
      timer = setTimeout(close, 60_000);
    }
  }

  function fit() {
    if (details.open) {
      // A phone's header can put the anchor well below the top. Bound the panel
      // by its actual remaining viewport space, not just a fixed vh height.
      panel.style.maxHeight = `${Math.max(0, Math.min(globalThis.innerHeight * 0.6, globalThis.innerHeight - panel.getBoundingClientRect().top - 16))}px`;
    }
  }

  details.addEventListener('toggle', () => {
    fit();
    extend();
  });
  globalThis.addEventListener('resize', fit);
  globalThis.addEventListener('scroll', fit, {passive: true});
  details.addEventListener('focusin', extend);
  details.addEventListener('focusout', () => {
    queueMicrotask(extend);
  });
  for (const event of ['wheel', 'touchmove', 'scroll']) {
    details.addEventListener(event, extend, {capture: true, passive: true});
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      isKeyboard = false;
      if (details.contains(event.target as Node)) {
        extend();
      } else {
        // Do not consume the event: the outside control still receives its tap.
        close();
      }
    },
    {capture: true},
  );
  document.addEventListener(
    'keydown',
    (event) => {
      isKeyboard = true;
      if (
        event.key === 'Escape' &&
        details.open &&
        !document.querySelector('dialog[open]')
      ) {
        event.preventDefault();
        close();
        return;
      }

      extend();
    },
    {capture: true},
  );
  details.querySelector('[data-alert-close]')!.addEventListener('click', () => {
    close();
    // Mobile WebKit need not focus the tapped button before its click handler.
    summary.focus({preventScroll: true});
  });
  return close;
}
