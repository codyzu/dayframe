import {dateKey, hourLabel, type Weather} from './adapter.ts';
import {conditionFor} from './conditions.ts';
import {staleWeatherLabel, isWeatherStale} from './freshness.ts';
import {type WeatherState} from './service.ts';
import {renderFutureChart} from './future-chart.ts';
import {selectedDaySummary} from './outlook.ts';

// Calendar arithmetic on ISO dates, never 24-hour steps through local DST.
export function forecastDates(now: number) {
  const today = Date.parse(`${dateKey(now)}T12:00:00Z`);
  return Array.from({length: 7}, (_, index) =>
    new Date(today + index * 86_400_000).toISOString().slice(0, 10),
  );
}

export function forecastDateLabel(date: string, shouldIncludeYear = true) {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(shouldIncludeYear && {year: 'numeric'}),
  }).format(Date.parse(`${date}T12:00:00Z`));
}

export function mountFutureWeather(root: HTMLElement) {
  const dialog = root.querySelector<HTMLDialogElement>(
    '[data-forecast-dialog]',
  )!;
  const open = root.querySelector<HTMLButtonElement>('[data-forecast-open]')!;
  const close = root.querySelector<HTMLButtonElement>('[data-forecast-close]')!;
  const days = root.querySelector<HTMLElement>('[data-future-days]')!;
  const template = root.querySelector<HTMLTemplateElement>(
    '[data-future-day-template]',
  )!;
  const lifecycle = new AbortController();
  const options = {signal: lifecycle.signal};
  let latest: WeatherState = {failed: false};
  let selected: string | undefined;
  let renderedDay: string | undefined;
  let renderedMinute: number | undefined;
  let renderedWeather: Weather | undefined;
  let signature = '';
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function clearIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = undefined;
  }

  function closeDialog() {
    clearIdleTimer();
    if (dialog.open) {
      dialog.close();
    }
  }

  function resetIdleTimer() {
    if (!dialog.open) {
      return;
    }

    clearIdleTimer();
    idleTimer = setTimeout(closeDialog, 60_000);
  }

  // Real input extends browsing; data refreshes and programmatic focus do not.
  for (const event of ['pointerdown', 'keydown', 'wheel', 'touchmove']) {
    dialog.addEventListener(event, resetIdleTimer, {...options, passive: true});
  }

  function text(selector: string, value: string, parent: ParentNode = dialog) {
    parent.querySelector(selector)!.textContent = value;
  }

  function renderDay(weather: Weather | undefined) {
    const date = selected!;
    for (const button of days.querySelectorAll('button')) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.date === selected),
      );
    }

    const now = Date.now();
    const hours =
      weather?.hourly.filter((hour) => dateKey(hour.time) === date) ?? [];
    const minute = Math.floor(now / 60_000);
    if (
      date === renderedDay &&
      weather === renderedWeather &&
      minute === renderedMinute
    ) {
      return;
    }

    renderedMinute = minute;
    renderFutureChart(dialog, hours, now, date);
    const coverageNote = dialog.querySelector<HTMLElement>(
      '[data-future-chart-note]',
    )!;
    const isPartial =
      hours.length > 0 &&
      (hourLabel(hours[0].time) !== '00:00' ||
        hourLabel(hours.at(-1)!.time) !== '23:00' ||
        hours.some(
          (hour, index) =>
            index > 0 && hour.time - hours[index - 1].time > 3_600_000,
        ));
    coverageNote.hidden = !isPartial;
    coverageNote.textContent =
      hours.length === 1
        ? 'Une seule heure disponible : consultez le détail horaire.'
        : 'Couverture horaire partielle : les périodes manquantes ne sont pas tracées.';
    text(
      '[data-future-summary]',
      hours.length > 0
        ? selectedDaySummary(hours, now, date)
        : 'Prévisions horaires indisponibles pour cette date.',
    );
    if (date === renderedDay && weather === renderedWeather) {
      return;
    }

    if (date !== renderedDay) {
      dialog.querySelector<HTMLDetailsElement>('[data-future-details]')!.open =
        false;
    }

    renderedDay = date;
    renderedWeather = weather;
    text('[data-future-heading]', forecastDateLabel(date));
    text(
      '[data-future-coverage]',
      hours.length > 0
        ? `Heures disponibles : ${hourLabel(hours[0].time)}–${hourLabel(hours.at(-1)!.time)} (${weather!.timezone}). Graphique : probabilités horaires. Cartes : maximum horaire de la journée.`
        : 'Prévisions horaires indisponibles pour cette date.',
    );
    const timeFormatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: weather?.timezone,
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
      hourCycle: 'h23',
    });
    dialog.querySelector('[data-future-hours]')!.replaceChildren(
      ...hours.map((hour) => {
        const row = document.createElement('tr');
        for (const value of [
          timeFormatter.format(hour.time),
          `${Math.round(hour.temperature)}°C`,
          `${hour.probability} %`,
          conditionFor(hour.code, hour.isDay).label,
        ]) {
          const cell = document.createElement('td');
          cell.className = 'p-2';
          cell.textContent = value;
          row.append(cell);
        }

        return row;
      }),
    );
  }

  function render() {
    if (!dialog.open) {
      return;
    }

    const now = Date.now();
    const {weather, failed} = latest;
    const dates = forecastDates(now);
    if (selected === undefined || !dates.includes(selected)) {
      selected = dates[0];
    }

    text(
      '[data-future-status]',
      weather
        ? isWeatherStale(weather, now, failed)
          ? `Prévisions non actualisées. ${staleWeatherLabel(weather, now)}. Nouvelle tentative automatique.`
          : `Prévisions pour ${weather.location}.`
        : failed
          ? 'Prévisions indisponibles. Nouvelle tentative automatique.'
          : 'Chargement des prévisions…',
    );
    const nextSignature = JSON.stringify([dates, weather]);
    if (signature !== nextSignature) {
      signature = nextSignature;
      const focusedDate =
        globalThis.document.activeElement?.closest<HTMLButtonElement>(
          'button[data-date]',
        )?.dataset.date;
      days.replaceChildren(
        ...dates.map((date) => {
          const button = document.importNode(
            template.content.firstElementChild!,
            true,
          ) as HTMLButtonElement;
          button.dataset.date = date;
          const daily = weather?.daily.find((day) => day.date === date);
          const condition = conditionFor(daily?.code, true);
          text('[data-future-date]', forecastDateLabel(date, false), button);
          button.setAttribute(
            'aria-label',
            `${forecastDateLabel(date)}. ${daily ? `${condition.label}, ${Math.round(daily.low)} à ${Math.round(daily.high)} degrés` : 'Prévision indisponible'}. Pluie : ${daily?.probability === undefined ? 'indisponible' : `${daily.probability} %`}.`,
          );
          button
            .querySelector('[data-future-icon]')!
            .classList.add(condition.icon);
          text(
            '[data-future-condition]',
            daily ? condition.label : 'Prévision indisponible',
            button,
          );
          text(
            '[data-future-extremes]',
            daily
              ? `${Math.round(daily.low)}° / ${Math.round(daily.high)}°`
              : '— / —',
            button,
          );
          text(
            '[data-future-rain]',
            daily?.probability === undefined
              ? 'Pluie : —'
              : `Pluie : ${daily.probability} %`,
            button,
          );
          return button;
        }),
      );
      if (focusedDate !== undefined) {
        days
          .querySelector<HTMLButtonElement>(
            `button[data-date="${CSS.escape(focusedDate)}"]`,
          )
          ?.focus();
      }
    }

    renderDay(weather);
  }

  open.addEventListener(
    'click',
    () => {
      selected = undefined;
      signature = '';
      dialog.querySelector<HTMLDetailsElement>('[data-future-details]')!.open =
        false;
      dialog.showModal();
      resetIdleTimer();
      render();
      days.scrollLeft = 0;
      dialog.scrollTop = 0;
    },
    options,
  );
  close.addEventListener(
    'click',
    () => {
      closeDialog();
    },
    options,
  );
  dialog.addEventListener(
    'close',
    () => {
      clearIdleTimer();
      selected = undefined;
      open.focus();
    },
    options,
  );
  days.addEventListener(
    'click',
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        'button[data-date]',
      );
      if (!button) {
        return;
      }

      selected = button.dataset.date;
      button.scrollIntoView({block: 'nearest', inline: 'nearest'});
      renderDay(latest.weather);
    },
    options,
  );
  return {
    update(state: WeatherState) {
      latest = state;
      render();
    },
    close: closeDialog,
    dispose() {
      closeDialog();
      lifecycle.abort();
    },
  };
}
