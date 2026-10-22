import {hourLabel, type Hour} from './adapter.ts';
import {chartGeometry} from './chart.ts';
import {conditionFor} from './conditions.ts';
import {type checkpointForecasts} from './morning.ts';

const rounded = (value: number) => `${Math.round(value)}°`;

function cloneTemplate<T extends Element>(root: ParentNode, selector: string) {
  const template = root.querySelector<HTMLTemplateElement>(selector)!;
  return document.importNode(template.content.firstElementChild!, true) as T;
}

export function renderCheckpoints(
  root: HTMLElement,
  forecasts: ReturnType<typeof checkpointForecasts>,
) {
  root.querySelector('[data-checkpoints]')!.replaceChildren(
    ...forecasts.map((point) => {
      const card = cloneTemplate<HTMLElement>(
        root,
        '[data-checkpoint-template]',
      );
      const hour = point.forecast;
      const condition = conditionFor(hour?.code, hour?.isDay ?? true);
      card.setAttribute('aria-label', `${point.time} ${point.label}`);
      card.querySelector('[data-point-time]')!.textContent = point.time.replace(
        ':',
        'h',
      );
      const label = card.querySelector<HTMLElement>('[data-point-label]')!;
      label.textContent = point.label;
      label.title = point.label;
      card.querySelector('[data-point-icon]')!.classList.add(condition.icon);
      card.querySelector('[data-point-temperature]')!.textContent = hour
        ? rounded(hour.temperature)
        : '—°';
      const rain = card.querySelector('[data-point-rain]')!;
      rain.textContent = `Pluie ${hour ? `${hour.probability} %` : '—'}`;
      rain.setAttribute(
        'aria-label',
        hour
          ? `Pluie : maximum horaire ${hour.probability} % ; source ${point.probabilityPeriod}`
          : 'Prévision indisponible',
      );
      card.querySelector('[data-point-condition]')!.textContent = hour
        ? condition.label
        : 'Prévision indisponible';
      return card;
    }),
  );
}

export function renderChart(root: HTMLElement, hours: Hour[]) {
  const chart = root.querySelector<HTMLElement>('[data-chart]')!;
  const content = chart.querySelector<HTMLElement>('[data-chart-content]')!;
  const empty = chart.querySelector<HTMLElement>('[data-chart-empty]')!;
  const geometry = chartGeometry(hours);
  content.hidden = !geometry;
  empty.hidden = Boolean(geometry);
  if (!geometry) {
    empty.textContent = 'Prévisions de la journée indisponibles.';
    return;
  }

  const {low, high, x, path, rain, peak} = geometry;
  chart.querySelector('[data-chart-range]')!.textContent =
    `Température · ${rounded(low)} à ${rounded(high)}C`;
  for (const curve of chart.querySelectorAll('[data-chart-curve]')) {
    curve.setAttribute('d', path);
  }

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
    peakLabel.style.top = `${80 - peak.probability * 0.8}px`;
  }

  chart.querySelector<HTMLElement>(
    '[data-weather-now-label]',
  )!.dataset.rainPeakHigh = String(Boolean(peak && peak.probability >= 75));
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
