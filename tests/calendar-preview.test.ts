import {expect, it} from 'vitest';
import {
  agendaPreview,
  agendaWindowEvents,
  dayEnd,
  type AgendaEvent,
} from '../src/lib/calendar/contracts.ts';

const timezone = 'Europe/Paris';
const now = Date.parse('2026-10-16T06:30:00Z');
const event = (
  start: string,
  calendar: AgendaEvent['calendar'] = 'family',
): AgendaEvent => ({
  title: start,
  calendar,
  start,
  end: new Date(Date.parse(start) + 3_600_000).toISOString(),
  allDay: false,
});
const today = Array.from({length: 6}, (_, i) =>
  event(
    `2026-10-16T${String(i + 9).padStart(2, '0')}:00:00Z`,
    i < 3 ? 'family' : 'massages',
  ),
);
const tomorrow = Array.from({length: 6}, (_, i) =>
  event(
    `2026-10-17T${String(i + 9).padStart(2, '0')}:00:00Z`,
    i < 3 ? 'family' : 'massages',
  ),
);

it('reserves today and a labelled divider before filling spare rows chronologically', () => {
  for (let count = 0; count <= 6; count++) {
    const preview = agendaPreview(
      [...tomorrow.toReversed(), ...today.slice(0, count)],
      now,
      timezone,
    );
    expect(preview.today).toEqual(today.slice(0, count));
    expect(preview.shouldShowTomorrow).toBe(count <= 4);
    const capacity = count > 4 ? 0 : 5 - Math.max(1, count);
    expect(preview.tomorrow).toEqual(tomorrow.slice(0, capacity));
  }

  const afterFirst = agendaPreview(
    [...today.slice(0, 1), ...tomorrow],
    Date.parse('2026-10-16T10:00:00Z'),
    timezone,
  );
  expect(afterFirst.today).toEqual([]);
  expect(afterFirst.tomorrow).toHaveLength(4);
});

it('includes tomorrow all-day entries first without duplicating ongoing multi-day events or skipping to another day', () => {
  const spanning: AgendaEvent = {
    title: 'Trip',
    start: '2026-10-15',
    end: '2026-10-19',
    allDay: true,
  };
  const next: AgendaEvent = {
    title: 'Tomorrow all day',
    start: '2026-10-17',
    end: '2026-10-18',
    allDay: true,
  };
  const window = agendaWindowEvents(
    [
      spanning,
      event('2026-10-16T22:30:00Z'),
      next,
      event('2026-10-18T09:00:00Z'),
    ],
    now,
    timezone,
  );
  expect(window.map(({title}) => title)).toEqual([
    'Trip',
    'Tomorrow all day',
    '2026-10-16T22:30:00Z',
  ]);
  const empty = agendaPreview([event('2026-10-18T09:00:00Z')], now, timezone);
  expect(empty.shouldShowTomorrow).toBe(true);
  expect(empty.tomorrow).toEqual([]);
});

it('uses household local dates across DST, year changes and midnight', () => {
  for (const [date, end] of [
    ['2026-03-28T08:00:00Z', '2026-03-29T22:00:00.000Z'],
    ['2026-10-24T08:00:00Z', '2026-10-25T23:00:00.000Z'],
    ['2026-12-31T08:00:00Z', '2027-01-01T23:00:00.000Z'],
  ]) {
    const start = dayEnd(Date.parse(date), timezone);
    expect(new Date(dayEnd(start, timezone)).toISOString()).toBe(end);
    const entry = event(new Date(start + 3_600_000).toISOString());
    expect(agendaPreview([entry], Date.parse(date), timezone).tomorrow).toEqual(
      [entry],
    );
    expect(agendaPreview([entry], start, timezone).today).toEqual([entry]);
    expect(agendaPreview([entry], start, timezone).tomorrow).toEqual([]);
  }
});
