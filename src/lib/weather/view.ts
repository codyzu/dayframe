import {
  emptyPlanning,
  type DayPlanning,
  type OfficialCalendar,
} from '../dashboard/day-planning.ts';
import {dateKey, type Hour, type Weather} from './adapter.ts';
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
import {
  isWeatherStale,
  weatherReadingLabel,
  renderReadingTime,
  recoveryAdvice,
  unavailableAdvice,
} from './freshness.ts';
import {mountFutureWeather} from './future.ts';

const rounded = (value: number) => `${Math.round(value)}°`;

export function mountWeather(
  root: HTMLElement,
  onUpdate?: (state: WeatherState) => void,
  isLocalLocation = false,
) {
  const future = mountFutureWeather(root);
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

  const routine = (now: number) =>
    isLocalLocation
      ? {
          points: [
            {time: '08:00', label: 'Matin'},
            {time: '11:30', label: 'Midi'},
            {time: '16:30', label: 'Après-midi'},
            {time: '18:00', label: 'Soir'},
          ],
          heading: 'Les repères · heure du lieu',
          note: 'Repères météo du lieu choisi sur cet appareil. Le programme de la maison reste inchangé.',
        }
      : routineForDay(now, planning, calendar);

  function render({weather, failed}: WeatherState) {
    notifyWeatherUpdate({weather, failed});
    future.update({weather, failed});
    if (!weather) {
      root.querySelector<HTMLTimeElement>('[data-reading-age]')!.hidden = true;
    }

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
        text('[data-advice]', 'Météo indisponible.');
        text('[data-summary]', unavailableAdvice);
        text(
          '[data-weather-status]',
          'Aucune donnée en cache · nouvelle tentative automatique.',
        );
      }

      return;
    }

    const isStale = isWeatherStale(weather, now, failed);
    const staleLabel = weatherReadingLabel(weather, now, failed);
    renderReadingTime(
      root.querySelector<HTMLTimeElement>('[data-reading-age]')!,
      weather,
      now,
      failed,
    );
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
    const dayRoutine = routine(now);
    const advice = morningAdvice(weather, now, dayRoutine.points);
    text('[data-advice]', isStale ? staleLabel : advice.title);
    text('[data-checkpoint-heading]', dayRoutine.heading);

    text('[data-day-context]', dayRoutine.note);
    text(
      '[data-rain]',
      isStale ? 'Conditions non actualisées.' : summary.current,
    );
    text('[data-summary]', isStale ? recoveryAdvice : advice.detail);
    text(
      '[data-weather-status]',
      isStale ? `${staleLabel}. ${recoveryAdvice}` : '',
    );
    const status = root.querySelector<HTMLElement>('[data-weather-status]');
    if (status) {
      status.hidden = !isStale;
    }

    renderForecast(weather, now);
  }

  function renderForecast(weather: Weather, now: number) {
    const today = dateKey(now);
    const dayRoutine = routine(now);
    const signature = JSON.stringify(dayRoutine.points);
    if (
      signature !== renderedRoutine ||
      weather !== renderedWeather ||
      today !== renderedDay
    ) {
      renderedRoutine = signature;
      renderCheckpoints(
        root,
        checkpointForecasts(weather, now, dayRoutine.points),
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

  text('[data-temperature]', '—°');
  text('[data-condition]', 'Chargement de la météo…');
  text('[data-extremes]', 'Ressenti — · Max. — / Min. —');
  text('[data-rain]', 'Prévisions en cours de chargement.');
  text('[data-advice]', 'Préparons la journée.');
  text('[data-summary]', 'La météo se met à jour automatiquement.');
  root.dataset.stale = 'false';
  const icon = root.querySelector<HTMLElement>('[data-current-icon]')!;
  for (const name of icon.classList) {
    if (name.startsWith('i-meteocons-')) {
      icon.classList.remove(name);
    }
  }

  icon.classList.add('i-meteocons-not-available-fill');
  root.querySelector('[data-checkpoints]')!.replaceChildren();
  renderChart(root, []);
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
      } else {
        future.close();
      }
    },
    closeForecast() {
      future.close();
    },
    wake() {
      service.wake();
    },
    dispose() {
      future.dispose();
      lifecycle.abort();
      service.stop();
    },
  };
}
