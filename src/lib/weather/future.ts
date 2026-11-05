import {dateKey, type Weather} from './adapter.ts';
import {conditionFor} from './conditions.ts';
import {type WeatherState} from './service.ts';

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

// Calendar selection is transient and uses the weather location's date.
export function mountFutureWeather(root: HTMLElement, onSelect: () => void) {
  const days = root.querySelector<HTMLElement>('[data-future-days]')!;
  const template = root.querySelector<HTMLTemplateElement>(
    '[data-future-day-template]',
  )!;
  const lifecycle = new AbortController();
  const options = {signal: lifecycle.signal};
  let selected: string | undefined;
  let today = '';
  let renderedWeather: Weather | undefined;
  let renderedToday = '';
  let idleTimer: ReturnType<typeof setTimeout> | undefined;

  function reset() {
    clearTimeout(idleTimer);
    idleTimer = undefined;
    if (selected === undefined) {
      return;
    }

    selected = undefined;
    onSelect();
  }

  function extend() {
    clearTimeout(idleTimer);
    if (selected !== undefined) {
      idleTimer = setTimeout(reset, 60_000);
    }
  }

  for (const event of ['pointerdown', 'keydown', 'wheel', 'touchmove']) {
    root.addEventListener(event, extend, {...options, passive: true});
  }

  days.addEventListener(
    'click',
    (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        'button[data-forecast-day]',
      );
      if (!button) {
        return;
      }

      selected =
        button.dataset.forecastDay === today
          ? undefined
          : button.dataset.forecastDay;
      extend();
      onSelect();
    },
    options,
  );
  root.addEventListener(
    'keydown',
    (event) => {
      if (selected !== undefined && event.key === 'Escape') {
        reset();
      }
    },
    options,
  );

  return {
    update({weather}: WeatherState, now: number) {
      today = dateKey(now);
      const dates = forecastDates(now);
      if (
        today !== renderedToday ||
        (selected !== undefined && !dates.includes(selected))
      ) {
        selected = undefined;
        clearTimeout(idleTimer);
      }

      if (weather !== renderedWeather || today !== renderedToday) {
        renderedWeather = weather;
        renderedToday = today;
        // Reuse controls on refresh so keyboard focus and strip scroll survive.
        if (days.childElementCount === 0) {
          days.append(
            ...dates.map(() =>
              document.importNode(template.content.firstElementChild!, true),
            ),
          );
        }

        for (const [index, button] of [
          ...days.querySelectorAll<HTMLButtonElement>('button'),
        ].entries()) {
          const date = dates[index];
          button.dataset.forecastDay = date;
          const daily = weather?.daily.find((day) => day.date === date);
          const condition = conditionFor(daily?.code, true);
          const text = (selector: string, value: string) => {
            button.querySelector(selector)!.textContent = value;
          };

          text(
            '[data-future-date]',
            index === 0
              ? 'Aujourd’hui'
              : index === 1
                ? 'Demain'
                : forecastDateLabel(date, false),
          );
          button.setAttribute(
            'aria-label',
            `${forecastDateLabel(date)}. ${daily ? `${condition.label}, maximum ${Math.round(daily.high)}, minimum ${Math.round(daily.low)} degrés` : 'Prévision indisponible'}. Pluie : ${daily?.probability === undefined ? 'indisponible' : `${daily.probability} %`}.`,
          );
          const icon = button.querySelector<HTMLElement>('[data-future-icon]')!;
          for (const name of icon.classList) {
            if (name.startsWith('i-meteocons-')) {
              icon.classList.remove(name);
            }
          }

          icon.classList.add(condition.icon);
          text(
            '[data-future-condition]',
            daily ? condition.label : 'Prévision indisponible',
          );
          text(
            '[data-future-extremes]',
            daily
              ? `Max ${Math.round(daily.high)}° · Min ${Math.round(daily.low)}°`
              : 'Max — · Min —',
          );
          text(
            '[data-future-rain]',
            daily?.probability === undefined
              ? 'Pluie —'
              : `Pluie ${daily.probability} %`,
          );
        }
      }

      const date = selected ?? today;
      for (const button of days.querySelectorAll('button')) {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.forecastDay === date),
        );
      }

      return date;
    },
    reset,
    dispose() {
      clearTimeout(idleTimer);
      lifecycle.abort();
    },
  };
}
