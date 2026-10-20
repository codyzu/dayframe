import {describe, expect, it} from 'vitest';
import {
  createModeState,
  createScheduleResolver,
} from '../src/lib/dashboard/schedule.ts';
import {defaultSettings} from '../src/lib/dashboard/settings.ts';

const resolve = createScheduleResolver(defaultSettings);
describe('IANA daily schedule', () => {
  it.each([
    ['03:59:59.999', 'night'],
    ['04:00:00', 'morning'],
    ['07:59:59.999', 'morning'],
    ['08:00:00', 'photos'],
    ['14:59:59.999', 'photos'],
    ['15:00:00', 'photos'],
    ['18:59:59.999', 'photos'],
    ['19:00:00', 'night'],
    ['22:00:00', 'night'],
    ['00:00:00', 'night'],
  ])('half-open Paris boundary at %s UTC', (time, expected) => {
    expect(resolve(Date.parse(`2026-10-16T${time}Z`))).toBe(expected);
  });
  it('uses the configured zone independently of the host', () => {
    const zone = createScheduleResolver({
      ...defaultSettings,
      timezone: 'America/New_York',
    });
    expect(zone(Date.parse('2026-10-16T11:00:00Z'))).toBe('morning');
    expect(resolve(Date.parse('2026-10-16T11:00:00Z'))).toBe('photos');
  });
  it('skips nonexistent spring minutes and repeats autumn minutes identically', () => {
    const dst = createScheduleResolver({
      ...defaultSettings,
      schedule: [{start: '02:15', end: '03:00', mode: 'photos'}],
    });
    expect(dst(Date.parse('2026-03-29T00:59:59Z'))).toBe('morning');
    expect(dst(Date.parse('2026-03-29T01:00:00Z'))).toBe('morning');
    for (const time of ['00:15', '01:15', '00:59', '01:59']) {
      expect(dst(Date.parse(`2026-10-25T${time}:00Z`))).toBe('photos');
    }

    expect(dst(Date.parse('2026-10-25T02:00:00Z'))).toBe('morning');
  });
  it.each([
    null,
    {timezone: 'bad/zone'},
    {schedule: []},
    {
      schedule: [
        {start: '23:00', end: '02:00', mode: 'night'},
        {start: '01:00', end: '03:00', mode: 'photos'},
      ],
    },
  ])('falls back to Morning for invalid configuration %j', (value) => {
    expect(createScheduleResolver(value)(Date.now())).toBe('morning');
  });
  it('falls back in gaps and for invalid time', () => {
    expect(
      createScheduleResolver({
        ...defaultSettings,
        schedule: [{start: '10:00', end: '11:00', mode: 'photos'}],
      })(Date.parse('2026-10-16T09:00:00Z')),
    ).toBe('morning');
    expect(resolve(NaN)).toBe('morning');
  });
});

it('expires at inactivity boundary, counts resume, renews on touch and stays per display', () => {
  const state = createModeState({
    ...defaultSettings,
    overrideTimeoutSeconds: 30,
  });
  const wall = Date.parse('2026-10-16T06:30:00Z');
  state.interact(wall, 0, 'photos');
  expect(state.mode(wall + 29_999, 29_999)).toBe('photos');
  state.interact(wall + 29_999, 29_999);
  expect(state.mode(wall + 59_998, 59_998)).toBe('photos');
  expect(state.mode(wall + 59_999, 59_999)).toBe('morning');
  state.interact(wall, 0, 'night');
  expect(createModeState().mode(wall, 0)).toBe('morning');
  expect(state.mode(wall + 300_000, 0)).toBe('morning');
});
it('recomputes on forward/backward clock changes and configuration refresh', () => {
  const state = createModeState({
    ...defaultSettings,
    overrideTimeoutSeconds: 30,
  });
  const wall = Date.parse('2026-10-16T06:30:00Z');
  state.interact(wall, 0, 'photos');
  expect(state.mode(wall - 3_600_000, 30_000)).toBe('morning');
  expect(state.mode(wall + 12 * 3_600_000, 31_000)).toBe('photos');
  state.configure({...defaultSettings, timezone: 'America/New_York'});
  expect(state.mode(wall, 32_000)).toBe('night');
  state.interact(wall, 32_000, 'photos');
  expect(state.mode(wall + 3_600_000, 33_000)).toBe('night');
});

it('applies a shortened inactivity timeout without renewing the override', () => {
  const state = createModeState();
  const wall = Date.parse('2026-10-16T06:30:00Z');
  state.interact(wall, 0, 'photos');
  expect(state.mode(wall + 40_000, 40_000)).toBe('photos');
  state.configure({...defaultSettings, overrideTimeoutSeconds: 30});
  expect(state.mode(wall + 40_000, 40_000)).toBe('morning');
});
