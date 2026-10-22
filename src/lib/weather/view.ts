import {
  emptyPlanning,
  type DayPlanning,
  type OfficialCalendar,
} from '../dashboard/day-planning.ts';
import {
  dateKey,
  hourLabel,
  staleAfter,
  type Hour,
  type Weather,
} from './adapter.ts';
import {conditionFor} from './conditions.ts';
import {summarize} from './summary.ts';
import {
  checkpointForecasts,
  dayHours,
  routineForDay,
  morningAdvice,
} from './morning.ts';
import {
  createWeatherService,
  type WeatherCache,
  type WeatherState,
} from './service.ts';
import {renderChart, renderCheckpoints} from './forecast-view.ts';

const rounded = (value: number) => `${Math.round(value)}°`;

export function mountWeather(
  root: HTMLElement,
  onUpdate?: (state: WeatherState) => void,
) {
  const notifyWeatherUpdate = onUpdate ?? (() => undefined);
  let planning: DayPlanning = emptyPlanning;
  let calendar: OfficialCalendar | undefined;
  let isActive = false;
  let latest: WeatherState = {failed: false};
  let renderedWeather: Weather | undefined;
  let renderedDay: string | undefined;
  let renderedRoutine = '';
  let chartHours: Hour[] = [];
  let renderedMinute: number | undefined;
  let renderedFailure: boolean | undefined;
  function text(selector: string, value: string) {
    const element = root.querySelector(selector);
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }

  function render({weather, failed}: WeatherState) {
    notifyWeatherUpdate({weather, failed});
    if (!isActive || document.hidden) {
      return;
    }

    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    if (
      weather === renderedWeather &&
      minute === renderedMinute &&
      failed === renderedFailure
    ) {
      return;
    }

    renderedMinute = minute;
    renderedFailure = failed;
    if (!weather) {
      if (failed) {
        text('[data-condition]', 'Météo indisponible');
        text('[data-rain]', 'Connexion météo interrompue.');
        text('[data-advice]', 'Consultez la météo avant de partir.');
        text(
          '[data-summary]',
          'Les prévisions réapparaîtront automatiquement.',
        );
        text(
          '[data-weather-status]',
          'Aucune donnée en cache · nouvelle tentative automatique.',
        );
      }

      return;
    }

    const age = Math.max(0, Math.floor((now - weather.fetchedAt) / 60_000));
    const isStale =
      failed ||
      now - Math.min(weather.fetchedAt, weather.current.time) >= staleAfter;
    root.dataset.stale = String(isStale);
    text('[data-weather-heading]', isStale ? 'Dernier relevé' : 'En ce moment');
    const {label, icon} = conditionFor(
      weather.current.code,
      weather.current.isDay,
    );
    text('[data-temperature]', rounded(weather.current.temperature));
    text('[data-condition]', label);
    const iconElement = root.querySelector('[data-current-icon]');
    if (iconElement) {
      const previous = [...iconElement.classList].find((name) =>
        name.startsWith('i-meteocons-'),
      );
      if (previous !== icon) {
        if (previous !== undefined) {
          iconElement.classList.remove(previous);
        }

        iconElement.classList.add(icon);
      }
    }

    const daily = weather.daily.find((entry) => entry.date === dateKey(now));
    text(
      '[data-extremes]',
      `Ressenti ${rounded(weather.current.feelsLike)} · ${daily ? `Max. ${rounded(daily.high)} / Min. ${rounded(daily.low)}` : 'Max. / Min. du jour indisponibles'}`,
    );
    const summary = summarize(weather, now);
    const routine = routineForDay(now, planning, calendar);
    const advice = morningAdvice(weather, now, routine.points);
    text(
      '[data-advice]',
      isStale ? 'Vérifiez la météo avant de partir.' : advice.title,
    );
    text('[data-checkpoint-heading]', routine.heading);

    text('[data-day-context]', routine.note);
    text(
      '[data-rain]',
      isStale
        ? `Dernier relevé : ${dateKey(weather.current.time)} à ${hourLabel(weather.current.time)}.`
        : summary.current,
    );
    text(
      '[data-summary]',
      isStale
        ? 'Données anciennes : vérifiez la météo avant de partir.'
        : advice.detail,
    );
    text(
      '[data-weather-status]',
      `${isStale ? 'Données anciennes' : 'Mise à jour'} · il y a ${age} min${failed ? ' · connexion interrompue, nouvelle tentative automatique' : ''}`,
    );
    const status = root.querySelector<HTMLElement>('[data-weather-status]');
    if (status) {
      status.hidden = !isStale;
    }

    renderForecast(weather, now);
  }

  function renderForecast(weather: Weather, now: number) {
    const today = dateKey(now);
    const routine = routineForDay(now, planning, calendar);
    const signature = JSON.stringify(routine.points);
    if (
      signature !== renderedRoutine ||
      weather !== renderedWeather ||
      today !== renderedDay
    ) {
      renderedRoutine = signature;
      renderCheckpoints(
        root,
        checkpointForecasts(weather, now, routine.points),
      );
    }

    if (weather !== renderedWeather || today !== renderedDay) {
      renderedWeather = weather;
      renderedDay = today;
      chartHours = dayHours(weather, now);

      renderChart(root, chartHours);
    }

    const line = root.querySelector<SVGElement>('[data-weather-now-line]');
    const markerLabel = root.querySelector<HTMLElement>(
      '[data-weather-now-label]',
    );
    if (!line || !markerLabel || chartHours.length < 2) {
      return;
    }

    const start = chartHours[0].time;
    const end = chartHours.at(-1)!.time;
    const marker = ((now - start) / (end - start)) * 600;
    const isVisible = marker >= 0 && marker <= 600;
    line.style.display = isVisible ? '' : 'none';
    markerLabel.hidden = !isVisible;
    if (!isVisible) {
      return;
    }

    line.setAttribute('x1', String(marker));
    line.setAttribute('x2', String(marker));
    markerLabel.style.left = `clamp(0%, ${marker / 6}%, 75%)`;
  }

  let storage: WeatherCache | undefined;
  try {
    storage = localStorage;
  } catch {
    /*
    Private browsing may deny storage access.
    */
  }

  const service = createWeatherService((state) => {
    latest = state;
    // Retry visibility also needs failures received while another mode is active.
    if (root.dataset.failed !== String(state.failed)) {
      root.dataset.failed = String(state.failed);
    }

    render(state);
  }, storage);
  service.start();
  const lifecycle = new AbortController();
  const options = {signal: lifecycle.signal};
  globalThis.addEventListener(
    'pagehide',
    () => {
      service.stop();
    },
    options,
  );
  globalThis.addEventListener(
    'pageshow',
    () => {
      service.start();
      service.wake();
    },
    options,
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (!document.hidden) {
        service.wake();
      }
    },
    options,
  );
  globalThis.addEventListener(
    'online',
    () => {
      service.wake();
    },
    options,
  );
  return {
    configure(next: DayPlanning, official?: OfficialCalendar) {
      planning = next;
      calendar = official;
      renderedMinute = undefined;
      renderedRoutine = '';
      const container = root.querySelector('[data-checkpoints]');
      if (container) {
        container.replaceChildren();
      }

      render(latest);
    },
    setActive(isActiveValue: boolean) {
      if (isActive === isActiveValue) {
        return;
      }

      isActive = isActiveValue;
      if (isActive) {
        render(latest);
      }
    },
    wake() {
      service.wake();
    },
    dispose() {
      lifecycle.abort();
      service.stop();
    },
  };
}
