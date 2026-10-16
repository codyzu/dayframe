import {photoRequest} from '../photos/client.ts';
import {mountSlideshow} from '../photos/slideshow.ts';
import {mountWeather} from '../weather/view.ts';
import {defaultSettings, validateSettings} from './settings.ts';
import {
  runtimeConfig,
  displayConfig,
  formatClock,
  isDisplayMode,
  type DisplayMode,
} from './config.ts';
import {mountDensity} from './density.ts';

const dashboard = document.querySelector<HTMLElement>('[data-dashboard]');
if (dashboard) {
  void initializeDashboard(dashboard);
}

async function initializeDashboard(root: HTMLElement) {
  mountDensity(root);
  const buttons =
    root.querySelectorAll<HTMLButtonElement>('[data-mode-button]');
  const panels = root.querySelectorAll<HTMLElement>('[data-mode-panel]');
  let slideshow: ReturnType<typeof mountSlideshow> | undefined;
  let activeMode: DisplayMode = displayConfig.initialMode;
  function showMode(mode: DisplayMode) {
    activeMode = mode;
    root.dataset.mode = mode;
    slideshow?.setActive(mode === 'photos' && !document.hidden);
    buttons.forEach((button) => {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.modeButton === mode),
      );
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.modePanel !== mode;
    });
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const mode = button.dataset.modeButton ?? '';
      if (isDisplayMode(mode)) {
        showMode(mode);
      }
    });
  });
  showMode(activeMode);
  function updateClock() {
    const {time, date} = formatClock(new Date());
    root.querySelectorAll<HTMLElement>('[data-clock]').forEach((element) => {
      element.textContent = time;
      element.setAttribute('datetime', new Date().toISOString());
    });
    root.querySelectorAll<HTMLElement>('[data-date]').forEach((element) => {
      element.textContent = date;
    });
  }

  updateClock();
  setInterval(updateClock, 1000);
  document.addEventListener('visibilitychange', updateClock);

  let settings = defaultSettings;
  try {
    const response = await photoRequest('/api/config/display', {
      signal: AbortSignal.timeout(5000),
    });
    settings = validateSettings(await response.json());
    Object.assign(runtimeConfig, settings);
  } catch {
    // Public visits and temporary outages use the public defaults.
  }

  root.querySelectorAll<HTMLElement>('[data-location]').forEach((element) => {
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
  updateClock();
  const photoRoot = root.querySelector<HTMLElement>('[data-slideshow]');
  if (photoRoot) {
    slideshow = mountSlideshow(photoRoot, settings);
  }

  // Preserve any mode selected while the configuration request was pending.
  showMode(activeMode);
  const weatherRoot = root.querySelector<HTMLElement>('[data-weather]');
  if (weatherRoot) {
    mountWeather(weatherRoot);
  }
}
