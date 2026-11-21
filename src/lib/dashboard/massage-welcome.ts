import {photoRequest} from '../photos/client.ts';
import {conditionFor} from '../weather/conditions.ts';
import {type WeatherState} from '../weather/service.ts';
import {
  remembersMassageWelcome,
  rememberEnrollment,
} from './massage-enrollment.ts';
import {
  isDuringMassage,
  massageSnapshotLifetime,
  validateMassageSnapshot,
  type MassageSnapshot,
} from './massage-windows.ts';

export function mountMassageWelcome(root: HTMLElement, render: () => void) {
  const isFrame =
    new URLSearchParams(location.search).get('display') === 'frame';
  const panel = root.querySelector<HTMLElement>('[data-massage-panel]')!;
  const clock = panel.querySelector<HTMLElement>('[data-massage-clock]')!;
  const temperature = panel.querySelector<HTMLElement>(
    '[data-massage-weather]',
  )!;
  const logo = panel.querySelector<HTMLImageElement>('img')!;
  const pause = panel.querySelector<HTMLButtonElement>('button')!;
  const night = root.querySelector<HTMLElement>('[data-night-content]')!;
  let isAwaitingStatus = isFrame;
  let isEnabled = isFrame && remembersMassageWelcome();
  let snapshot: MassageSnapshot | undefined;
  let snapshotDeadline = 0;
  let pauseDeadline = 0;
  let pauseWallDeadline = 0;
  let revealDeadline = 0;
  let isArtworkAvailable = true;
  let isWelcomeVisible = false;
  let nextPoll = 0;
  let pending: AbortController | undefined;

  logo.addEventListener('error', () => {
    isArtworkAvailable = false;
    logo.hidden = true;
  });
  panel.addEventListener('click', () => {
    revealDeadline = performance.now() + 10_000;
    render();
  });
  pause.addEventListener('click', (event) => {
    event.stopPropagation();
    pauseDeadline = performance.now() + 60_000;
    pauseWallDeadline = Date.now() + 60_000;
    revealDeadline = 0;
    // The pause button leaves the tab order while the clock is displayed.
    panel.focus({preventScroll: true});
    render();
  });

  function apply() {
    const now = Date.now();
    const monotonic = performance.now();
    const current = snapshot;
    const isFresh =
      current !== undefined &&
      monotonic < snapshotDeadline &&
      now >= current.fetchedAt &&
      now < current.fetchedAt + massageSnapshotLifetime;
    const isAppointment =
      isFresh && current.windows.some((window) => isDuringMassage(window, now));
    const isProtected =
      isAwaitingStatus || (isEnabled && (!isFresh || isAppointment));
    if (isProtected !== isWelcomeVisible) {
      isWelcomeVisible = isProtected;
      if (isProtected) {
        // Native dialogs enter the top layer and could otherwise expose the agenda.
        for (const dialog of root.querySelectorAll<HTMLDialogElement>(
          'dialog[open]',
        )) {
          dialog.close();
        }
      } else {
        pauseDeadline = 0;
        revealDeadline = 0;
        if (panel.contains(document.activeElement)) {
          root.focus({preventScroll: true});
        }
      }
    }

    const isPaused =
      isAppointment && monotonic < pauseDeadline && now < pauseWallDeadline;
    if (isAppointment && !logo.hasAttribute('src')) {
      logo.src = logo.dataset.src!;
    }

    panel.hidden = !isProtected;
    night.hidden = isProtected;
    logo.hidden = !isAppointment || isPaused || !isArtworkAvailable;
    clock.hidden = !isPaused;
    pause.hidden = !isAppointment || isPaused;
    pause.disabled = pause.hidden;
    pause.dataset.revealed = String(monotonic < revealDeadline);
    root.dataset.massageWelcome = isProtected
      ? isPaused
        ? 'pause'
        : isAppointment
          ? 'logo'
          : 'neutral'
      : 'off';
    return {
      isProtected,
      isPaused,
      shouldClearOverride: isProtected && isEnabled,
    };
  }

  async function poll() {
    const controller = new AbortController();
    pending = controller;
    nextPoll = Date.now() + 15_000;
    try {
      const response = await photoRequest('/api/calendar/massage-welcome', {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      });
      const body = (await response.json()) as {
        enabled?: unknown;
        snapshot?: unknown;
      };
      if (controller.signal.aborted || typeof body.enabled !== 'boolean') {
        return;
      }

      isEnabled = body.enabled;
      rememberEnrollment(isEnabled);
      snapshot =
        isEnabled && body.snapshot !== undefined
          ? validateMassageSnapshot(body.snapshot)
          : undefined;
      snapshotDeadline = snapshot
        ? performance.now() +
          Math.min(
            massageSnapshotLifetime,
            snapshot.fetchedAt + massageSnapshotLifetime - Date.now(),
          )
        : 0;
    } catch {
      // Leave a previously enrolled frame protected, including after authorization loss.
      snapshot = undefined;
    } finally {
      pending = undefined;
      if (!controller.signal.aborted) {
        isAwaitingStatus = false;
        nextPoll = Date.now() + (isEnabled ? 15_000 : 60_000);
        render();
      }
    }
  }

  return {
    apply,
    tick() {
      if (isFrame && pending === undefined && Date.now() >= nextPoll) {
        void poll();
      }
    },
    wake() {
      nextPoll = 0;
    },
    stop() {
      pending?.abort();
    },
    weather({weather}: WeatherState) {
      const text = weather
        ? `${Math.round(weather.current.temperature)}° · ${conditionFor(weather.current.code, weather.current.isDay).label}`
        : 'Météo indisponible';
      if (temperature.textContent !== text) {
        temperature.textContent = text;
      }
    },
  };
}
