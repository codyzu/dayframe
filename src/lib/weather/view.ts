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
    42 + ((time - hours[0].time) / (hours.at(-1)!.time - hours[0].time)) * 470;
  const y = (temperature: number) =>
    150 - ((temperature - low) / (high - low)) * 108;
  const marker = Math.max(42, Math.min(512, x(now)));
  const points = hours
    .map((hour) => `${x(hour.time)},${y(hour.temperature)}`)
    .join(' ');
  // All interpolated values are validated numbers or locally generated labels/classes.
  return `<div class="w-full py-3">
    <svg class="block w-full" viewBox="0 0 558 230" role="img" aria-labelledby="chart-title chart-description">
      <title id="chart-title">Température et probabilité de précipitations</title>
      <desc id="chart-description">Courbe jaune : température en degrés Celsius, axe gauche. Barres bleues : probabilité de précipitations en pour cent, axe droit. Trait pointillé : maintenant. Tableau détaillé disponible après le graphique.</desc>
      ${[0, 0.5, 1].map((fraction) => `<line x1="42" x2="512" y1="${150 - fraction * 108}" y2="${150 - fraction * 108}" stroke="#ffffff" stroke-opacity="0.18"/><text x="32" y="${155 - fraction * 108}" text-anchor="end" fill="#f5d294" font-size="14">${Math.round(low + fraction * (high - low))}°</text><text x="524" y="${155 - fraction * 108}" fill="#b5dfed" font-size="14">${fraction * 100}%</text>`).join('')}
      ${hours.map((hour) => `<rect x="${x(hour.time) - 7}" y="${150 - hour.probability * 1.08}" width="14" height="${hour.probability * 1.08}" rx="3" fill="#88cbe4" fill-opacity="0.65"/>`).join('')}
      <polyline points="${points}" fill="none" stroke="#f5d294" stroke-width="3" stroke-linejoin="round"/>
      ${hours.map((hour, index) => (index % 2 === 0 ? `<circle cx="${x(hour.time)}" cy="${y(hour.temperature)}" r="4" fill="#f5d294"/><text x="${x(hour.time)}" y="${y(hour.temperature) - 12}" text-anchor="middle" fill="#fff0cd" font-size="16">${rounded(hour.temperature)}</text><text x="${x(hour.time)}" y="177" text-anchor="middle" fill="#d5e0df" font-size="15">${hourLabel(hour.time)}</text>` : '')).join('')}
      <line x1="${marker}" x2="${marker}" y1="26" y2="155" stroke="white" stroke-dasharray="4 4"/><text x="${marker}" y="17" text-anchor="middle" fill="white" font-size="13">Maintenant</text>
      <line x1="44" x2="66" y1="210" y2="210" stroke="#f5d294" stroke-width="3"/><text x="74" y="215" fill="#f5d294" font-size="14">Température °C</text>
      <rect x="260" y="203" width="12" height="12" rx="2" fill="#88cbe4"/><text x="280" y="215" fill="#b5dfed" font-size="14">Précipitations %</text>
    </svg>
    <div class="grid grid-cols-6 gap-1" aria-hidden="true">${hours
      .filter((_, index) => index % 2 === 0)
      .map(
        (hour) =>
          `<span class="flex justify-center"><span class="${conditionFor(hour.code, hour.isDay).icon} inline-block size-9"></span></span>`,
      )
      .join('')}</div>
    <div class="sr-only"><table><caption>Prévisions horaires, heure de Paris</caption><thead><tr><th>Heure</th><th>Température</th><th>Précipitations</th><th>Conditions</th></tr></thead><tbody>${hours.map((hour) => `<tr><th>${hourLabel(hour.time)}</th><td>${rounded(hour.temperature)}C</td><td>${hour.probability} %</td><td>${conditionFor(hour.code, hour.isDay).label}</td></tr>`).join('')}</tbody></table></div>
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
      iconElement.className = `weather-icon ${icon} inline-block size-[116px]`;
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
