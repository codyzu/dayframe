import {describe, expect, it} from 'vitest';
import {trendGeometry, precipitationLabel} from '../src/lib/weather/trend.ts';
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
      precipitation: 3,
      code: 61,
    });
    expect(
      parseWeather(weatherFixture(), fixtureNow).daily[0].probability,
    ).toBeUndefined();
  });
  it('keeps absent and null daily totals unknown instead of summing partial hours', () => {
    const old = parseWeather(weatherFixture(), fixtureNow);
    expect(old.daily[0].precipitation).toBeUndefined();
    const raw = sevenDayFixture();
    raw.daily.precipitation_sum[0] = 0;
    Object.assign(raw.daily, {
      precipitation_sum: [0, null, 0.04, 3.5, 18, 24, 0],
    });
    const weather = parseWeather(raw, fixtureNow);
    expect(weather.daily.map((day) => day.precipitation)).toEqual([
      0,
      undefined,
      0.04,
      3.5,
      18,
      24,
      0,
    ]);
    expect(precipitationLabel(undefined)).toBe('—');
    expect(precipitationLabel(0)).toBe('0');
    expect(precipitationLabel(0.04)).toBe('<0,1');
    expect(precipitationLabel(3.5)).toBe('3,5');
  });
  it.each(['negative', 'nonfinite', 'length', 'units'])(
    'rejects invalid daily precipitation %s',
    (kind) => {
      const raw = sevenDayFixture();
      switch (kind) {
        case 'negative': {
          raw.daily.precipitation_sum[0] = -1;

          break;
        }

        case 'nonfinite': {
          raw.daily.precipitation_sum[0] = NaN;

          break;
        }

        case 'length': {
          raw.daily.precipitation_sum.pop();

          break;
        }

        case 'units': {
          raw.daily_units.precipitation_sum = 'cm';

          break;
        }
        // No default
      }

      expect(() => parseWeather(raw, fixtureNow)).toThrow();
    },
  );
  it('draws independent bounded scales and breaks the temperature line at missing days', () => {
    const dates = forecastDates(fixtureNow);
    const {daily} = parseWeather(sevenDayFixture(), fixtureNow);
    daily[0].high = -5;
    daily[1].precipitation = 0;
    daily[2].precipitation = 60;
    daily.splice(3, 1);
    const chart = trendGeometry(dates, daily, 1200);
    expect(chart.path.match(/M/gv)).toHaveLength(2);
    expect(chart.points[3].day).toBeUndefined();
    expect(chart.points[1].rainHeight).toBe(0);
    expect(chart.points[2].rainHeight).toBe(32);
    expect(chart.amountCeiling).toBe(60);
    for (const point of chart.points) {
      expect(point.x).toBeGreaterThan(104);
      expect(point.rainX).toBeLessThan(1200);
      expect(point.rainY).toBeGreaterThanOrEqual(22);
      expect(point.y).toBeGreaterThanOrEqual(20);
      expect(point.y).toBeLessThanOrEqual(48);
    }

    for (const day of daily) {
      day.precipitation = 0;
      day.high = 20;
    }

    const dry = trendGeometry(dates, daily, 1200);
    expect(dry.amountCeiling).toBe(30);
    expect(dry.path).not.toMatch(/NaN|Infinity/v);
    expect(
      dry.points
        .filter((point) => point.day)
        .every((point) => point.rainHeight === 0),
    ).toBe(true);
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
