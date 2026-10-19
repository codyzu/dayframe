// @unocss-include
import {dateKey, hourLabel, staleAfter, type Weather} from './adapter.ts';
import {conditionFor} from './conditions.ts';
import {summarize} from './summary.ts';
import {
  checkpointForecasts,
  dayHours,
  isWeekend,
  morningAdvice,
  twoHourRain,
} from './morning.ts';
import {
  createWeatherService,
  type WeatherCache,
  type WeatherState,
} from './service.ts';

const rounded = (value: number) => `${Math.round(value)}°`;

function chart(weather: Weather, now: number) {
  const hours = dayHours(weather, now);
  if (hours.length < 2) {
    return '<p class="py-5 text-secondary">Prévisions de la journée indisponibles.</p>';
  }

  const low = Math.min(...hours.map((hour) => hour.temperature)) - 3;
  const high = Math.max(...hours.map((hour) => hour.temperature)) + 3;
  const x = (time: number) =>
    ((time - hours[0].time) / (hours.at(-1)!.time - hours[0].time)) * 600;
  const y = (temperature: number) =>
    90 - ((temperature - low) / (high - low)) * 80;
  // Horizontal cubic handles give a smooth bounded curve, without overshoot.
  let path = `M${x(hours[0].time)},${y(hours[0].temperature)}`;
  for (let index = 1; index < hours.length; index++) {
    const before = hours[index - 1];
    const hour = hours[index];
    const middle = (x(before.time) + x(hour.time)) / 2;
    path += ` C${middle},${y(before.temperature)} ${middle},${y(hour.temperature)} ${x(hour.time)},${y(hour.temperature)}`;
  }

  const marker = x(now);
  const rain = twoHourRain(hours);
  return `<div class="weather-chart w-full">
    <div class="flex justify-between gap-2 text-sm text-secondary mb-1">
      <span class="font-semibold text-temperature">Température · ${rounded(low + 3)} à ${rounded(high - 3)}C</span>
      <span class="text-rain">Pluie · max. horaire / 2 h</span>
    </div>
    <div class="mx-3 relative">
      <div class="relative h-[100px]" data-chart-plot>
        <svg class="absolute inset-0 size-full overflow-visible" viewBox="0 0 600 100" preserveAspectRatio="none" role="img" aria-labelledby="chart-title chart-description">
          <title id="chart-title">Température et probabilité de précipitations</title>
          <desc id="chart-description">Courbe cuivre : température en degrés Celsius. Barres bleues : maximum des probabilités horaires de chaque tranche de deux heures, de 0 à 100 %, et non probabilité sur toute la tranche. Trait pointillé : maintenant, si dans la période. Tableau horaire détaillé disponible après le graphique.</desc>
          <line x1="0" x2="600" y1="100" y2="100" stroke="var(--colors-border)" stroke-width="2"/>
          ${rain.map((bar) => `<rect x="${x(bar.start) + 4}" y="${100 - bar.probability}" width="${Math.max(1, x(bar.end) - x(bar.start) - 8)}" height="${bar.probability}" rx="4" fill="var(--colors-rain)" fill-opacity="0.85"><title>${hourLabel(bar.start)}–${hourLabel(bar.end)} : maximum horaire ${bar.probability} %</title></rect>`).join('')}
          <path d="${path}" fill="none" stroke="var(--colors-surface)" stroke-width="8" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          <path d="${path}" fill="none" stroke="var(--colors-temperature)" stroke-width="4" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
          ${marker >= 0 && marker <= 600 ? `<line x1="${marker}" x2="${marker}" y1="0" y2="100" stroke="var(--colors-primary)" stroke-width="2" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/>` : ''}
        </svg>
        ${marker >= 0 && marker <= 600 ? `<span class="absolute top-0 text-sm bg-surface px-1 font-semibold" style="left:clamp(0%, ${marker / 6}%, 75%)">Maintenant</span>` : ''}
      </div>
      <div class="relative h-6 mt-1" aria-hidden="true">${hours
        .filter((hour) => Number(hourLabel(hour.time).slice(0, 2)) % 2 === 0)
        .map(
          (hour) =>
            `<span class="${(Number(hourLabel(hour.time).slice(0, 2)) - 6) % 4 === 0 ? '' : 'hidden sm:block'} absolute -translate-x-1/2 text-[length:var(--font-chart-time)] text-secondary" style="left:${x(hour.time) / 6}%">${hourLabel(hour.time).replace(':00', 'h')}</span>`,
        )
        .join('')}</div>
    </div>
    <div class="sr-only"><table><caption>Prévisions horaires, heure locale</caption><thead><tr><th>Heure</th><th>Température</th><th>Précipitations</th><th>Conditions</th></tr></thead><tbody>${hours.map((hour) => `<tr><th>${hourLabel(hour.time)}</th><td>${rounded(hour.temperature)}C</td><td>${hour.probability} %</td><td>${conditionFor(hour.code, hour.isDay).label}</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}

