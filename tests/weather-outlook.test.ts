import {describe, expect, it} from 'vitest';
import {dateKey, parseWeather} from '../src/lib/weather/adapter.ts';
import {
  adviceHours,
  temperatureOutlook,
  selectedDaySummary,
} from '../src/lib/weather/outlook.ts';
import {chartGeometry} from '../src/lib/weather/chart.ts';
import {morningAdvice} from '../src/lib/weather/morning.ts';
import {fixtureNow, weatherFixture} from './fixtures/weather.ts';

function dryDay() {
  const weather = parseWeather(weatherFixture(), fixtureNow);
  weather.current.temperature = 10;
  for (const hour of weather.hourly) {
    hour.temperature = 9;
    hour.probability = 0;
    hour.precipitation = 0;
    hour.code = 2;
  }

  weather.hourly[14].temperature = 15;
  weather.hourly[24 + 7].temperature = 7;
  return weather;
}

describe('forward-looking weather advice', () => {
  it('describes a future peak with its time, ignoring the daily maximum field', () => {
    const weather = dryDay();
    weather.daily[0].high = 25;
    expect(temperatureOutlook(weather, fixtureNow)).toBe(
      '10° maintenant, jusqu’à 15° vers 14h00.',
    );
  });
  it('switches to evening after the forecast peak and does not reuse the morning minimum', () => {
    const weather = dryDay();
    weather.hourly[5].temperature = 2;
    const now = Date.parse('2026-10-16T14:00:00Z');
    expect(morningAdvice(weather, now)).toEqual({
      title: 'Prévoyez une veste.',
      detail: '10° maintenant, autour de 9° ce soir vers 21h00.',
    });
  });
  it.each([
    '2026-10-16T19:00:00Z',
    '2026-10-16T20:05:00Z',
    '2026-10-16T21:30:00Z',
  ])(
    'looks through the next morning at %s, including rain and cold after midnight',
    (iso) => {
      const weather = dryDay();
      const now = Date.parse(iso);
      expect(temperatureOutlook(weather, now)).toBe(
        '10° maintenant, autour de 7° demain matin vers 07h00.',
      );
      weather.hourly[26].probability = 80;
      expect(morningAdvice(weather, now).detail).toContain('demain vers 02h00');
      weather.hourly[26].code = 67;
      expect(morningAdvice(weather, now).title).toContain('Prudence');
    },
  );
  it('does not invent a missing evening or next-morning value', () => {
    const weather = dryDay();
    const now = Date.parse('2026-10-16T20:05:00Z');
    weather.hourly = weather.hourly.slice(0, 23);
    expect(temperatureOutlook(weather, now)).toBe(
      '10° maintenant. Suite des prévisions indisponible.',
    );
    weather.hourly = [];
    expect(morningAdvice(weather, now).detail).toContain('indisponibles');
  });
  it('uses calendar dates over year boundaries and DST, regardless of browser timezone', () => {
    for (const iso of [
      '2026-12-31T21:05:00Z',
      '2026-10-24T20:05:00Z',
      '2026-03-28T21:05:00Z',
    ]) {
      const now = Date.parse(iso);
      const weather = parseWeather(weatherFixture(now), now);
      const hours = adviceHours(weather, now);
      expect(hours.every((hour) => hour.time + 3_600_000 > now)).toBe(true);
      expect(new Set(hours.map((hour) => dateKey(hour.time))).size).toBe(2);
      expect(temperatureOutlook(weather, now)).toContain(
        'demain matin vers 07h00',
      );
    }
  });
  it('summarizes only remaining hours today and the full selected future day', () => {
    const weather = dryDay();
    weather.hourly[8].probability = 90;
    const now = Date.parse('2026-10-16T14:00:00Z');
    expect(
      selectedDaySummary(weather.hourly.slice(0, 24), now, '2026-10-16'),
    ).not.toContain('08h00');
    expect(selectedDaySummary([], now, '2026-10-17')).toContain('indisponible');
  });
});

it('does not connect the temperature curve across missing hourly coverage', () => {
  const hours = dryDay().hourly.slice(0, 5);
  hours.splice(2, 1);
  expect(chartGeometry(hours)!.path.match(/M/gv)).toHaveLength(2);
});
