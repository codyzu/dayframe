import {locationRequest, validateLocation} from './location.ts';

export function positionCity(value: unknown): string | undefined {
  const features = (value as {features?: unknown} | undefined)?.features;
  if (!Array.isArray(features) || features.length !== 1) {
    return undefined;
  }

  const properties = (
    features[0] as {properties?: Record<string, unknown>} | undefined
  )?.properties;
  const name = properties?.name;
  if (
    typeof name !== 'string' ||
    properties?.osm_key !== 'place' ||
    !['city', 'town', 'village', 'hamlet'].includes(
      String(properties.osm_value),
    ) ||
    name.trim().length === 0 ||
    name.length > 140 ||
    /[\p{Control}\p{Format}]/v.test(name)
  ) {
    return undefined;
  }

  return name.trim();
}

export async function resolvePosition(
  coordinates: Pick<GeolocationCoordinates, 'latitude' | 'longitude'>,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  // Validate before sending. Keep browser precision; provider grid/city centres
  // must never replace the position used for weather or its cache key.
  const position = validateLocation({
    location: 'Ma position',
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    timezone: 'UTC',
    source: 'geolocation',
  });
  const {latitude, longitude} = position;
  const forecast = new URL('https://api.open-meteo.com/v1/forecast');
  forecast.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone: 'auto',
    forecast_days: '1',
    current: 'temperature_2m',
  }).toString();
  const reverse = new URL('https://photon.komoot.io/reverse');
  reverse.search = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    lang: 'fr',
    layer: 'city',
    radius: '10',
    limit: '1',
  }).toString();
  const [data, city] = await Promise.all([
    locationRequest(forecast, signal) as Promise<{timezone?: unknown}>,
    // Naming is optional. Slow/failed/unsupported lookups still offer weather.
    locationRequest(reverse, signal, 4000)
      .then(positionCity)
      .catch(() => undefined),
  ]);
  signal.throwIfAborted();
  const location = validateLocation({
    ...position,
    timezone: data.timezone,
    location:
      city === undefined
        ? 'Ma position'
        : `Près ${/^[aeiouyàâäæèéêëîïôöùûüœ]/iv.test(city) ? 'd’' : 'de '}${city}`,
  });
  return {
    ...location,
    label: `${location.location} · ${city === undefined ? 'ville indisponible' : 'ville estimée'}`,
  };
}
