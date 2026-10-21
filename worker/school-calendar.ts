import {validateSettings} from '../src/lib/dashboard/settings.ts';
import {
  calendarMaximumAge,
  frenchDate,
  type OfficialCalendar,
} from '../src/lib/dashboard/day-planning.ts';
import {failure, privateJson} from './private-response.ts';
import {administration, type AdministrationBinding} from './administration.ts';
import {readBounded} from './photos.ts';

const ministryUrl =
  'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?limit=100&refine=location%3AGrenoble&order_by=start_date%20DESC';
const nextDate = (date: string) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);

type SchoolRow = {
  description: string;
  population: string;
  start_date: string;
  end_date: string;
  location: string;
  zones: string;
  annee_scolaire: string;
};

function validateSchoolRow(row: SchoolRow) {
  if (
    row?.location !== 'Grenoble' ||
    row.zones !== 'Zone A' ||
    typeof row.description !== 'string' ||
    row.description.length > 100 ||
    typeof row.population !== 'string' ||
    !/^\d{4}-\d{4}$/v.test(row.annee_scolaire) ||
    !Number.isFinite(Date.parse(row.start_date)) ||
    !Number.isFinite(Date.parse(row.end_date))
  ) {
    throw new Error('Invalid school calendar');
  }
}

// Convert the ministry's UTC instants to Paris dates before comparing school days.
// A same-date Ascension bridge is one day; an open-ended summer is unknown beyond
// its start, rather than guessing the next rentrée. Teachers' dates are excluded.
export function normalizeSchoolCalendar(input: unknown, now: number) {
  const body = input as {total_count: number; results: SchoolRow[]};
  if (
    input === null ||
    typeof input !== 'object' ||
    !Array.isArray(body.results) ||
    !Number.isSafeInteger(body.total_count) ||
    body.total_count > 100 ||
    body.results.length !== body.total_count
  ) {
    throw new Error('Incomplete school calendar');
  }

  const date = frenchDate(now);
  const year = Number(date.slice(0, 4));
  const schoolStart = Number(date.slice(5, 7)) >= 9 ? year : year - 1;
  const schoolYear = `${schoolStart}-${schoolStart + 1}`;
  let knownUntil = `${schoolStart + 1}-09-01`;
  const vacations: OfficialCalendar['vacations'] = [];
  let hasCurrentYear = false;
  for (const row of body.results) {
    validateSchoolRow(row);

    if (
      row.population === 'Enseignants' ||
      !/vacances|pont/iv.test(row.description)
    ) {
      continue;
    }

    const start = frenchDate(Date.parse(row.start_date));
    let end = frenchDate(Date.parse(row.end_date));
    if (end < start) {
      throw new Error('Invalid school interval');
    }

    if (row.annee_scolaire === schoolYear) {
      hasCurrentYear = true;
    }

    if (start === end && /été/iv.test(row.description)) {
      if (row.annee_scolaire === schoolYear) {
        knownUntil = start;
      }

      continue;
    }

    if (start === end) {
      end = nextDate(start);
    }

    vacations.push({start, end, label: row.description});
  }

  if (!hasCurrentYear) {
    throw new Error('School year unavailable');
  }

  return {year, knownFrom: `${schoolStart}-09-01`, knownUntil, vacations};
}

export function normalizeHolidays(input: unknown, year: number) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid holidays');
  }

  const holidays = input as Record<string, string>;
  const entries = Object.entries(holidays);
  if (
    entries.length < 10 ||
    entries.length > 20 ||
    entries.some(
      ([date, label]) =>
        !new RegExp(String.raw`^${year}-\d{2}-\d{2}$`, 'v').test(date) ||
        !Number.isFinite(Date.parse(date)) ||
        typeof label !== 'string' ||
        label === '' ||
        label.length > 100,
    )
  ) {
    throw new Error('Incomplete holidays');
  }

  return holidays;
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
    headers: {Accept: 'application/json'},
  });
  if (
    !response.ok ||
    !response.headers.get('Content-Type')?.includes('application/json')
  ) {
    throw new Error('Calendar unavailable');
  }

  return JSON.parse(
    new TextDecoder().decode(await readBounded(response, 256_000)),
  ) as unknown;
}

export async function officialCalendar(
  binding: AdministrationBinding,
  now = Date.now(),
) {
  const year = Number(frenchDate(now).slice(0, 4));
  const key = `/school-calendar/${year}`;
  const response = await administration(binding, key, undefined, 'GET');
  const cached = (await response.json()) as OfficialCalendar | undefined;
  const isUsable =
    cached?.year === year &&
    now >= cached.fetchedAt &&
    now - cached.fetchedAt < calendarMaximumAge;
  const date = frenchDate(now);
  if (
    isUsable &&
    now - cached.fetchedAt < 86_400_000 &&
    date >= cached.knownFrom &&
    date < cached.knownUntil
  ) {
    return cached;
  }

  try {
    const schoolStart = frenchDate(now).slice(5, 7) >= '09' ? year : year - 1;
    const url = new URL(ministryUrl);
    url.searchParams.set(
      'where',
      `annee_scolaire in ("${schoolStart - 1}-${schoolStart}","${schoolStart}-${schoolStart + 1}")`,
    );
    const [school, holidays] = await Promise.all([
      fetchJson(url.href),
      fetchJson(
        `https://calendrier.api.gouv.fr/jours-feries/metropole/${year}.json`,
      ),
    ]);
    const calendar: OfficialCalendar = {
      ...normalizeSchoolCalendar(school, now),
      fetchedAt: now,
      holidays: normalizeHolidays(holidays, year),
    };
    await administration(binding, key, calendar, 'PATCH');
    return calendar;
  } catch {
    if (isUsable) {
      return cached;
    }

    throw new Error('Calendar unavailable');
  }
}

export async function schoolCalendarApi(
  request: Request,
  binding?: AdministrationBinding,
) {
  if (request.method !== 'GET') {
    return failure(405, 'METHOD_NOT_ALLOWED', 'Méthode non autorisée.');
  }

  if (!binding) {
    return failure(
      503,
      'CALENDAR_UNAVAILABLE',
      'Calendrier scolaire indisponible.',
    );
  }

  const config = await administration(binding, '/config', undefined, 'GET');
  const settings = validateSettings(await config.json());
  try {
    return privateJson({
      calendar: settings.planning.schoolCalendar
        ? await officialCalendar(binding)
        : null,
    });
  } catch {
    return failure(
      503,
      'CALENDAR_UNAVAILABLE',
      'Calendrier scolaire indisponible.',
    );
  }
}
