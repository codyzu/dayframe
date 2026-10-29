import {describe, expect, it} from 'vitest';
import {hourLabel, parseWeather} from '../src/lib/weather/adapter.ts';
import {
  checkpointForecasts,
  dayHours,
  isWeekend,
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
  it('retains 06–22 local hourly coverage, including both pickups at 06:30', () => {
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
    const points = checkpointForecasts(weather, fixtureNow);
    expect(points.map((point) => point.time)).toEqual([
      '08:00',
      '11:30',
      '16:30',
      '18:00',
    ]);
    expect(points[0].forecast).toEqual(weather.hourly[8]);
    expect(points[1].forecast).toMatchObject({
      temperature: 12.5,
      probability: 80,
      code: 3,
    });
    expect(points[1].probabilityPeriod).toBe('11:00–12:00');
    expect(points[2].forecast?.temperature).toBe(
      (weather.hourly[16].temperature + weather.hourly[17].temperature) / 2,
    );
    weather.hourly.splice(12, 1);
    expect(
      checkpointForecasts(weather, fixtureNow)[1].forecast,
    ).toBeUndefined();
    expect(
      checkpointForecasts(weather, fixtureNow + 3 * 86_400_000).every(
        (point) => point.forecast === undefined,
      ),
    ).toBe(true);
  });
  it('uses neutral weekend labels and supports configurable checkpoints', () => {
    const saturday = Date.parse('2026-10-17T06:30:00Z');
    expect(isWeekend(saturday)).toBe(true);
    expect(isWeekend(fixtureNow)).toBe(false);
    expect(
      checkpointForecasts(fixture(), saturday).map((point) => point.label),
    ).toEqual(['Matin', 'Midi', 'Après-midi', 'Soir']);
    expect(
      checkpointForecasts(fixture(), fixtureNow, [
        {time: '09:00', label: 'Départ', weekendLabel: 'Départ'},
      ]),
    ).toHaveLength(1);
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
  it('selects the same local checkpoints over spring and autumn DST dates', () => {
    for (const iso of ['2026-03-29T06:30:00Z', '2026-10-25T06:30:00Z']) {
      const now = Date.parse(iso);
      const weather = parseWeather(weatherFixture(now), now);
      expect(dayHours(weather, now)).toHaveLength(17);
      const points = checkpointForecasts(weather, now);
      expect(points.every((point) => point.forecast)).toBe(true);
      expect(hourLabel(points[1].forecast!.time)).toBe('11:00');
    }
  });
});

describe('short deterministic French advice', () => {
  it('prioritizes uncertain rain near pickups and a jacket', () => {
    expect(morningAdvice(fixture(), fixtureNow)).toEqual({
      title: 'Prenez un parapluie.',
      detail: 'Une veste sera aussi utile. Pluie possible vers 16h30.',
    });
  });
  it('does not recommend an already passed pickup', () => {
    const now = Date.parse('2026-10-16T14:45:00Z');
    expect(morningAdvice(fixture(), now).detail).toContain('18h00');
    expect(morningAdvice(fixture(), now).detail).not.toContain('16h30');
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
