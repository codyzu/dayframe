import {mountWeather} from '../weather/view.ts';
import {
  displayConfig,
  formatClock,
  isDisplayMode,
  type DisplayMode,
} from './config.ts';

const dashboard = document.querySelector<HTMLElement>('[data-dashboard]');
if (dashboard) {
  const buttons =
    dashboard.querySelectorAll<HTMLButtonElement>('[data-mode-button]');
  const panels = dashboard.querySelectorAll<HTMLElement>('[data-mode-panel]');
  function showMode(mode: DisplayMode) {
    if (!dashboard) {
      return;
    }

    dashboard.dataset.mode = mode;
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
  showMode(displayConfig.initialMode);

  function updateClock() {
    const {time, date} = formatClock(new Date());
    dashboard
      ?.querySelectorAll<HTMLElement>('[data-clock]')
      .forEach((element) => {
        element.textContent = time;
        element.setAttribute('datetime', new Date().toISOString());
      });
    dashboard
      ?.querySelectorAll<HTMLElement>('[data-date]')
      .forEach((element) => {
        element.textContent = date;
      });
  }

  updateClock();
  setInterval(updateClock, 1000);
  document.addEventListener('visibilitychange', updateClock);
}

const weatherRoot = document.querySelector<HTMLElement>('[data-weather]');
if (weatherRoot) {
  mountWeather(weatherRoot);
}
