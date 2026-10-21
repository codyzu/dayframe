// @unocss-include
import {staleAfter} from '../weather/adapter.ts';
import {conditionFor} from '../weather/conditions.ts';
import {type WeatherState} from '../weather/service.ts';

export function mountPhotoWeather(root: HTMLElement) {
  const temperature = root.querySelector<HTMLElement>(
    '[data-photo-temperature]',
  )!;
  const condition = root.querySelector<HTMLElement>('[data-photo-condition]')!;
  const icon = root.querySelector<HTMLElement>('[data-photo-weather-icon]')!;
  const status = root.querySelector<HTMLElement>(
    '[data-photo-weather-status]',
  )!;
  return ({weather, failed}: WeatherState) => {
    const value = weather
      ? `${Math.round(weather.current.temperature)}°`
      : '—°';
    const current = conditionFor(
      weather?.current.code,
      weather?.current.isDay ?? true,
    );
    const label = weather ? current.label : 'Météo indisponible';
    const classes = `${current.icon} inline-block size-12 shrink-0 drop-shadow-[0_1px_2px_#000000]`;
    if (temperature.textContent !== value) {
      temperature.textContent = value;
    }

    const temperatureLabel = weather
      ? `Température extérieure : ${value}`
      : 'Température extérieure indisponible';
    if (temperature.getAttribute('aria-label') !== temperatureLabel) {
      temperature.setAttribute('aria-label', temperatureLabel);
    }

    if (condition.textContent !== label) {
      condition.textContent = label;
    }

    if (icon.className !== classes) {
      icon.className = classes;
    }

    status.hidden =
      !weather ||
      !(
        failed ||
        Date.now() - Math.min(weather.fetchedAt, weather.current.time) >=
          staleAfter
      );
  };
}