function checkpoints(weather: Weather, now: number) {
  return checkpointForecasts(weather, now)
    .map((point) => {
      const hour = point.forecast;
      const condition = conditionFor(hour?.code, hour?.isDay ?? true);
      return `<article class="rounded-2xl bg-background px-2 py-1 text-center" aria-label="${point.time} ${point.label}">
      <h3 class="text-[length:var(--font-checkpoint)] font-bold tabular-nums leading-tight">${point.time.replace(':', 'h')}</h3>
      <p class="text-[length:var(--font-weather-detail)] leading-tight text-secondary">${point.label}</p>
      <div class="flex items-center justify-center gap-1"><span class="${condition.icon} inline-block size-12 shrink-0" aria-hidden="true"></span>
      <p class="text-[length:var(--font-checkpoint)] font-bold leading-tight">${hour ? rounded(hour.temperature) : '—°'}</p></div>
      <p class="text-[length:var(--font-weather-detail)] leading-tight font-semibold text-rain" aria-label="${hour ? `Pluie : maximum horaire ${hour.probability} % ; source ${point.probabilityPeriod}` : 'Prévision indisponible'}">Pluie ${hour ? `${hour.probability} %` : '—'}</p>
      <span class="sr-only">${hour ? condition.label : 'Prévision indisponible'}</span>
    </article>`;
    })
    .join('');
}

export function mountWeather(root: HTMLElement) {
  function text(selector: string, value: string) {
    const element = root.querySelector(selector);
    if (element) {
      element.textContent = value;
    }
  }

  function render({weather, failed}: WeatherState) {
    root.dataset.failed = String(failed);
    if (!weather) {
      if (failed) {
        text('[data-condition]', 'Météo indisponible');
        text('[data-rain]', 'Connexion météo interrompue.');
        text('[data-advice]', 'Consultez la météo avant de partir.');
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
      iconElement.className = `weather-icon ${icon} inline-block size-[var(--icon-weather-current)] shrink-0 rounded-3xl bg-elevated`;
    }

    const daily = weather.daily.find((entry) => entry.date === dateKey(now));
    text(
      '[data-extremes]',
      `Ressenti ${rounded(weather.current.feelsLike)} · ${daily ? `Max. ${rounded(daily.high)} / Min. ${rounded(daily.low)}` : 'Max. / Min. du jour indisponibles'}`,
    );
    const summary = summarize(weather, now);
    const advice = morningAdvice(weather, now);
    text(
      '[data-advice]',
      isStale ? 'Vérifiez la météo avant de partir.' : advice.title,
    );
    text(
      '[data-checkpoint-heading]',
      isWeekend(now)
        ? 'Les repères du week-end'
        : 'Les repères · jour d’école habituel',
    );
    const checkpointContainer = root.querySelector('[data-checkpoints]');
    if (checkpointContainer) {
      checkpointContainer.innerHTML = checkpoints(weather, now);
    }

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
        : advice.detail,
    );
    text(
      '[data-weather-status]',
      `${isStale ? 'Données anciennes' : 'Mise à jour'} · il y a ${age} min${failed ? ' · connexion interrompue, nouvelle tentative automatique' : ''}`,
    );
    const status = root.querySelector<HTMLElement>('[data-weather-status]');
    if (status) {
      status.hidden = !isStale;
    }

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
    wake() {
      service.wake();
    },
    dispose() {
      lifecycle.abort();
      service.stop();
    },
  };
}
