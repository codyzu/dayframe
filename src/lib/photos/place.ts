export type PhotoPlace = {label: string; source: 'manual' | 'estimated'};
export type PhotoImport = {file: File; place?: PhotoPlace; capturedAt?: string};
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
