import {type DisplayMode} from './config.ts';
import {screenOrder} from './touch.ts';

// Animate the existing live view in two short halves. No screenshot, duplicate
// private DOM, or extra photo pixels survive a mode change or access invalidation.
export function mountScreenTransition(root: HTMLElement) {
  let animation: Animation | undefined;
  let generation = 0;
  let target: DisplayMode | undefined;
  let isCommitting = false;
  let isAnimationEnabled = true;
  let stopWaiting: (() => void) | undefined;
  const reducedMotion = globalThis.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );

  function cancel() {
    if (isCommitting) {
      return;
    }

    generation++;
    animation?.cancel();
    animation = undefined;
    stopWaiting?.();
    stopWaiting = undefined;
    target = undefined;
    delete root.dataset.transition;
  }

  async function half(from: string, to: string) {
    animation?.cancel();
    animation = root.animate([{transform: from}, {transform: to}], {
      duration: 110,
      easing: 'ease-out',
      fill: 'forwards',
    });
    // A missed completion must never strand the display offscreen.
    const active = animation;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        isAnimationEnabled = false;
        resolve();
      }, 400);
      void active.finished
        .catch(() => undefined)
        .then(() => {
          clearTimeout(timer);
          resolve();
        });
    });
  }

  async function waitForPhoto() {
    const stage = root.querySelector<HTMLElement>('[data-photo-stage]')!;
    if (
      stage.querySelector('img') !== null ||
      stage.getAttribute('aria-busy') !== 'true'
    ) {
      return;
    }

    await new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        if (
          stage.querySelector('img') !== null ||
          stage.getAttribute('aria-busy') !== 'true'
        ) {
          finish();
        }
      });
      const timer = setTimeout(finish, 250);
      function finish() {
        observer.disconnect();
        clearTimeout(timer);
        stopWaiting = undefined;
        resolve();
      }

      stopWaiting = finish;
      observer.observe(stage, {attributes: true, childList: true});
    });
  }

  function commit(change: () => void) {
    isCommitting = true;
    try {
      change();
    } finally {
      isCommitting = false;
    }
  }

  async function select(mode: DisplayMode, change: () => void) {
    const source = root.dataset.mode as DisplayMode;
    cancel();
    if (
      !isAnimationEnabled ||
      source === mode ||
      reducedMotion.matches ||
      typeof root.animate !== 'function' ||
      document.hidden
    ) {
      commit(change);
      return;
    }

    const run = generation;
    target = mode;
    root.dataset.transition = 'slide';
    const direction =
      screenOrder.indexOf(mode) > screenOrder.indexOf(source) ? 1 : -1;
    try {
      await half('translateX(0)', `translateX(${-direction * 100}vw)`);
      if (run !== generation) {
        return;
      }

      commit(change);
      if (mode === 'photos') {
        await waitForPhoto();
      }

      if (run !== generation) {
        return;
      }

      if (isAnimationEnabled) {
        await half(`translateX(${direction * 100}vw)`, 'translateX(0)');
      }
    } catch {
      isAnimationEnabled = false;
      if (run === generation) {
        commit(change);
      }
    } finally {
      if (run === generation) {
        cancel();
      }
    }
  }

  reducedMotion.addEventListener('change', cancel);
  document.addEventListener('visibilitychange', cancel);
  globalThis.addEventListener('pagehide', cancel);
  return {
    select,
    cancel,
    get target() {
      return target;
    },
  };
}
