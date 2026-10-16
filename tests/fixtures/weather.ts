// Synthetic Annecy scenario; no live service or household data in tests.
export const fixtureNow = Date.parse('2026-10-16T06:30:00Z');
export function weatherFixture(now = fixtureNow) {
  const midnight = Math.floor(now / 86_400_000) * 86_400_000 - 2 * 3_600_000;
  const times = Array.from(
    {length: 48},
    (_, index) => midnight / 1000 + index * 3600,
  );
  return {
    timezone: 'Europe/Paris',
    utc_offset_seconds: 7200,
    current_units: {
      time: 'unixtime',
      temperature_2m: '°C',
      apparent_temperature: '°C',
      precipitation: 'mm',
    },
    hourly_units: {
      time: 'unixtime',
      temperature_2m: '°C',
      precipitation_probability: '%',
      precipitation: 'mm',
    },
    daily_units: {
      time: 'unixtime',
      temperature_2m_max: '°C',
      temperature_2m_min: '°C',
    },
    current: {
      time: Math.floor(now / 1000),
      temperature_2m: 12,
      apparent_temperature: 10,
      weather_code: 2 as number | undefined,
      is_day: 1,
      precipitation: 0,
    },
    hourly: {
      time: times,
      temperature_2m: times.map(
        (_, index) => 12 + Math.sin((index - 8) / 5) * 6,
      ),
      precipitation_probability: times.map<number>((_, index) =>
        index % 24 >= 15 ? 65 : 10,
      ),
      precipitation: times.map(() => 0),
      weather_code: times.map((_, index) => (index % 24 >= 15 ? 61 : 2)),
      is_day: times.map((_, index) =>
        index % 24 >= 7 && index % 24 < 19 ? 1 : 0,
      ),
    },
    daily: {
      time: [midnight / 1000, midnight / 1000 + 86_400],
      temperature_2m_max: [19, 18],
      temperature_2m_min: [8, 7],
    },
  };
}
