import {expect, it} from 'vitest';
import {
  agendaWindowEvents,
  dayEnd,
  type AgendaEvent,
} from '../src/lib/calendar/contracts.ts';
import {
  agendaDisplayTitle,
  agendaTimeline,
  agendaTimes,
  isBirthdayEntry,
} from '../src/lib/calendar/timeline.ts';

const timezone = 'Europe/Paris';
const now = Date.parse('2026-10-16T06:30:00Z');
const makeEvent = (
  start: string,
  calendar: AgendaEvent['calendar'] = 'family',
): AgendaEvent => ({
  title: start,
  calendar,
  start,
  end: new Date(Date.parse(start) + 3_600_000).toISOString(),
  allDay: false,
});
const today = Array.from({length: 9}, (_, i) =>
  makeEvent(
    `2026-10-16T${String(i + 9).padStart(2, '0')}:00:00Z`,
    i < 3 ? 'family' : i < 6 ? 'massages' : 'routines',
  ),
);
const tomorrow = Array.from({length: 9}, (_, i) =>
  makeEvent(
    `2026-10-17T${String(i + 9).padStart(2, '0')}:00:00Z`,
    i < 3 ? 'family' : i < 6 ? 'massages' : 'routines',
  ),
);

it('keeps the Cal.com client first and uses the booked duration only for recognized massage titles', () => {
  const booking = {
    ...makeEvent('2026-10-16T09:00:00Z', 'massages'),
    end: '2026-10-16T10:15:00Z',
    title: 'Massage 60 minutes VIP entre Studio Exemple et Camille Martin',
  };
  expect(agendaDisplayTitle(booking)).toEqual({
    title: 'Camille Martin',
    duration: '75 min',
  });
  expect(agendaDisplayTitle({...booking, calendar: 'family'}).title).toBe(
    booking.title,
  );
  for (const title of [
    'Massage libre',
    'Massage VIP entre Atelier Corps et Esprit et Camille Martin',
  ]) {
    expect(agendaDisplayTitle({...booking, title})).toEqual({
      title,
      duration: '',
    });
  }
});

it('identifies a timed appointment ending on a different local date', () => {
  const overnight = makeEvent('2026-10-16T21:30:00Z');
  expect(agendaTimes(overnight, now, timezone)).toEqual({
    start: '23:30',
    end: '–00:30 (17/10)',
  });
});

it('reserves today and a labelled divider before filling spare rows chronologically', () => {
  for (let count = 0; count <= 9; count++) {
    const preview = agendaTimeline(
      [...tomorrow.toReversed(), ...today.slice(0, count)],
      Date.parse('2026-10-16T05:59:00Z'),
      timezone,
    );
    expect(preview.today).toEqual(today.slice(0, count));
    expect(preview.shouldShowTomorrow).toBe(count < 9);
    const capacity = Math.min(4, 9 - Math.max(1, count));
    expect(preview.tomorrow).toEqual(tomorrow.slice(0, capacity));
  }

  const afterFirst = agendaTimeline(
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
      makeEvent('2026-10-16T22:30:00Z'),
      next,
      makeEvent('2026-10-18T09:00:00Z'),
    ],
    now,
    timezone,
  );
  expect(window.map(({title}) => title)).toEqual([
    'Trip',
    'Tomorrow all day',
    '2026-10-16T22:30:00Z',
  ]);
  const empty = agendaTimeline(
    [makeEvent('2026-10-18T09:00:00Z')],
    now,
    timezone,
  );
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
    const entry = makeEvent(new Date(start + 3_600_000).toISOString());
    expect(
      agendaTimeline([entry], Date.parse(date), timezone).tomorrow,
    ).toEqual([entry]);
    expect(agendaTimeline([entry], start, timezone).today[0]).toEqual(entry);
    expect(agendaTimeline([entry], start, timezone).tomorrow).toEqual([]);
  }
});

it('keeps simultaneous events and preserves ongoing appointments until they end', () => {
  const start = '2026-10-16T06:00:00Z';
  const family = {...makeEvent(start), title: 'Rendez-vous'};
  const routine = {...makeEvent(start, 'routines'), title: 'Départ'};
  expect(agendaTimeline([routine, family], now, timezone).today).toEqual([
    family,
    routine,
  ]);
  expect(
    agendaTimeline([family], Date.parse(family.end), timezone).today,
  ).toEqual([]);
});

it('marks explicitly titled all-day birthdays while leaving errands and timed events alone', () => {
  const allDay = {...today[0], allDay: true};
  for (const title of [
    'Anniversaire · Camille',
    'ÀNNIV. de Léa',
    'Birthday: Alex',
    'B-day — Ari',
    'Camille’s birthday',
    'Camille · Anniversaire',
  ]) {
    expect(isBirthdayEntry({...allDay, title})).toBe(true);
    expect(isBirthdayEntry({...today[0], title})).toBe(false);
  }

  for (const title of [
    'Acheter un gâteau d’anniversaire',
    'Pick up birthday decorations',
    'Camille birthday decorations',
    'Anniversary reminder',
  ]) {
    expect(isBirthdayEntry({...allDay, title})).toBe(false);
  }
});
