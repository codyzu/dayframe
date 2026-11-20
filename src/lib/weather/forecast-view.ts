import {hourLabel, type Daylight, type Hour} from './adapter.ts';
import {chartGeometry} from './chart.ts';
import {conditionFor} from './conditions.ts';

const rounded = (value: number) => `${Math.round(value)}°`;

function cloneTemplate<T extends Element>(root: ParentNode, selector: string) {
  const template = root.querySelector<HTMLTemplateElement>(selector)!;
  return document.importNode(template.content.firstElementChild!, true) as T;
}

function renderDaylight(
  chart: HTMLElement,
  x: (time: number) => number,
  daylight?: Daylight,
) {
  chart.querySelector<HTMLUListElement>('[data-chart-daylight]')!.hidden =
    daylight === undefined;
  for (const key of ['sunrise', 'sunset'] as const) {
    const entry = chart.querySelector<HTMLLIElement>(
      `[data-daylight-entry="${CSS.escape(key)}"]`,
    )!;
    const marker = chart.querySelector<SVGLineElement>(
      `[data-daylight-marker="${CSS.escape(key)}"]`,
    )!;
    const instant = daylight?.[key];
    entry.hidden = instant === undefined;
    const position = instant === undefined ? -1 : x(instant);
    marker.style.display = position >= 0 && position <= 600 ? '' : 'none';
    if (instant === undefined) {
      continue;
    }

    const time = entry.querySelector('time')!;
    time.dateTime = new Date(instant).toISOString();
    time.textContent = hourLabel(instant);
    marker.setAttribute('x1', String(position));
    marker.setAttribute('x2', String(position));
  }
}

export function renderChart(
  root: HTMLElement,
  hours: Hour[],
  daylight?: Daylight,
) {
  const chart = root.querySelector<HTMLElement>('[data-chart]')!;
  const content = chart.querySelector<HTMLElement>('[data-chart-content]')!;
  const empty = chart.querySelector<HTMLElement>('[data-chart-empty]')!;
  const geometry = chartGeometry(hours);
  content.hidden = !geometry;
  empty.hidden = Boolean(geometry);
  if (!geometry) {
    empty.textContent = 'Prévisions de la journée indisponibles.';
    chart.querySelector('[data-chart-hours]')!.replaceChildren();
    chart.querySelector('[data-chart-rain]')!.replaceChildren();
    return;
  }

  const {low, high, x, path, rain, peak} = geometry;
  renderDaylight(chart, x, daylight);
  chart.querySelector('[data-chart-range]')!.textContent =
    `${rounded(low)} à ${rounded(high)}C`;
  chart.querySelector('[data-chart-curve]')!.setAttribute('d', path);

  chart.querySelector('[data-chart-rain]')!.replaceChildren(
    ...rain.map((bar) => {
      const svg = cloneTemplate<SVGSVGElement>(
        chart,
        '[data-rain-bar-template]',
      );
      const rectangle = svg.firstElementChild!;
      for (const attribute of ['x', 'y', 'width', 'height'] as const) {
        rectangle.setAttribute(attribute, String(bar[attribute]));
      }

      rectangle.querySelector('title')!.textContent =
        `${hourLabel(bar.start)}–${hourLabel(bar.end)} : maximum horaire ${bar.probability} %`;
      return rectangle;
    }),
  );
  const peakLabel = chart.querySelector<HTMLElement>('[data-rain-peak]')!;
  peakLabel.hidden = !peak;
  if (peak) {
    peakLabel.textContent = `${peak.probability} %`;
    peakLabel.setAttribute(
      'aria-label',
      `${hourLabel(peak.start)}–${hourLabel(peak.end)} : maximum horaire ${peak.probability} %`,
    );
    peakLabel.style.left = `clamp(2rem, ${x((peak.start + peak.end) / 2) / 6}%, calc(100% - 2rem))`;
    peakLabel.style.bottom = `calc(var(--rain-height) * ${peak.probability / 100})`;
  }

  chart.querySelector('[data-chart-times]')!.replaceChildren(
    ...hours
      .filter((hour) => Number(hourLabel(hour.time).slice(0, 2)) % 2 === 0)
      .map((hour) => {
        const label = cloneTemplate<HTMLElement>(
          chart,
          '[data-chart-time-template]',
        );
        const time = hourLabel(hour.time);
        label.textContent = time.replace(':00', 'h');
        label.style.left = `${x(hour.time) / 6}%`;
        label.dataset.minor = String((Number(time.slice(0, 2)) - 6) % 4 !== 0);
        return label;
      }),
  );
  chart.querySelector('[data-chart-hours]')!.replaceChildren(
    ...hours.map((hour) => {
      const row = cloneTemplate<HTMLTableRowElement>(
        chart,
        '[data-chart-hour-template]',
      );
      row.querySelector('[data-hour-time]')!.textContent = hourLabel(hour.time);
      row.querySelector('[data-hour-temperature]')!.textContent =
        `${rounded(hour.temperature)}C`;
      row.querySelector('[data-hour-rain]')!.textContent =
        `${hour.probability} %`;
      row.querySelector('[data-hour-condition]')!.textContent = conditionFor(
        hour.code,
        hour.isDay,
      ).label;
      return row;
    }),
  );
}
