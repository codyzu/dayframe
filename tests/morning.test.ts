import {describe, expect, it} from 'vitest';
import {type AgendaEvent} from '../src/lib/calendar/contracts.ts';
import {hourLabel, parseWeather} from '../src/lib/weather/adapter.ts';
import {
  dayHours,
  hourlyForecastAt,
  morningAdvice,
  twoHourRain,
} from '../src/lib/weather/morning.ts';
import {
  defaultSettings,
  validateSettings,
} from '../src/lib/dashboard/settings.ts';
import {fixtureNow, weatherFixture} from './fixtures/weather.ts';

const fixture = () => parseWeather(weatherFixture(), fixtureNow);

describe('family day forecasts', () => {
  it('selects timed forecasts by instant during a repeated local hour', () => {
    const first = Date.parse('2026-10-25T02:00:00+02:00');
    const second = Date.parse('2026-10-25T02:00:00+01:00');
    const hour = fixture().hourly[0];
    const hours = [
      {...hour, time: first, temperature: 6},
      {...hour, time: second, temperature: 9},
    ];
    expect(hourlyForecastAt(hours, second)?.forecast.temperature).toBe(9);
    expect(hourlyForecastAt(hours, second + 30 * 60_000)).toBeUndefined();
  });
  it('retains 06–22 local hourly coverage as the day advances', () => {
    const early = Date.parse('2026-10-16T04:30:00Z');
    const hours = dayHours(fixture(), early);
    expect(hours).toHaveLength(17);
    expect(hourLabel(hours[0].time)).toBe('06:00');
    expect(hourLabel(hours.at(-1)!.time)).toBe('22:00');
    expect(dayHours(fixture(), Date.parse('2026-10-16T18:00:00Z'))).toEqual(
      hours,
    );
    expect(dayHours(fixture(), fixtureNow + 3 * 86_400_000)).toEqual([]);
  });
  it('interpolates half-hour temperatures, conservatively uses max hourly rain and preceding icon', () => {
    const weather = fixture();
    weather.hourly[11].temperature = 10;
    weather.hourly[12].temperature = 15;
    weather.hourly[11].probability = 20;
    weather.hourly[12].probability = 80;
    weather.hourly[11].code = 3;
    const instant = Date.parse('2026-10-16T11:30:00+02:00');
    expect(hourlyForecastAt(weather.hourly, instant)).toEqual({
      forecast: {
        ...weather.hourly[11],
        temperature: 12.5,
        probability: 80,
      },
      probabilityPeriod: '11:00–12:00',
    });
    weather.hourly.splice(12, 1);
    expect(hourlyForecastAt(weather.hourly, instant)).toBeUndefined();
  });
  it('aggregates eight two-hour bins by max, never sum or probability union', () => {
    const weather = fixture();
    weather.hourly[6].probability = 40;
    weather.hourly[7].probability = 60;
    weather.hourly[8].probability = 90;
    const bars = twoHourRain(dayHours(weather, fixtureNow));
    expect(bars).toHaveLength(8);
    expect(bars[0].probability).toBe(60);
    expect(bars[1].probability).toBe(90);
    expect(hourLabel(bars.at(-1)!.end)).toBe('22:00');
    expect(bars.every((bar) => bar.end - bar.start === 7_200_000)).toBe(true);
  });
  it('preserves the chart hours over spring and autumn DST dates', () => {
    for (const iso of ['2026-03-29T06:30:00Z', '2026-10-25T06:30:00Z']) {
      const now = Date.parse(iso);
      const weather = parseWeather(weatherFixture(now), now);
      expect(dayHours(weather, now)).toHaveLength(17);
    }
  });
});

describe('short deterministic French advice', () => {
  const pickup: AgendaEvent = {
    title: 'Sortie d’école',
    calendar: 'routines',
    start: '2026-10-16T16:30:00+02:00',
    end: '2026-10-16T17:00:00+02:00',
    allDay: false,
    weatherRelevant: true,
  };

  it('gives rain timing and clothing advice without calendar data', () => {
    expect(morningAdvice(fixture(), fixtureNow)).toEqual({
      title: 'Prenez un parapluie.',
      detail: 'Pluie possible vers 15h00. Une veste sera aussi utile.',
    });
  });

  it('mentions the earliest upcoming tagged event today with rain at its start', () => {
    const events: AgendaEvent[] = [
      {
        ...pickup,
        title: 'Activité ultérieure',
        start: '2026-10-16T18:00:00+02:00',
      },
      {
        ...pickup,
        title: 'Rendez-vous sans tag',
        start: '2026-10-16T15:00:00+02:00',
        weatherRelevant: undefined,
      },
      {...pickup, title: 'Matinée sèche', start: '2026-10-16T11:00:00+02:00'},
      {
        ...pickup,
        title: 'Massage',
        calendar: 'massages',
        start: '2026-10-16T15:30:00+02:00',
      },
      pickup,
    ];
    expect(morningAdvice(fixture(), fixtureNow, events).detail).toBe(
      'Pluie possible vers 15h00. Pour « Sortie d’école » à 16h30, prévoyez un parapluie.',
    );

    const later = Date.parse('2026-10-16T16:45:00+02:00');
    expect(morningAdvice(fixture(), later, events).detail).toContain(
      '« Activité ultérieure » à 18h00',
    );
  });

  it('keeps severe weather advice ahead of tagged events and ignores all-day and tomorrow entries', () => {
    const weather = fixture();
    const tomorrow = {...pickup, start: '2026-10-17T16:30:00+02:00'};
    const allDay = {...pickup, allDay: true};
    expect(morningAdvice(weather, fixtureNow, [tomorrow, allDay])).toEqual(
      morningAdvice(weather, fixtureNow),
    );
    weather.current.code = 95;
    expect(morningAdvice(weather, fixtureNow, [pickup])).toEqual(
      morningAdvice(weather, fixtureNow),
    );
  });

  it('handles cold, dry variation, light clothing, amount thresholds and hazardous conditions', () => {
    const weather = fixture();
    for (const hour of weather.hourly) {
      hour.probability = 49;
      hour.precipitation = 0.19;
    }

    expect(morningAdvice(weather, fixtureNow).title).toBe(
      'Prévoyez une veste.',
    );
    weather.hourly[14].temperature = 23;
    expect(morningAdvice(weather, fixtureNow).detail).toContain(
      'couches légères',
    );
    weather.current.feelsLike = 3;
    expect(morningAdvice(weather, fixtureNow).detail).toContain(
      'Bonnet et gants',
    );
    weather.current.feelsLike = 18;
    for (const hour of weather.hourly) {
      hour.temperature = 18;
    }

    expect(morningAdvice(weather, fixtureNow).title).toContain('tenue légère');
    weather.hourly[16].precipitation = 0.2;
    expect(morningAdvice(weather, fixtureNow).title).toContain('parapluie');
    weather.current.feelsLike = 3;
    expect(morningAdvice(weather, fixtureNow).detail).toBe(
      'Pluie possible vers 16h00. Bonnet, gants et parapluie conseillés.',
    );
    weather.current.code = 67;
    expect(morningAdvice(weather, fixtureNow).title).toContain('Prudence');
    expect(
      morningAdvice(weather, fixtureNow + 3 * 86_400_000).detail,
    ).toContain('indisponibles');
  });
});

it('defaults new photo settings to cover and retains explicit persisted contain', () => {
  expect(defaultSettings.fit).toBe('cover');
  expect(validateSettings({}).fit).toBe('cover');
  expect(validateSettings({...defaultSettings, fit: 'contain'}).fit).toBe(
    'contain',
  );
});
