import {mountUpdates} from '../offline/updates.ts';
import {mountAlerts} from '../weather/alerts.ts';
import {ApiError, photoRequest} from '../photos/client.ts';
import {mountSlideshow} from '../photos/slideshow.ts';
import {mountWeather} from '../weather/view.ts';
import {mountPhotoWeather} from '../photos/weather.ts';
import {mountAgenda} from '../calendar/view.ts';
import {
  dayContext,
  observanceText,
  validateOfficialCalendar,
  type OfficialCalendar,
} from './day-planning.ts';
import {defaultSettings, validateSettings, type Settings} from './settings.ts';
import {
  runtimeConfig,
  formatClock,
  isDisplayMode,
  type DisplayMode,
} from './config.ts';
import {createModeState} from './schedule.ts';

const dashboard = document.querySelector<HTMLElement>('[data-dashboard]');
if (dashboard) {
  initializeDashboard(dashboard);
}

function initializeDashboard(root: HTMLElement) {
  const buttons =
    root.querySelectorAll<HTMLButtonElement>('[data-mode-button]');
  const panels = root.querySelectorAll<HTMLElement>('[data-mode-panel]');
  const footer = root.querySelector<HTMLElement>('[data-dashboard-footer]')!;
  const photoRoot = root.querySelector<HTMLElement>('[data-slideshow]')!;
  const weatherRoot = root.querySelector<HTMLElement>('[data-weather]')!;
  const updatePhotoWeather = mountPhotoWeather(photoRoot);
  const alerts = mountAlerts(
    root.querySelector<HTMLElement>('[data-weather-alerts]')!,
  );

  const slideshow = mountSlideshow(photoRoot, footer);
  const agenda = mountAgenda(root.querySelector<HTMLElement>('[data-agenda]')!);
  let weather = mountWeather(weatherRoot, updatePhotoWeather);
  const state = createModeState();
  const updateOverrideKey = 'dayframe.update-override';
  try {
    state.restore(
      JSON.parse(sessionStorage.getItem(updateOverrideKey) ?? 'null'),
      Date.now(),
      performance.now(),
    );
    sessionStorage.removeItem(updateOverrideKey);
  } catch {
    // Unavailable session storage leaves the ordinary schedule in effect.
  }

  if (import.meta.env.PUBLIC_OFFLINE_NAVIGATION === true) {
    mountUpdates(root, () => {
      const snapshot = state.snapshot(Date.now(), performance.now());
      sessionStorage.setItem(
        updateOverrideKey,
        JSON.stringify(snapshot ?? null),
      );
    });
  }

  let settings = defaultSettings;
  let official: OfficialCalendar | undefined;
  let calendarRefreshAt = 0;
  let calendarPending: AbortController | undefined;
  const observance = root.querySelector<HTMLElement>('[data-day-observance]')!;

  async function refreshCalendar() {
    if (
      isPaused ||
      calendarPending !== undefined ||
      !settings.planning.schoolCalendar ||
      document.hidden
    ) {
      return;
    }

    const controller = new AbortController();
    calendarPending = controller;
    calendarRefreshAt = Date.now() + 60_000;
    try {
      const response = await photoRequest('/api/day-context', {
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(12_000),
        ]),
      });
      const body = (await response.json()) as {calendar: unknown};
      if (controller.signal.aborted || !settings.planning.schoolCalendar) {
        return;
      }

      official = validateOfficialCalendar(body.calendar);
      state.calendar(official);
      weather.configure(settings.planning, official);
      calendarRefreshAt =
        Date.now() +
        (Date.now() - official.fetchedAt >= 86_400_000 ? 300_000 : 3_600_000);
      render();
    } catch (error) {
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        slideshow.deny();
        agenda.deny();
        applySettings(defaultSettings);
      }
    } finally {
      calendarPending = undefined;
    }
  }

  let activeMode: DisplayMode | undefined;
  let hadOverride = false;
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
    const context = dayContext(
      Date.now(),
      settings.timezone,
      settings.planning,
      official,
    );
    const dayNote = observanceText(context);
    if (observance.textContent !== dayNote) {
      observance.textContent = dayNote;
      observance.hidden = dayNote === '';
      observance.title = dayNote;
      weatherRoot.dataset.observance = String(dayNote !== '');
    }

    const mode = state.mode(Date.now(), performance.now());
    const hasOverride =
      state.snapshot(Date.now(), performance.now()) !== undefined;
    if (hadOverride && !hasOverride) {
      weather.closeForecast();
    }

    hadOverride = hasOverride;
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

    footer.querySelector<HTMLElement>('[data-photo-feedback]')!.hidden =
      mode !== 'photos';
    const retry = root.querySelector<HTMLButtonElement>('[data-display-retry]');
    if (retry) {
      retry.hidden = !(
        isConfigurationFailed ||
        weatherRoot.dataset.failed === 'true' ||
        (mode === 'photos' && slideshow.hasFailed)
      );
    }

    const isMorningActive = mode === 'morning' && !document.hidden && !isPaused;
    weather.setActive(isMorningActive);
    agenda.tick(isMorningActive);
    alerts.tick(isMorningActive);
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
    if (!settings.planning.schoolCalendar) {
      calendarPending?.abort();
      official = undefined;
      state.calendar(undefined);
    }

    calendarRefreshAt = 0;
    weather.configure(settings.planning, official);
    slideshow.configure(settings);
    if (!isWeatherChanged) {
      return;
    }

    weather.dispose();
    weather = mountWeather(weatherRoot, updatePhotoWeather);
    weather.configure(settings.planning, official);
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

    if (Date.now() >= calendarRefreshAt) {
      void refreshCalendar();
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
    calendarRefreshAt = 0;
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
      calendarPending?.abort();
      slideshow.setActive(false);
      weather.setActive(false);
      agenda.pause();
      alerts.pause();
    } else {
      wake();
    }
  });
  globalThis.addEventListener('pagehide', () => {
    isPaused = true;
    clearTimeout(timer);
    pending?.abort();
    calendarPending?.abort();
    slideshow.setActive(false);
    weather.setActive(false);
    agenda.pause();
    alerts.pause();
  });
  globalThis.addEventListener('pageshow', wake);
  globalThis.addEventListener('online', wake);
  root.querySelector('[data-display-retry]')?.addEventListener('click', wake);
  tick();
  root.dataset.ready = 'true';
  globalThis.dispatchEvent(new Event('dayframe:ready'));
}
