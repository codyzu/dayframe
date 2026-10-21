/* eslint-disable unicorn/max-nested-calls -- Timestamp fixtures are kept next to their expected mode. */
import {describe, expect, it} from 'vitest';
import {
  dayContext,
  dayOffSchedule,
  emptyPlanning,
  observanceText,
  type DayPlanning,
  type OfficialCalendar,
} from '../src/lib/dashboard/day-planning.ts';
import {
  defaultSettings,
  validateSettings,
} from '../src/lib/dashboard/settings.ts';
import {
  createModeState,
  createScheduleResolver,
} from '../src/lib/dashboard/schedule.ts';
import {
  routineForDay,
  checkpointForecasts,
} from '../src/lib/weather/morning.ts';
import {
  normalizeHolidays,
  normalizeSchoolCalendar,
} from '../worker/school-calendar.ts';
import {parseWeather} from '../src/lib/weather/adapter.ts';
import {weatherFixture} from './fixtures/weather.ts';

const now = Date.parse('2026-10-21T06:30:00Z');
const calendar: OfficialCalendar = {
  year: 2026,
  fetchedAt: now,
  knownFrom: '2026-09-01',
  knownUntil: '2027-07-03',
  vacations: [
    {start: '2026-10-17', end: '2026-11-02', label: 'Vacances de la Toussaint'},
  ],
  holidays: {'2026-11-11': 'Armistice 1918', '2026-11-01': 'La Toussaint'},
};
const planning: DayPlanning = {
  schoolCalendar: true,
  schedules: {
    dayOff: dayOffSchedule,
    wednesday: [
      {start: '08:00', end: '11:00', mode: 'morning'},
      {start: '11:00', end: '23:00', mode: 'photos'},
      {start: '23:00', end: '08:00', mode: 'night'},
    ],
  },
  checkpoints: {
    wednesday: [
      {time: '09:30', label: 'Matin synthétique'},
      {time: '12:30', label: 'Après-midi synthétique'},
      {time: '16:15', label: 'Retour'},
      {time: '19:00', label: 'Soir synthétique'},
    ],
  },
};
const currentCalendar = (date: number) => ({...calendar, fetchedAt: date});

it('keeps old saved schedules unchanged until explicitly configured', () => {
  expect(validateSettings({}).planning).toEqual(emptyPlanning);
  const old = {...defaultSettings};
  expect(createScheduleResolver(old)(Date.parse('2026-10-24T05:30:00Z'))).toBe(
    'morning',
  );
});
it('gives vacations and holidays precedence over Wednesday activities, and shows both observances', () => {
  expect(dayContext(now, 'Europe/Paris', planning, calendar).profile).toBe(
    'dayOff',
  );
  expect(
    routineForDay(now, planning, calendar).points.map(({label}) => label),
  ).not.toContain('Matin synthétique');
  const holiday = Date.parse('2026-11-11T08:00:00Z');
  expect(
    dayContext(holiday, 'Europe/Paris', planning, currentCalendar(holiday))
      .profile,
  ).toBe('dayOff');
  const both = Date.parse('2026-11-01T08:00:00Z');
  expect(
    observanceText(
      dayContext(both, 'Europe/Paris', planning, currentCalendar(both)),
    ),
  ).toBe(
    'Férié : La Toussaint · Vacances de la Toussaint · jusqu’au 1 novembre',
  );
  const school = Date.parse('2026-11-04T08:00:00Z');
  expect(
    routineForDay(school, planning, currentCalendar(school)).points,
  ).toEqual(planning.checkpoints.wednesday);
});
it('uses the later weekend/day-off mode boundaries across DST and on resume without resetting overrides', () => {
  const resolve = createScheduleResolver(
    {...defaultSettings, planning},
    calendar,
  );
  for (const [iso, expected] of [
    ['2026-10-24T05:59:59Z', 'night'],
    ['2026-10-24T06:00:00Z', 'morning'],
    ['2026-10-24T09:00:00Z', 'photos'],
    ['2026-10-25T06:59:59Z', 'night'],
    ['2026-10-25T07:00:00Z', 'morning'],
    ['2026-10-25T10:00:00Z', 'photos'],
    ['2026-10-25T22:00:00Z', 'night'],
  ]) {
    expect(resolve(Date.parse(iso))).toBe(expected);
  }

  const state = createModeState({
    ...defaultSettings,
    planning,
    overrideTimeoutSeconds: 30,
  });
  state.interact(now, 0, 'photos');
  state.calendar(calendar);
  expect(state.mode(now + 29_999, 29_999)).toBe('photos');
  expect(state.mode(now + 30_000, 30_000)).toBe('morning');
});
it('uses exclusive return dates and does not treat stale, future, wrong-year or unverified summer dates as school days', () => {
  const back = Date.parse('2026-11-02T07:00:00Z');
  expect(
    dayContext(back, 'Europe/Paris', planning, currentCalendar(back)).isDayOff,
  ).toBe(false);
  for (const official of [
    undefined,
    {...calendar, fetchedAt: now + 1},
    {...calendar, fetchedAt: now - 31 * 86_400_000},
    {...calendar, knownUntil: '2026-10-21'},
    {...calendar, year: 2025},
  ]) {
    const context = dayContext(now, 'Europe/Paris', planning, official);
    expect(context.isKnown).toBe(false);
    expect(observanceText(context)).toContain('à confirmer');
    expect(
      routineForDay(now, planning, official).points.map(({label}) => label),
    ).not.toContain('Matin synthétique');
  }

  expect(dayContext(now, 'America/New_York', planning, calendar).isKnown).toBe(
    false,
  );
});
it('supports explicit Saturday times while public holidays still use day-off times', () => {
  const custom = {
    ...planning,
    schedules: {
      ...planning.schedules,
      saturday: [{start: '06:00', end: '10:00', mode: 'photos' as const}],
    },
  };
  expect(
    createScheduleResolver(
      {...defaultSettings, planning: custom},
      {...calendar, vacations: []},
    )(Date.parse('2026-10-24T06:00:00Z')),
  ).toBe('photos');
});
it('interpolates quarter-hour pickup weather without borrowing another hour', () => {
  const date = Date.parse('2026-11-04T07:00:00Z');
  const weather = parseWeather(weatherFixture(date), date);
  const points = checkpointForecasts(
    weather,
    date,
    planning.checkpoints.wednesday,
  );
  const before = weather.hourly.find(
    (hour) => hour.time === Date.parse('2026-11-04T15:00:00Z'),
  )!;
  const after = weather.hourly.find(
    (hour) => hour.time === before.time + 3_600_000,
  )!;
  expect(points[2].forecast?.temperature).toBe(
    before.temperature + (after.temperature - before.temperature) / 4,
  );
});

