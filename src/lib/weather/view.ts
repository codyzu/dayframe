// @unocss-include
import {dateKey, hourLabel, staleAfter, type Weather} from './adapter.ts';
import {conditionFor} from './conditions.ts';
import {forecastHours, summarize} from './summary.ts';
import {
  createWeatherService,
  type WeatherCache,
  type WeatherState,
} from './service.ts';

const rounded = (value: number) => `${Math.round(value)}°`;

function chart(weather: Weather, now: number) {
  const hours = forecastHours(weather, now);
  if (hours.length < 2) {
    return '<p class="py-10 text-mist">Prévisions à venir indisponibles.</p>';
  }

  const low = Math.floor(
    Math.min(...hours.map((hour) => hour.temperature)) - 2,
  );
  const high = Math.ceil(
    Math.max(...hours.map((hour) => hour.temperature)) + 2,
  );
  const x = (time: number) =>
    ((time - hours[0].time) / (hours.at(-1)!.time - hours[0].time)) * 100;
  const y = (temperature: number) =>
    100 - ((temperature - low) / (high - low)) * 100;
  const marker = Math.max(0, Math.min(100, x(now)));
  const points = hours
    .map((hour) => `${x(hour.time) * 6},${y(hour.temperature) * 1.6}`)
    .join(' ');
  // HTML labels stay in rem at every viewport; only the numeric plot stretches.
  // Both axes share the exact same plot bounds, rain always uses 0–100%.
  return `<div class="weather-chart w-full py-3">
    <div class="flex flex-wrap justify-between gap-2 text-[length:var(--font-chart-time)] mb-8">
      <span class="text-[#fff0cd]">Température °C</span>
      <span class="text-[#b5dfed]">Pluie · probabilité 0–100 %</span>
    </div>
    <div class="mx-7 relative">
      <div class="relative h-[160px] mb-2" data-chart-plot>
        <svg class="absolute inset-0 size-full overflow-visible" viewBox="0 0 600 160" preserveAspectRatio="none" role="img" aria-labelledby="chart-title chart-description">
          <title id="chart-title">Température et probabilité de précipitations</title>
          <desc id="chart-description">Courbe jaune : température en degrés Celsius, valeurs sur la courbe. Barres bleues : probabilité de précipitations de 0 % en bas à 100 % en haut. Trait pointillé : maintenant. Tableau détaillé disponible après le graphique.</desc>
          ${[0, 0.5, 1].map((fraction) => `<line x1="0" x2="600" y1="${fraction * 160}" y2="${fraction * 160}" stroke="#ffffff" stroke-opacity="0.18"/>`).join('')}
          ${hours.map((hour) => `<rect x="${x(hour.time) * 6 - 6}" y="${160 - hour.probability * 1.6}" width="12" height="${hour.probability * 1.6}" rx="3" fill="#88cbe4" fill-opacity="0.8"/>`).join('')}
          <polyline points="${points}" fill="none" stroke="#f5d294" stroke-width="4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          ${hours.map((hour) => `<ellipse cx="${x(hour.time) * 6}" cy="${y(hour.temperature) * 1.6}" rx="4" ry="4" fill="#fff0cd"/>`).join('')}
          <line x1="${marker * 6}" x2="${marker * 6}" y1="-12" y2="160" stroke="white" stroke-width="2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke"/>
        </svg>
        <span class="absolute -top-7 text-[length:var(--font-chart-time)] font-semibold" style="left:clamp(0%, ${marker}%, 65%)">Maintenant</span>
        ${hours
          .filter((_, index) => index % 2 === 0)
          .map(
            (hour) =>
              `<span class="absolute text-[length:var(--font-chart-label)] font-semibold text-[#fff0cd] bg-[#102a34] rounded px-0.5 leading-none" style="left:${x(hour.time)}%;top:${y(hour.temperature)}%;transform:translate(-50%,-130%)">${rounded(hour.temperature)}</span>`,
          )
          .join('')}
      </div>
      <div class="relative h-[calc(var(--icon-weather-hourly)+2rem)]" aria-hidden="true">${hours
        .filter((_, index) => index % 2 === 0)
        .map(
          (hour) =>
            `<span class="absolute flex flex-col items-center -translate-x-1/2 text-[length:var(--font-chart-time)] text-mist" style="left:${x(hour.time)}%">${hourLabel(hour.time).replace(':00', 'h')}<span class="${conditionFor(hour.code, hour.isDay).icon} inline-block size-[var(--icon-weather-hourly)] shrink-0"></span></span>`,
        )
        .join('')}</div>
    </div>
    <div class="sr-only"><table><caption>Prévisions horaires, heure locale</caption><thead><tr><th>Heure</th><th>Température</th><th>Précipitations</th><th>Conditions</th></tr></thead><tbody>${hours.map((hour) => `<tr><th>${hourLabel(hour.time)}</th><td>${rounded(hour.temperature)}C</td><td>${hour.probability} %</td><td>${conditionFor(hour.code, hour.isDay).label}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

export function mountWeather(root: HTMLElement) {
  function text(selector: string, value: string) {
    const element = root.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function render({weather, failed}: WeatherState) {
    if (!weather) {
      if (failed) {
        text('[data-condition]', 'Météo indisponible');
        text('[data-rain]', 'Connexion météo interrompue.');
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

    const now = Date.now();
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
      iconElement.className = `weather-icon ${icon} inline-block size-[var(--icon-weather-current)] shrink-0`;
    }

    const daily = weather.daily.find((entry) => entry.date === dateKey(now));
    text(
      '[data-extremes]',
      `Ressenti ${rounded(weather.current.feelsLike)} · ${daily ? `Max. ${rounded(daily.high)} / Min. ${rounded(daily.low)}` : 'Max. / Min. du jour indisponibles'}`,
    );
    const summary = summarize(weather, now);
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
        : summary.outlook,
    );
    text(
      '[data-weather-status]',
      `${isStale ? 'Données anciennes' : 'Mise à jour'} · il y a ${age} min${failed ? ' · connexion interrompue, nouvelle tentative automatique' : ''}`,
    );
    const container = root.querySelector('[data-chart]');
    if (container) {
      container.innerHTML = chart(weather, now);
    }
  }

  let storage: WeatherCache | undefined;
  try {
    storage = localStorage;
  } catch {
    /*
    Private browsing may deny storage access.
    */
  }

  const service = createWeatherService(render, storage);
  service.start();
  globalThis.addEventListener('pagehide', () => {
    service.stop();
  });
  globalThis.addEventListener('pageshow', () => {
    service.start();
    service.wake();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      service.wake();
    }
  });
  globalThis.addEventListener('online', () => {
    service.wake();
  });
}
