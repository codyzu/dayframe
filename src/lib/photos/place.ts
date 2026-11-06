export type PhotoPlace = {label: string; source: 'manual' | 'estimated'};
export type PhotoImport = {
  file: File;
  place?: PhotoPlace;
  capturedAt?: string;
  importGroup?: string;
  importIndex?: number;
};
export type PlaceRecord = {
  revision: string;
  capturedAt?: string;
  place?: PhotoPlace;
  deleted?: boolean;
};

export function isPhotoPlace(value: unknown): value is PhotoPlace {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const place = value as PhotoPlace;
  return (
    Object.keys(place).toSorted().join(',') === 'label,source' &&
    typeof place.label === 'string' &&
    place.label === place.label.trim() &&
    place.label.length > 0 &&
    place.label.length <= 160 &&
    !/[\p{Control}\p{Format}<>]/v.test(place.label) &&
    ['manual', 'estimated'].includes(place.source)
  );
}

export function placeFromInput(label: string): PhotoPlace | undefined {
  const place: PhotoPlace = {label: label.trim(), source: 'manual'};
  if (place.label === '') {
    return undefined;
  }

  if (!isPhotoPlace(place)) {
    throw new Error('Lieu invalide : 160 caractères maximum, sans balises.');
  }

  return place;
}

const captureTimestampPattern =
  /^[1-9]\d{3}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+\-](?:[01]\d|2[0-3]):[0-5]\d)?)?$/v;

export function isCaptureTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !captureTimestampPattern.test(value)) {
    return false;
  }

  const day = value.slice(0, 10);
  const date = new Date(day);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day
  );
}

export function captureTimestampFromInputs(day: string, time: string) {
  const value = time.trim() === '' ? day : `${day}T${time.trim()}`;
  if (value === '') {
    return undefined;
  }

  if (!isCaptureTimestamp(value)) {
    throw new Error('Date ou heure de prise de vue invalide.');
  }

  return value;
}

export function captureEditorValues(timestamp?: string) {
  const tail = timestamp?.slice(11) ?? '';
  return {
    day: timestamp?.slice(0, 10) ?? '',
    time: /^\d{2}:\d{2}(?::\d{2})?/v.exec(tail)?.[0] ?? '',
    offset: /(?:Z|[+\-]\d{2}:\d{2})$/v.exec(tail)?.[0] ?? '',
  };
}

export function captureTimestampFromEditor(
  original: string | undefined,
  values: {day: string; time: string; offset: string},
) {
  if (values.day === '') {
    return undefined;
  }

  const previous = captureEditorValues(original);
  let {time} = values;
  // Native time pickers cannot represent arbitrary EXIF fractional precision.
  // Preserve it (and omitted seconds) while the displayed time is unchanged.
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const normalizedPrevious =
    previous.time.length === 5 ? `${previous.time}:00` : previous.time;
  if (
    original !== undefined &&
    time !== '' &&
    normalizedTime === normalizedPrevious
  ) {
    time = original.slice(11).replace(/(?:Z|[+\-]\d{2}:\d{2})$/v, '');
  }

  const offset = values.offset.trim();
  if (
    time !== '' &&
    offset !== '' &&
    !/^(?:Z|[+\-](?:[01]\d|2[0-3]):[0-5]\d)$/v.test(offset)
  ) {
    throw new Error(
      'Décalage UTC invalide. Utilisez +02:00, -05:00, Z ou laissez vide.',
    );
  }

  return captureTimestampFromInputs(
    values.day,
    time === '' ? '' : `${time}${offset}`,
  );
}
