import {dateKey, hourLabel, type Hour} from './adapter.ts';
import {chartGeometry} from './chart.ts';

const svgNamespace = 'http://www.w3.org/2000/svg';

export function renderFutureChart(
  root: HTMLElement,
  hours: Hour[],
  now: number,
  date: string,
) {
  const chart = root.querySelector<HTMLElement>('[data-future-chart]')!;
  const geometry = chartGeometry(hours);
  chart.hidden = !geometry;
  if (!geometry) {
    return;
  }

  const {x, y, low, high, path} = geometry;
  for (const curve of chart.querySelectorAll('[data-future-chart-curve]')) {
    curve.setAttribute('d', path);
  }

  chart.querySelector('[data-future-chart-rain]')!.replaceChildren(
    ...hours.map((hour) => {
      // Each bar is one provider hour; cap the edge bars at the plot boundary.
      const start = Math.max(0, x(hour.time - 1_800_000));
      const end = Math.min(600, x(hour.time + 1_800_000));
      const bar = document.createElementNS(svgNamespace, 'rect');
      for (const [name, value] of Object.entries({
        x: start + 1,
        y: 100 - hour.probability * 0.8,
        width: Math.max(0, end - start - 2),
        height: hour.probability * 0.8,
        rx: 2,
      })) {
        bar.setAttribute(name, String(value));
      }

      bar.setAttribute('fill', 'var(--colors-rain)');
      bar.setAttribute('fill-opacity', '0.65');
      const title = document.createElementNS(svgNamespace, 'title');
      title.textContent = `${hourLabel(hour.time)} : ${Math.round(hour.temperature)}°C, pluie ${hour.probability} %`;
      bar.append(title);
      return bar;
    }),
  );
  chart.querySelector('[data-future-temperature-scale]')!.replaceChildren(
    ...[Math.floor(low - 3), Math.ceil(high + 3)].map((value) => {
      const label = document.createElement('span');
      label.className = 'absolute right-0 -translate-y-1/2';
      label.style.top = `${y(value)}%`;
      label.textContent = `${value}°`;
      return label;
    }),
  );
  chart.querySelector('[data-future-chart-times]')!.replaceChildren(
    ...hours
      .filter(
        (hour, index) =>
          index === 0 ||
          index === hours.length - 1 ||
          (Number(hourLabel(hour.time).slice(0, 2)) % 6 === 0 &&
            index < hours.length - 2 &&
            index > 1),
      )
      .map((hour) => {
        const label = document.createElement('span');
        label.className = 'absolute -translate-x-1/2';
        label.style.left = `${x(hour.time) / 6}%`;
        label.textContent = hourLabel(hour.time).replace(':00', 'h');
        return label;
      }),
  );
  const marker = x(now);
  const isToday = date === dateKey(now);
  const isVisible = isToday && marker >= 0 && marker <= 600;
  const line = chart.querySelector<SVGElement>('[data-future-chart-now]')!;
  line.style.display = isVisible ? '' : 'none';
  line.setAttribute('x1', String(marker));
  line.setAttribute('x2', String(marker));
  const label = chart.querySelector<HTMLElement>(
    '[data-future-chart-now-label]',
  )!;
  label.hidden = !isVisible;
  label.style.left = `clamp(0%, ${marker / 6}%, 65%)`;
  const pastWidth = isToday ? Math.max(0, Math.min(600, marker)) : 0;
  chart
    .querySelector('[data-future-chart-past]')!
    .setAttribute('width', String(pastWidth));
}
