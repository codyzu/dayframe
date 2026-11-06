import {dateKey, type Weather} from './adapter.ts';
import {conditionFor} from './conditions.ts';
import {type WeatherState} from './service.ts';
import {trendGeometry, precipitationLabel} from './trend.ts';

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
  const buttons = days.querySelector<HTMLElement>('[data-future-buttons]')!;
  const plot = days.querySelector<SVGSVGElement>('[data-future-trend]')!;
  const strip = days.querySelector<HTMLElement>('.trend-strip')!;
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

  let dates: string[] = [];
  function draw() {
    const {width} = strip.getBoundingClientRect();
    if (width === 0 || dates.length === 0) {
      return;
    }

    const geometry = trendGeometry(dates, renderedWeather?.daily ?? [], width);
    plot.setAttribute('viewBox', `0 0 ${width} 58`);
    const svg = (name: string, attributes: Record<string, string | number>) => {
      const element = document.createElementNS(
        'http://www.w3.org/2000/svg',
        name,
      );
      for (const [attribute, value] of Object.entries(attributes)) {
        element.setAttribute(attribute, String(value));
      }

      return element;
    };

    const curve = svg('path', {
      d: geometry.path,
      fill: 'none',
      stroke: 'var(--colors-temperature)',
      'stroke-width': 2,
      'stroke-linejoin': 'round',
    });
    const groups = geometry.points.map((point) => {
      const group = svg('g', {
        'data-trend-date': point.date,
        'data-selected': String(point.date === (selected ?? today)),
      });
      if (point.day?.precipitation !== undefined) {
        group.append(
          svg('rect', {
            x: point.rainX - 8,
            y: point.rainY,
            width: 16,
            height: point.rainHeight,
            rx: 2,
            fill: 'var(--colors-rain)',
            opacity: 0.6,
          }),
        );
      }

      if (point.day) {
        group.append(
          svg('circle', {
            cx: point.x,
            cy: point.y,
            r: 3,
            fill: 'var(--colors-temperature)',
          }),
        );
      }

      const temperature = svg('text', {
        x: point.x,
        y: point.y - 8,
        'text-anchor': 'middle',
        fill: 'var(--colors-temperature)',
      });
      temperature.textContent = point.day
        ? `${Math.round(point.day.high)}°`
        : '—°';
      const amount = svg('text', {
        'data-amount': '',
        x: point.rainX,
        y: point.rainY - 5,
        'text-anchor': 'middle',
        fill: 'var(--colors-rain)',
      });
      amount.textContent = `${precipitationLabel(point.day?.precipitation)} mm`;
      group.append(temperature, amount);
      return group;
    });
    // Curve behind the labelled marks so crossing lines cannot strike through values.
    plot.replaceChildren(curve, ...groups);
  }

  const observer = new ResizeObserver(draw);
  observer.observe(strip);

  return {
    update({weather}: WeatherState, now: number) {
      today = dateKey(now);
      dates = forecastDates(now);
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
        if (buttons.childElementCount === 0) {
          buttons.append(
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
            `${forecastDateLabel(date)}. ${daily ? `${condition.label}, maximum ${Math.round(daily.high)}, minimum ${Math.round(daily.low)} degrés` : 'Prévision indisponible'}. Précipitations : ${daily?.precipitation === undefined ? 'indisponibles' : `${precipitationLabel(daily.precipitation)} millimètres`}.`,
          );
          text(
            '[data-future-condition]',
            daily ? condition.label : 'Prévision indisponible',
          );
        }

        draw();
      }

      const date = selected ?? today;
      for (const button of days.querySelectorAll('button')) {
        button.setAttribute(
          'aria-pressed',
          String(button.dataset.forecastDay === date),
        );
      }

      for (const group of plot.querySelectorAll<SVGElement>(
        '[data-trend-date]',
      )) {
        group.dataset.selected = String(group.dataset.trendDate === date);
      }

      return date;
    },
    reset,
    dispose() {
      clearTimeout(idleTimer);
      lifecycle.abort();
      observer.disconnect();
    },
  };
}
