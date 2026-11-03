export type PhotoPlace = {label: string; source: 'manual' | 'estimated'};
export type PhotoImport = {file: File; place?: PhotoPlace};
export type PlaceRecord = {
  revision: string;
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
