import {ApiError, photoRequest} from '../photos/client.ts';
import {mountSlideshow} from '../photos/slideshow.ts';
import {mountWeather} from '../weather/view.ts';
import {mountPhotoWeather} from '../photos/weather.ts';
import {mountAgenda} from '../calendar/view.ts';
import {defaultSettings, validateSettings, type Settings} from './settings.ts';
import {
  runtimeConfig,
  formatClock,
  isDisplayMode,
  type DisplayMode,
} from './config.ts';
import {mountDensity} from './density.ts';
import {createModeState} from './schedule.ts';

const dashboard = document.querySelector<HTMLElement>('[data-dashboard]');
if (dashboard) {
  initializeDashboard(dashboard);
}

function initializeDashboard(root: HTMLElement) {
  mountDensity(root);
  const buttons =
    root.querySelectorAll<HTMLButtonElement>('[data-mode-button]');
  const panels = root.querySelectorAll<HTMLElement>('[data-mode-panel]');
  const footer = root.querySelector<HTMLElement>('[data-dashboard-footer]')!;
  const photoRoot = root.querySelector<HTMLElement>('[data-slideshow]')!;
  const weatherRoot = root.querySelector<HTMLElement>('[data-weather]')!;
  const updatePhotoWeather = mountPhotoWeather(photoRoot);

  const slideshow = mountSlideshow(photoRoot);
  const agenda = mountAgenda(root.querySelector<HTMLElement>('[data-agenda]')!);
  let weather = mountWeather(weatherRoot, updatePhotoWeather);
  const state = createModeState();
  let settings = defaultSettings;
  let activeMode: DisplayMode | undefined;
  let clockMinute: number | undefined;
  let clockTimezone: string | undefined;
  const clocks = root.querySelectorAll<HTMLTimeElement>('[data-clock]');
  const dates = root.querySelectorAll<HTMLElement>('[data-date]');
  let navigationUntil = performance.now() + 15_000;
  let refreshAt = 0;
  let previousWall = Date.now();
  let previousMonotonic = performance.now();
  let navigationWall = Date.now() + 15_000;
  let pending: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let isPaused = false;
  let isConfigurationFailed = false;

  function render() {
    const mode = state.mode(Date.now(), performance.now());
    if (mode !== activeMode) {
      activeMode = mode;
      root.dataset.mode = mode;
      panels.forEach((panel) => {
        panel.hidden = panel.dataset.modePanel !== mode;
      });
      buttons.forEach((button) => {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.modeButton === mode),
        );
      });
    }

    const retry = root.querySelector<HTMLButtonElement>('[data-display-retry]');
    if (retry) {
      retry.hidden = !(
        isConfigurationFailed ||
        weatherRoot.dataset.failed === 'true' ||
        (mode === 'photos' && slideshow.hasFailed)
      );
    }

    weather.setActive(mode === 'morning' && !document.hidden && !isPaused);
    agenda.tick(mode === 'morning' && !document.hidden && !isPaused);
    slideshow.checkPrivacy();
    slideshow.setActive(mode === 'photos' && !document.hidden && !isPaused);
    const isNavigationVisible =
      performance.now() < navigationUntil && Date.now() < navigationWall;
    const navigation = isNavigationVisible ? 'visible' : 'hidden';
    if (root.dataset.navigation !== navigation) {
      footer.style.visibility = isNavigationVisible ? '' : 'hidden';
      root.dataset.navigation = navigation;
    }

    const now = new Date();
    const minute = Math.floor(now.getTime() / 60_000);
    if (minute === clockMinute && settings.timezone === clockTimezone) {
      return;
    }

    clockMinute = minute;
    clockTimezone = settings.timezone;
    const {time, date} = formatClock(now);
    clocks.forEach((element) => {
      if (element.textContent !== time) {
        element.textContent = time;
      }

      element.dateTime = new Date(minute * 60_000).toISOString();
    });
    dates.forEach((element) => {
      if (element.textContent !== date) {
        element.textContent = date;
      }
    });
  }

  function applySettings(next: Settings) {
    if (JSON.stringify(settings) === JSON.stringify(next)) {
      return;
    }

    const isWeatherChanged = [
      'timezone',
      'location',
      'latitude',
      'longitude',
    ].some(
      (key) =>
        settings[key as keyof typeof settings] !==
        next[key as keyof typeof next],
    );
    settings = next;
    Object.assign(runtimeConfig, settings);
    state.configure(settings);
    slideshow.configure(settings);
    if (!isWeatherChanged) {
      return;
    }

    weather.dispose();
    weather = mountWeather(weatherRoot, updatePhotoWeather);
  }

  async function refreshConfiguration() {
    if (pending !== undefined || isPaused) {
      return;
    }

    const controller = new AbortController();
    pending = controller;
    refreshAt = Date.now() + 60_000;
    try {
      const response = await photoRequest('/api/config/display', {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]),
      });
      const next = validateSettings(await response.json());
      if (controller.signal.aborted) {
        return;
      }

      applySettings(next);
      isConfigurationFailed = false;

      refreshAt = Date.now() + 300_000;
    } catch (error) {
      isConfigurationFailed = true;
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        slideshow.deny();
        agenda.deny();
        applySettings(defaultSettings);
      }
      // Network/validation errors retain the last validated settings in memory.
    } finally {
      pending = undefined;
      if (controller.signal.aborted) {
        refreshAt = 0;
      }

      root
        .querySelectorAll<HTMLElement>('[data-location]')
        .forEach((element) => {
          element.textContent = `Météo · ${settings.location}`;
        });
      root
        .querySelectorAll<HTMLElement>('[data-location-footer]')
        .forEach((element) => {
          element.textContent = `${settings.location} · ${settings.timezone}`;
        });
      root
        .querySelectorAll<HTMLElement>('[data-location-greeting]')
        .forEach((element) => {
          element.textContent = `Bonjour, ${settings.location}.`;
        });
      render();
    }
  }

  function tick() {
    clearTimeout(timer);
    const wall = Date.now();
    const monotonic = performance.now();
    if (
      Math.abs(wall - previousWall - (monotonic - previousMonotonic)) > 5000
    ) {
      refreshAt = 0;
    }

    previousWall = wall;
    previousMonotonic = monotonic;
    render();
    if (isPaused || document.hidden) {
      return;
    }

    if (Date.now() >= refreshAt) {
      void refreshConfiguration();
    }

    timer = setTimeout(tick, 1000);
  }

  function interact() {
    state.interact(Date.now(), performance.now());
    navigationUntil = performance.now() + 15_000;
    navigationWall = Date.now() + 15_000;
    render();
  }

  root.addEventListener('pointerdown', interact);
  document.addEventListener('keydown', interact);
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.modeButton ?? '';
      if (!isDisplayMode(mode)) {
        return;
      }

      state.interact(Date.now(), performance.now(), mode);
      navigationUntil = performance.now() + 15_000;
      navigationWall = Date.now() + 15_000;
      render();
    });
  });
  function wake() {
    isPaused = false;
    tick();
    void refreshConfiguration();
    slideshow.wake();
    weather.wake();
    agenda.wake();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(timer);
      pending?.abort();
      slideshow.setActive(false);
      weather.setActive(false);
      agenda.pause();
    } else {
      wake();
    }
  });
  globalThis.addEventListener('pagehide', () => {
    isPaused = true;
    clearTimeout(timer);
    pending?.abort();
    slideshow.setActive(false);
    weather.setActive(false);
    agenda.pause();
  });
  globalThis.addEventListener('pageshow', wake);
  globalThis.addEventListener('online', wake);
  root.querySelector('[data-display-retry]')?.addEventListener('click', wake);
  tick();
}
