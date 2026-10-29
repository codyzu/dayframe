export type WeatherLocation = {
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
};

export const locationKey = 'dayframe.weather-location.v1';

export function validateLocation(value: unknown): WeatherLocation {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid location');
  }

  const {location, latitude, longitude, timezone} = value as WeatherLocation;
  if (
    typeof location !== 'string' ||
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    typeof timezone !== 'string' ||
    location.length > 160 ||
    timezone.length > 100 ||
    location.trim().length === 0 ||
    /[\p{Control}\p{Format}]/v.test(location) ||
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180
  ) {
    throw new Error('Invalid location');
  }

  new Intl.DateTimeFormat('fr-FR', {timeZone: timezone}).format(0);
  return {location: location.trim(), latitude, longitude, timezone};
}

export function readLocation(storage?: Pick<Storage, 'getItem'>) {
  try {
    return validateLocation(
      JSON.parse(storage?.getItem(locationKey) ?? 'null'),
    );
  } catch {
    return undefined;
  }
}

export function parseLocations(
  value: unknown,
): Array<WeatherLocation & {label: string}> {
  const results = (value as {results?: unknown} | undefined)?.results;
  if (results === undefined) {
    return [];
  }

  if (!Array.isArray(results) || results.length > 10) {
    throw new Error('Invalid search results');
  }

  return results.map((entry: Record<string, unknown>) => {
    const location = validateLocation({...entry, location: entry.name});
    const label = validateLocation({
      ...location,
      location: [entry.name, entry.admin1, entry.country]
        .filter((part) => typeof part === 'string' && part.length > 0)
        .join(', '),
    }).location;
    return {...location, label};
  });
}

export async function locationRequest(url: URL, signal: AbortSignal) {
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('Location provider unavailable');
  }

  return response.json() as Promise<unknown>;
}
