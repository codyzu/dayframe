import {type AgendaEvent} from '../calendar/contracts.ts';
import {type AgendaForecast} from '../calendar/view.ts';
import {dateKey, type Hour, type Weather} from './adapter.ts';
import {daylightFor} from './daylight.ts';
import {renderWeatherWindow} from './window.ts';
import {conditionFor} from './conditions.ts';
import {summarize} from './summary.ts';
import {dayHours, morningAdvice, forecastAdvice} from './morning.ts';
import {
  createWeatherService,
  type WeatherCache,
  type WeatherState,
} from './service.ts';
import {renderChart} from './forecast-view.ts';
import {
  isWeatherStale,
  weatherReadingLabel,
  renderReadingTime,
  recoveryAdvice,
  unavailableAdvice,
} from './freshness.ts';
import {
  mountFutureWeather,
  forecastDateLabel,
  forecastDates,
} from './future.ts';

const rounded = (value: number) => `${Math.round(value)}°`;

export function mountWeather(
  root: HTMLElement,
  {
    onUpdate,
    isLocalLocation,
    onForecast,
    getAdviceEvents,
  }: {
    onUpdate: (state: WeatherState) => void;
    isLocalLocation: boolean;
    onForecast: (forecast: AgendaForecast | undefined) => void;
    getAdviceEvents: (timezone: string) => readonly AgendaEvent[];
  },
) {
  const future = mountFutureWeather(root, () => {
    renderedMinute = undefined;
    render(latest);
  });
  let isActive = false;
  let latest: WeatherState = {failed: false};
  let renderedWeather: Weather | undefined;
  let renderedDay: string | undefined;
  let chartHours: Hour[] = [];
  let renderedMinute: number | undefined;
  let renderedFailure: boolean | undefined;
  let publishedWeather: Weather | undefined;
  let publishedDate: string | undefined;
  root.dataset.localWeather = String(isLocalLocation);
  onForecast(undefined);
  function text(selector: string, value: string) {
    const element = root.querySelector(selector);
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }

  function publishForecast(weather: Weather | undefined, now: number) {
    const date = dateKey(now);
    if (
      isLocalLocation ||
      (publishedWeather === weather && publishedDate === date)
    ) {
      return;
    }

    publishedWeather = weather;
    publishedDate = date;
    onForecast(
      weather
        ? {date, timezone: weather.timezone, hours: weather.hourly}
        : undefined,
    );
  }

  function renderAdvice(
    advice: ReturnType<typeof morningAdvice>,
    isStale: boolean,
    staleLabel: string,
  ) {
    text('[data-advice]', isStale ? staleLabel : advice.title);
    text('[data-summary]', isStale ? recoveryAdvice : advice.detail);
  }

  function todayAdvice(weather: Weather, now: number, isStale: boolean) {
    return morningAdvice(
      weather,
      now,
      isLocalLocation || isStale ? [] : getAdviceEvents(weather.timezone),
    );
  }

  function render({weather, failed}: WeatherState) {
    onUpdate({weather, failed});
    const now = Date.now();
    const selectedDate = future.update({weather, failed}, now);
    const isFuture = selectedDate !== dateKey(now);
    root.dataset.forecast = String(isFuture);
    if (!weather) {
      root.querySelector<HTMLTimeElement>('[data-reading-age]')!.hidden = true;
    }

    if (!isActive || document.hidden) {
      return;
    }

    const minute = Math.floor(now / 60_000);
    if (
      weather === renderedWeather &&
      minute === renderedMinute &&
      failed === renderedFailure &&
      selectedDate === renderedDay
    ) {
      return;
    }

    renderedMinute = minute;
    renderedFailure = failed;
    const usable = weather && !isWeatherStale(weather, now, failed);
    renderWeatherWindow(root, weather, now, Boolean(usable));
    publishForecast(usable ? weather : undefined, now);

    const dayLabel =
      selectedDate === forecastDates(now)[1]
        ? 'demain'
        : forecastDateLabel(selectedDate, false);
    text(
      '[data-weather-heading]',
      isFuture ? `Prévisions · ${dayLabel}` : 'En ce moment',
    );
    text(
      '[data-forecast-date]',
      isFuture ? forecastDateLabel(selectedDate) : '',
    );
    root.querySelector<HTMLElement>('[data-forecast-date]')!.hidden = !isFuture;
    root.querySelector<HTMLElement>('[data-temperature-label]')!.hidden =
      !isFuture;
    text(
      '[data-advice-heading]',
      isFuture ? `Conseil pour ${dayLabel}` : 'Conseil du jour',
    );
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
    root.querySelector<HTMLTimeElement>('[data-reading-age]')!.hidden =
      isFuture && !isStale;
    root.dataset.stale = String(isStale);
    if (!isFuture && isStale) {
      text('[data-weather-heading]', 'Dernier relevé');
    }

    const daily = weather.daily.find((entry) => entry.date === selectedDate);
    // Pick a returned instant belonging to this local calendar day, including DST.
    let selectedTime =
      weather.hourly.find((hour) => dateKey(hour.time) === selectedDate)
        ?.time ?? Date.parse(`${selectedDate}T12:00:00Z`);
    if (dateKey(selectedTime) !== selectedDate) {
      selectedTime +=
        dateKey(selectedTime) > selectedDate ? -86_400_000 : 86_400_000;
    }

    const {label, icon} = conditionFor(
      isFuture ? daily?.code : weather.current.code,
      isFuture || weather.current.isDay,
    );
    text(
      '[data-temperature]',
      isFuture
        ? daily
          ? rounded(daily.high)
          : '—°'
        : rounded(weather.current.temperature),
    );
    text(
      '[data-condition]',
      isFuture && !daily ? 'Prévision indisponible' : label,
    );
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

    text(
      '[data-extremes]',
      `${isFuture ? '' : `Ressenti ${rounded(weather.current.feelsLike)} · `}${daily ? `Max. ${rounded(daily.high)} / Min. ${rounded(daily.low)}` : 'Max. / Min. du jour indisponibles'}`,
    );
    const summary = summarize(weather, now);
    renderAdvice(
      isFuture
        ? forecastAdvice(weather, selectedDate)
        : todayAdvice(weather, now, isStale),
      isStale,
      staleLabel,
    );
    text(
      '[data-rain]',
      isStale
        ? 'Conditions non actualisées.'
        : isFuture
          ? daily?.probability === undefined
            ? 'Pluie : prévision indisponible'
            : `Pluie ${daily.probability} %`
          : summary.current,
    );
    text(
      '[data-weather-status]',
      isStale ? `${staleLabel}. ${recoveryAdvice}` : '',
    );
    const status = root.querySelector<HTMLElement>('[data-weather-status]');
    if (status) {
      status.hidden = !isStale;
    }

    renderForecast(weather, isFuture ? selectedTime : now, now, isFuture);
  }

  function renderForecast(
    weather: Weather,
    now: number,
    actualNow: number,
    isFuture: boolean,
  ) {
    const today = dateKey(now);
    if (weather !== renderedWeather || today !== renderedDay) {
      renderedWeather = weather;
      renderedDay = today;
      chartHours = dayHours(weather, now);

      renderChart(
        root,
        chartHours,
        isFuture ? undefined : daylightFor(weather, now),
      );
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
    const marker = ((actualNow - start) / (end - start)) * 600;
    const isVisible = !isFuture && marker >= 0 && marker <= 600;
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
    refreshAdvice() {
      const {weather, failed} = latest;
      if (!weather || root.dataset.forecast === 'true') {
        return;
      }

      // Clear private advice even while this view is hidden or the page is paused.
      const now = Date.now();
      const isStale = isWeatherStale(weather, now, failed);
      renderAdvice(
        todayAdvice(weather, now, isStale),
        isStale,
        weatherReadingLabel(weather, now, failed),
      );
    },
    setActive(isActiveValue: boolean) {
      if (isActive === isActiveValue) {
        return;
      }

      isActive = isActiveValue;
      if (isActive) {
        render(latest);
      } else {
        future.reset();
      }
    },
    closeForecast() {
      future.reset();
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
