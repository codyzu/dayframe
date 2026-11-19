import {comparableTitle} from '../calendar/timeline.ts';
import {wmoConditions, type conditions} from './conditions.ts';
import {weatherLightPhase} from './daylight.ts';
import {type Weather} from './adapter.ts';

export function renderWeatherWindow(
  root: HTMLElement,
  weather: Weather | undefined,
  now: number,
  hasFreshConditions: boolean,
) {
  const scene = root.querySelector<HTMLElement>('[data-lake-window]')!;
  const code = hasFreshConditions ? weather?.current.code : undefined;
  const condition: keyof typeof conditions =
    code === undefined ? 'unknown' : (wmoConditions[code] ?? 'unknown');
  const phase = weatherLightPhase(weather, now);
  let family = 'cloudy';
  let effect = '';
  switch (condition) {
    case 'clear':
    case 'fair': {
      family = 'clear';
      break;
    }

    case 'snow': {
      family = 'snow';
      effect = 'snow';
      break;
    }

    case 'fog': {
      effect = 'fog';
      break;
    }

    case 'rain':
    case 'drizzle':
    case 'showers':
    case 'freezing':
    case 'storm':
    case 'hail': {
      effect = 'rain';
      break;
    }

    case 'cloudy':
    case 'unknown': {
      break;
    }
  }

  const image = `${family}-${phase}`;
  if (scene.dataset.lakeScene !== image) {
    scene.dataset.lakeScene = image;
    scene.style.setProperty(
      '--lake-image',
      `url("/weather-window/${image}.webp")`,
    );
  }

  scene.dataset.lakeEffect = effect;
}

type LakeCalendar = {
  officialHoliday?: string;
  isSchoolBreak: boolean;
  observedTitles: readonly string[];
  date: string;
};

export function renderLakeCalendar(
  scene: HTMLElement,
  {officialHoliday, isSchoolBreak, observedTitles, date}: LakeCalendar,
) {
  const holiday =
    officialHoliday === undefined ? '' : comparableTitle(officialHoliday);
  const titles = observedTitles.map((title) => comparableTitle(title));
  const isRamadan = (title: string) => /\bramadan\b/v.test(title);
  let accent = titles.some((title) => !isRamadan(title)) ? 'lantern' : '';
  if (
    (holiday !== '' && date.endsWith('-12-25')) ||
    titles.some((title) =>
      ['noel', 'christmas', 'christmas day'].includes(title),
    )
  ) {
    accent = 'christmas';
  } else if (
    (holiday !== '' && date.endsWith('-01-01')) ||
    titles.some((title) => ['nouvel an', 'new year s day'].includes(title))
  ) {
    accent = 'new-year';
  } else if (
    holiday.includes('paques') ||
    titles.some((title) =>
      ['paques', 'dimanche de paques', 'easter', 'easter sunday'].includes(
        title,
      ),
    )
  ) {
    accent = 'easter';
  } else if (holiday !== '' && date.endsWith('-07-14')) {
    accent = 'france';
  } else if (
    date.endsWith('-07-04') &&
    titles.some((title) =>
      /^(?:(?:us |u s )?independence day(?: united states)?|4 juillet|fete nationale (?:americaine|des etats unis))$/v.test(
        title,
      ),
    )
  ) {
    accent = 'usa';
  }

  scene.dataset.lakeAccent = accent;
  scene.dataset.lakeRamadan = String(titles.some((title) => isRamadan(title)));
  scene.dataset.lakeSchoolBreak = String(isSchoolBreak);
}
