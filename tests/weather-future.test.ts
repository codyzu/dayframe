import {describe, expect, it} from 'vitest';
import {forecastDates} from '../src/lib/weather/future.ts';
import {
  staleWeatherLabel,
  readingAgeLabel,
  weatherReadingLabel,
  isWeatherStale,
} from '../src/lib/weather/freshness.ts';
import {parseWeather} from '../src/lib/weather/adapter.ts';
import {
  fixtureNow,
  weatherFixture,
  sevenDayFixture,
} from './fixtures/weather.ts';

describe('dated freshness copy', () => {
  it.each([
    [
      '2026-10-16T06:30:00Z',
      '2026-10-16T07:30:00Z',
      'Météo de 08:30 · non actualisée',
    ],
    [
      '2026-10-21T21:45:00Z',
      '2026-10-22T00:00:00Z',
      'Météo du 21 oct. à 23:45 · non actualisée',
    ],
    [
      '2026-12-31T22:45:00Z',
      '2027-01-01T00:00:00Z',
      'Météo du 31 déc. 2026 à 23:45 · non actualisée',
    ],
    [
      '2026-10-25T01:30:00Z',
      '2026-10-25T03:00:00Z',
      'Météo de 02:30 · non actualisée',
    ],
  ])('formats %s in the location timezone', (time, now, label) => {
    const weather = parseWeather(weatherFixture(), fixtureNow);
    weather.current.time = Date.parse(time);
    expect(staleWeatherLabel(weather, Date.parse(now))).toBe(label);
  });
  it('warns on a failed refresh even with young conditions', () => {
    const weather = parseWeather(weatherFixture(), fixtureNow);
    expect(isWeatherStale(weather, fixtureNow, true)).toBe(true);
    expect(isWeatherStale(weather, fixtureNow)).toBe(false);
  });
});

describe('bounded future forecasts', () => {
  it('parses seven days, daily rain and condition fields; keeps old cache compatible', () => {
    const weather = parseWeather(sevenDayFixture(), fixtureNow);
    expect(weather.hourly).toHaveLength(168);
    expect(weather.daily).toHaveLength(7);
    expect(weather.daily[6]).toMatchObject({
      date: '2026-10-22',
      probability: 65,
      code: 61,
    });
    expect(
      parseWeather(weatherFixture(), fixtureNow).daily[0].probability,
    ).toBeUndefined();
  });
  it('handles partial coverage and rejects invalid extra arrays, units and unbounded payloads', () => {
    const raw = sevenDayFixture();
    raw.daily.precipitation_probability_max.pop();
    expect(() => parseWeather(raw, fixtureNow)).toThrow();
    raw.daily.precipitation_probability_max.push(200);
    expect(() => parseWeather(raw, fixtureNow)).toThrow();
    raw.daily.precipitation_probability_max[6] = 65;
    raw.daily_units.precipitation_probability_max = 'mm';
    expect(() => parseWeather(raw, fixtureNow)).toThrow();
    const unbounded = sevenDayFixture();
    for (const values of Object.values(unbounded.hourly)) {
      values.push(...values.slice(0, 8));
    }

    expect(() => parseWeather(unbounded, fixtureNow)).toThrow();
    const tooManyDays = sevenDayFixture();
    for (const values of Object.values(tooManyDays.daily)) {
      values.push(values[0]);
    }

    expect(() => parseWeather(tooManyDays, fixtureNow)).toThrow();
    const partial = weatherFixture();
    for (const values of Object.values(partial.daily)) {
      values.pop();
    }

    expect(parseWeather(partial, fixtureNow).daily).toHaveLength(1);
  });
  it.each([
    '2026-12-31T23:30:00Z',
    '2026-03-28T23:30:00Z',
    '2026-10-24T23:30:00Z',
  ])('uses local calendar dates across %s', (time) => {
    const dates = forecastDates(Date.parse(time));
    expect(dates).toHaveLength(7);
    expect(new Set(dates).size).toBe(7);
    expect(dates[0]).toBe(
      time.startsWith('2026-12')
        ? '2027-01-01'
        : time.startsWith('2026-03')
          ? '2026-03-29'
          : '2026-10-25',
    );
  });
});

describe('human-friendly reading age', () => {
  it.each([
    [0, 'Relevé à l’instant'],
    [1, 'Relevé il y a 1 min'],
    [15, 'Relevé il y a 15 min'],
    [59, 'Relevé il y a 59 min'],
    [60, 'Relevé il y a 1 h'],
    [119, 'Relevé il y a 1 h'],
    [120, 'Relevé il y a 2 h'],
    [-1, 'Relevé de 08:30'],
  ])(
    'uses conditions age for %i minutes, irrespective of retrieval',
    (age, label) => {
      const weather = parseWeather(weatherFixture(), fixtureNow);
      weather.fetchedAt = fixtureNow + age * 60_000;
      expect(readingAgeLabel(weather, weather.fetchedAt)).toBe(label);
    },
  );
  it('keeps failed-refresh warnings even for recent conditions and removes them after recovery', () => {
    const weather = parseWeather(weatherFixture(), fixtureNow);
    const now = fixtureNow + 15 * 60_000;
    expect(weatherReadingLabel(weather, now, true)).toBe(
      'Relevé il y a 15 min · non actualisé',
    );
    expect(weatherReadingLabel(weather, now)).toBe('Relevé il y a 15 min');
    expect(weatherReadingLabel(weather, fixtureNow + 45 * 60_000)).toBe(
      'Relevé il y a 45 min · non actualisé',
    );
  });
  it.each([
    ['2026-10-21T21:45:00Z', '2026-10-22T00:00:00Z', 'Relevé hier à 23:45'],
    [
      '2026-10-20T21:45:00Z',
      '2026-10-22T00:00:00Z',
      'Relevé du 20 oct. à 23:45',
    ],
    [
      '2026-12-31T22:45:00Z',
      '2027-01-01T00:00:00Z',
      'Relevé du 31 déc. 2026 à 23:45',
    ],
    ['2026-10-24T21:45:00Z', '2026-10-25T22:30:00Z', 'Relevé hier à 23:45'],
    ['2026-03-28T22:45:00Z', '2026-03-29T21:30:00Z', 'Relevé hier à 23:45'],
    ['2026-10-25T00:30:00Z', '2026-10-25T01:30:00Z', 'Relevé il y a 1 h'],
  ])(
    'uses location calendar dates across midnight/year/DST: %s',
    (time, now, label) => {
      const weather = parseWeather(weatherFixture(), fixtureNow);
      weather.current.time = Date.parse(time);
      expect(readingAgeLabel(weather, Date.parse(now))).toBe(label);
    },
  );
});
