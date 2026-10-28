import {type DisplayMode} from './config.ts';

export const screenOrder: DisplayMode[] = ['morning', 'photos', 'night'];

type Point = {x: number; y: number};
export function swipeDirection(start: Point, end: Point, elapsed: number) {
  const x = end.x - start.x;
  const y = end.y - start.y;
  if (elapsed > 1000 || Math.abs(x) < 60 || Math.abs(x) < Math.abs(y) * 1.6) {
    return 0;
  }

  return x < 0 ? 1 : -1;
}

const interactive =
  'button, a, input, select, textarea, summary, dialog, [role="button"], [contenteditable="true"], [data-dashboard-footer]';

export function mountTouchNavigation(
  root: HTMLElement,
  callbacks: {
    mode: () => DisplayMode;
    select: (mode: DisplayMode) => void;
    photo: (direction: 'next' | 'previous') => void;
  },
) {
  let start:
    | {id: number; point: Point; time: number; mode: DisplayMode; moved: number}
    | undefined;
  let shouldSuppressClick = false;
  const isBlocked = (target: EventTarget | undefined) =>
    document.querySelector('dialog[open]') !== null ||
    (target instanceof Element && target.closest(interactive) !== null);
  function cancel() {
    if (start) {
      shouldSuppressClick = true;
    }

    start = undefined;
  }

  document.addEventListener(
    'pointerdown',
    (event) => {
      if (start !== undefined || !event.isPrimary) {
        cancel();
        return;
      }

      shouldSuppressClick = false;
      if (
        event.button !== 0 ||
        !root.contains(event.target as Node) ||
        isBlocked(event.target ?? undefined)
      ) {
        return;
      }

      start = {
        id: event.pointerId,
        point: {x: event.clientX, y: event.clientY},
        time: performance.now(),
        mode: callbacks.mode(),
        moved: 0,
      };
    },
    {capture: true},
  );
  document.addEventListener('pointermove', (event) => {
    if (start?.id === event.pointerId) {
      start.moved = Math.max(
        start.moved,
        Math.hypot(
          event.clientX - start.point.x,
          event.clientY - start.point.y,
        ),
      );
    }
  });
  document.addEventListener('pointerup', (event) => {
    const gesture = start;
    if (event.pointerId !== gesture?.id) {
      return;
    }

    start = undefined;
    shouldSuppressClick = true;
    if (
      callbacks.mode() !== gesture.mode ||
      document.querySelector('dialog[open]')
    ) {
      return;
    }

    const elapsed = performance.now() - gesture.time;
    const movement = Math.max(
      gesture.moved,
      Math.hypot(
        event.clientX - gesture.point.x,
        event.clientY - gesture.point.y,
      ),
    );
    const direction = swipeDirection(
      gesture.point,
      {x: event.clientX, y: event.clientY},
      elapsed,
    );
    if (direction !== 0) {
      const mode = screenOrder[screenOrder.indexOf(gesture.mode) + direction];
      if (mode !== undefined) {
        callbacks.select(mode);
      }

      root
        .querySelector<HTMLElement>('[data-touch-hint]')
        ?.setAttribute('hidden', '');
    } else if (gesture.mode === 'photos' && movement <= 12 && elapsed < 500) {
      const fraction = event.clientX / globalThis.innerWidth;
      if (fraction < 0.3 || fraction > 0.7) {
        callbacks.photo(fraction < 0.3 ? 'previous' : 'next');
      }
    }
  });
  document.addEventListener('pointercancel', cancel);
  globalThis.addEventListener('blur', cancel);
  globalThis.addEventListener('pagehide', cancel);
  root.addEventListener(
    'click',
    (event) => {
      if (!shouldSuppressClick || event.detail === 0) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      shouldSuppressClick = false;
    },
    {capture: true},
  );
  root.addEventListener('keydown', (event) => {
    if (
      isBlocked(event.target ?? undefined) ||
      event.altKey ||
      event.metaKey ||
      event.ctrlKey
    ) {
      return;
    }

    const direction =
      event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
    if (direction === 0) {
      return;
    }

    event.preventDefault();
    const mode = screenOrder[screenOrder.indexOf(callbacks.mode()) + direction];
    if (mode !== undefined) {
      callbacks.select(mode);
    }
  });
}
