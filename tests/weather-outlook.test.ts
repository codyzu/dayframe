import {describe, expect, it} from 'vitest';
import {dateKey, parseWeather} from '../src/lib/weather/adapter.ts';
import {adviceHours, temperatureOutlook} from '../src/lib/weather/outlook.ts';
import {runtimeConfig} from '../src/lib/dashboard/config.ts';
import {forecastDates} from '../src/lib/weather/future.ts';
import {chartGeometry} from '../src/lib/weather/chart.ts';
import {morningAdvice, forecastAdvice} from '../src/lib/weather/morning.ts';
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
  it('uses only the selected future day for clothing, rain and hazards', () => {
    const weather = dryDay();
    weather.current.feelsLike = -20;
    weather.current.code = 99;
    weather.hourly[8].probability = 90;
    expect(forecastAdvice(weather, '2026-10-17')).toEqual({
      title: 'Prévoyez une veste.',
      detail: '7° à 9° sur les heures disponibles.',
    });
    const future = weather.hourly.filter(
      (hour) => dateKey(hour.time) === '2026-10-17',
    );
    future[8].probability = 80;
    expect(forecastAdvice(weather, '2026-10-17').title).toBe(
      'Prenez un parapluie.',
    );
    expect(forecastAdvice(weather, '2026-10-17').detail).toContain('08h00');
    future[8].temperature = 2;
    expect(forecastAdvice(weather, '2026-10-17').title).toBe(
      'Habillez-vous chaudement.',
    );
    future[8].code = 67;
    expect(forecastAdvice(weather, '2026-10-17').title).toBe(
      'Prudence pour les trajets.',
    );
    expect(forecastAdvice(weather, '2026-10-18').detail).toContain(
      'indisponibles',
    );
  });
});

it('does not connect the temperature curve across missing hourly coverage', () => {
  const hours = dryDay().hourly.slice(0, 5);
  hours.splice(2, 1);
  expect(chartGeometry(hours)!.path.match(/M/gv)).toHaveLength(2);
});

it('keeps seven calendar dates across DST and year changes in the weather timezone', () => {
  const previous = runtimeConfig.timezone;
  try {
    for (const timezone of [
      'Europe/Paris',
      'Pacific/Kiritimati',
      'America/Los_Angeles',
    ]) {
      runtimeConfig.timezone = timezone;
      for (const iso of [
        '2026-10-25T00:30:00Z',
        '2026-03-29T00:30:00Z',
        '2026-12-31T23:30:00Z',
      ]) {
        const now = Date.parse(iso);
        const dates = forecastDates(now);
        expect(dates).toHaveLength(7);
        expect(dates[0]).toBe(dateKey(now));
        expect(new Set(dates).size).toBe(7);
        for (let i = 1; i < dates.length; i++) {
          expect(Date.parse(dates[i]) - Date.parse(dates[i - 1])).toBe(
            86_400_000,
          );
        }
      }
    }
  } finally {
    runtimeConfig.timezone = previous;
  }
});