describe('day planning validation', () => {
  it('rejects overlapping per-day periods, invalid profiles, unordered/oversized checkpoints and unknown keys', () => {
    expect(validateSettings({...defaultSettings, planning}).planning).toEqual(
      planning,
    );
    for (const invalid of [
      null,
      [],
      {...planning, secret: true},
      {...planning, schedules: {badDay: dayOffSchedule}},
      {
        ...planning,
        schedules: {monday: [dayOffSchedule[0], dayOffSchedule[0]]},
      },
      {
        ...planning,
        checkpoints: {
          wednesday: [{time: '25:15', label: 'Invalid'}],
        },
      },
      {
        ...planning,
        checkpoints: {
          wednesday: [
            {time: '18:00', label: 'Late'},
            {time: '10:00', label: 'Early'},
          ],
        },
      },
      {
        ...planning,
        checkpoints: {
          wednesday: Array.from({length: 5}, () => ({
            time: '10:00',
            label: 'Too many',
          })),
        },
      },
    ]) {
      expect(() => validateSettings({planning: invalid})).toThrow();
    }
  });
});

const row = (
  description: string,
  start: string,
  end: string,
  population = '-',
) => ({
  description,
  start_date: start,
  end_date: end,
  population,
  location: 'Grenoble',
  zones: 'Zone A',
  annee_scolaire: '2026-2027',
});
it('normalizes the actual ministry shape: Paris dates, pupil summer, one-day bridges and incomplete summers', () => {
  const results = [
    row(
      'Vacances de la Toussaint',
      '2026-10-16T22:00:00Z',
      '2026-11-01T23:00:00Z',
    ),
    row(
      'Vacances d’Été',
      '2027-07-02T22:00:00Z',
      '2027-09-01T22:00:00Z',
      'Élèves',
    ),
    row(
      'Vacances d’Été',
      '2027-07-02T22:00:00Z',
      '2027-08-31T22:00:00Z',
      'Enseignants',
    ),
    row('Pont de l’Ascension', '2027-05-06T22:00:00Z', '2027-05-06T22:00:00Z'),
  ];
  const result = normalizeSchoolCalendar(
    {total_count: results.length, results},
    now,
  );
  expect(result.vacations).toEqual([
    {start: '2026-10-17', end: '2026-11-02', label: 'Vacances de la Toussaint'},
    {start: '2027-07-03', end: '2027-09-02', label: 'Vacances d’Été'},
    {start: '2027-05-07', end: '2027-05-08', label: 'Pont de l’Ascension'},
  ]);
  const openSummer = [
    row(
      'Début des Vacances d’Été',
      '2027-07-02T22:00:00Z',
      '2027-07-02T22:00:00Z',
    ),
  ];
  expect(
    normalizeSchoolCalendar({total_count: 1, results: openSummer}, now)
      .knownUntil,
  ).toBe('2027-07-03');
  expect(() =>
    normalizeSchoolCalendar({total_count: 101, results}, now),
  ).toThrow();
  expect(() =>
    normalizeSchoolCalendar({total_count: 0, results: []}, now),
  ).toThrow();
  expect(() => normalizeHolidays({'2026-01-01': 'Only one'}, 2026)).toThrow();
});
