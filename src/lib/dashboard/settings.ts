import {
  emptyPlanning,
  weekdays,
  type DayPlanning,
  type RoutinePoint,
} from './day-planning.ts';
import {displayConfig, isDisplayMode, type DisplayMode} from './config.ts';

export type Settings = {
  timezone: string;
  location: string;
  latitude: number;
  longitude: number;
  slideshowIntervalSeconds: number;
  overrideTimeoutSeconds: number;
  fit: 'contain' | 'cover';
  planning: DayPlanning;
  schedule: Array<{start: string; end: string; mode: DisplayMode}>;
};
export const defaultSettings: Settings = {
  timezone: displayConfig.timezone,
  location: displayConfig.location,
  latitude: displayConfig.latitude,
  longitude: displayConfig.longitude,
  slideshowIntervalSeconds: displayConfig.slideshowIntervalSeconds,
  overrideTimeoutSeconds: displayConfig.overrideTimeoutSeconds,
  fit: 'cover',
  planning: emptyPlanning,
  schedule: displayConfig.schedule.map((entry) => ({...entry})),
};
const keys = Object.keys(defaultSettings);
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/v;
const minute = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));

export function validateSettings(value: unknown): Settings {
  const invalid = () =>
    new Error(
      'Réglages invalides : vérifiez les valeurs et les horaires sans chevauchement.',
    );
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid();
  }

  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !keys.includes(key))) {
    throw invalid();
  }

  const result = {...defaultSettings, ...input};
  // Older saved/exported schedules retain their times; retired Home periods show Photos.
  // Copy changed entries so reading settings never mutates the persisted/input object.
  if (Array.isArray(result.schedule)) {
    result.schedule = result.schedule.map((entry) => {
      const mode: unknown = entry?.mode;
      return mode === 'home' ? {...entry, mode: 'photos'} : entry;
    });
  }

  validateScalarSettings(result);
  validateSchedule(result.schedule);
  validatePlanning(result.planning);

  // Reconstruct the response so unknown/private fields never reach display clients.
  return Object.fromEntries(
    keys.map((key) => [key, result[key as keyof Settings]]),
  ) as Settings;
}

function isIntegerBetween(value: number, minimum: number, maximum: number) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function validateScalarSettings(result: Settings) {
  const invalid = () => new Error('Réglages invalides.');
  if (
    typeof result.timezone !== 'string' ||
    result.timezone.length > 100 ||
    typeof result.location !== 'string' ||
    result.location.trim() === '' ||
    result.location.length > 100 ||
    !Number.isFinite(result.latitude) ||
    Math.abs(result.latitude) > 90 ||
    !Number.isFinite(result.longitude) ||
    Math.abs(result.longitude) > 180 ||
    !isIntegerBetween(result.slideshowIntervalSeconds, 5, 3600) ||
    !isIntegerBetween(result.overrideTimeoutSeconds, 30, 86_400) ||
    !['contain', 'cover'].includes(result.fit) ||
    !Array.isArray(result.schedule) ||
    result.schedule.length === 0 ||
    result.schedule.length > 24
  ) {
    throw invalid();
  }

  try {
    new Intl.DateTimeFormat('fr-FR', {timeZone: result.timezone}).format();
  } catch {
    throw invalid();
  }
}

function validateSchedule(schedule: Settings['schedule']) {
  const invalid = () => new Error('Horaires invalides ou en chevauchement.');
  const occupied = new Set<number>();
  for (const entry of schedule) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      Object.keys(entry).toSorted().join(',') !== 'end,mode,start' ||
      typeof entry.start !== 'string' ||
      typeof entry.end !== 'string' ||
      !timePattern.test(entry.start) ||
      !timePattern.test(entry.end) ||
      !isDisplayMode(entry.mode) ||
      entry.start === entry.end
    ) {
      throw invalid();
    }

    const start = minute(entry.start);
    const duration = (minute(entry.end) - start + 1440) % 1440;
    for (let offset = 0; offset < duration; offset++) {
      const slot = (start + offset) % 1440;
      if (occupied.has(slot)) {
        throw invalid();
      }

      occupied.add(slot);
    }
  }
}

function validatePlanning(planning: DayPlanning) {
  const invalid = () => new Error('Programme des jours invalide.');
  if (
    planning === null ||
    typeof planning !== 'object' ||
    Array.isArray(planning) ||
    Object.keys(planning).toSorted().join(',') !==
      'checkpoints,schedules,schoolCalendar' ||
    typeof planning.schoolCalendar !== 'boolean'
  ) {
    throw invalid();
  }

  for (const map of [planning.schedules, planning.checkpoints]) {
    if (
      map === null ||
      typeof map !== 'object' ||
      Array.isArray(map) ||
      Object.keys(map).some((key) => ![...weekdays, 'dayOff'].includes(key))
    ) {
      throw invalid();
    }
  }

  for (const schedule of Object.values(planning.schedules)) {
    if (
      !Array.isArray(schedule) ||
      schedule.length === 0 ||
      schedule.length > 24
    ) {
      throw invalid();
    }

    validateSchedule(schedule);
  }

  for (const points of Object.values(planning.checkpoints)) {
    if (!Array.isArray(points) || points.length === 0 || points.length > 4) {
      throw invalid();
    }

    validateCheckpoints(points);
  }
}

function validateCheckpoints(points: RoutinePoint[]) {
  let previous = '';
  for (const point of points) {
    if (
      point === null ||
      typeof point !== 'object' ||
      Object.keys(point).some((key) => !['time', 'label'].includes(key)) ||
      typeof point.time !== 'string' ||
      !timePattern.test(point.time) ||
      point.time <= previous ||
      typeof point.label !== 'string' ||
      point.label.trim() === '' ||
      point.label.length > 40
    ) {
      throw new Error('Repères météo invalides ou horaires non ordonnés.');
    }

    previous = point.time;
  }
}
