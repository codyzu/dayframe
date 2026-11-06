/* eslint-disable unicorn/no-await-expression-member -- Inline assertions keep lookup results readable. */
import {afterEach, describe, expect, it, vi} from 'vitest';
import {photoCoordinates} from '../src/lib/photos/gps.ts';
import {
  isPhotoPlace,
  placeFromInput,
  captureEditorValues,
  captureTimestampFromEditor,
} from '../src/lib/photos/place.ts';
import {createPlaceLookup} from '../src/lib/photos/place-lookup.ts';
import {gpsJpeg, gpsPng} from './fixtures/photo-gps.ts';

const file = (lat = 45.8992, lon = 6.1294) =>
  new File([gpsJpeg(lat, lon)], 'synthetic.jpeg', {type: 'image/jpeg'});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('photo capture location', () => {
  it('preserves camera-local precision and offset through human-friendly edits without guessing a timezone', () => {
    for (const timestamp of [
      '2024-03-01',
      '2024-03-01T14:30',
      '2024-03-01T14:30Z',
      '2024-03-01T14:30:06.123456789+02:00',
    ]) {
      const fields = captureEditorValues(timestamp);
      expect(captureTimestampFromEditor(timestamp, fields)).toBe(timestamp);
      expect(
        captureTimestampFromEditor(timestamp, {...fields, day: '2024-02-29'}),
      ).toBe(timestamp.replace('2024-03-01', '2024-02-29'));
      expect(
        captureTimestampFromEditor(timestamp, {...fields, day: ''}),
      ).toBeUndefined();
    }

    expect(
      captureTimestampFromEditor('2024-03-01T14:30Z', {
        day: '2024-03-01',
        time: '14:30:00',
        offset: 'Z',
      }),
    ).toBe('2024-03-01T14:30Z');
    expect(
      captureTimestampFromEditor(undefined, {
        day: '2024-03-01',
        time: '14:30',
        offset: '',
      }),
    ).toBe('2024-03-01T14:30');
    expect(
      captureTimestampFromEditor('2024-03-01T14:30Z', {
        day: '2024-03-01',
        time: '',
        offset: 'Z',
      }),
    ).toBe('2024-03-01');
    expect(() =>
      captureTimestampFromEditor(undefined, {
        day: '2024-03-01',
        time: '14:30',
        offset: 'Europe/Paris',
      }),
    ).toThrow('Décalage');
  });

  it('reads JPEG byte orders, hemisphere references and zero coordinates', () => {
    for (const isLittle of [true, false]) {
      for (const [lat, lon] of [
        [45.8992, 6.1294],
        [-33.8688, -151.2093],
        [0, 0],
      ]) {
        const value = photoCoordinates(gpsJpeg(lat, lon, isLittle).buffer)!;
        expect(value.latitude).toBeCloseTo(lat, 6);
        expect(value.longitude).toBeCloseTo(lon, 6);
      }
    }
  });
  it('reads PNG eXIf while refusing truncated, invalid and out-of-range metadata', () => {
    const base = new Uint8Array(45);
    base.set([137, 80, 78, 71, 13, 10, 26, 10]);
    new DataView(base.buffer).setUint32(8, 13);
    base.set([73, 72, 68, 82], 12);
    expect(photoCoordinates(gpsPng(base).buffer)?.latitude).toBeCloseTo(
      45.8992,
      6,
    );
    const jpeg = gpsJpeg();
    for (let index = 0; index < jpeg.length; index++) {
      expect(photoCoordinates(jpeg.slice(0, index).buffer)).toBeUndefined();
    }

    expect(photoCoordinates(gpsJpeg(91, 181).buffer)).toBeUndefined();
    const corrupted = gpsJpeg();
    new DataView(corrupted.buffer).setUint32(16, 0xff_ff_ff_ff, true);
    expect(photoCoordinates(corrupted.buffer)).toBeUndefined();
    expect(
      photoCoordinates(new Uint8Array([255, 216, 255, 217]).buffer),
    ).toBeUndefined();
  });
  it('accepts only bounded plain place labels and no coordinate fields', () => {
    expect(placeFromInput(' Annecy ')).toEqual({
      label: 'Annecy',
      source: 'manual',
    });
    expect(placeFromInput('')).toBeUndefined();
    for (const label of ['<script>', 'a\nplace', 'x'.repeat(161)]) {
      expect(() => placeFromInput(label)).toThrow();
    }

    expect(
      isPhotoPlace({label: 'Annecy', source: 'manual', latitude: 45}),
    ).toBe(false);
  });
  it('deduplicates lookups, omits credentials/referrer, and never retries throttling', async () => {
    const fetcher = vi.fn(async () =>
      Response.json({
        features: [
          {properties: {name: 'Annecy', osm_key: 'place', osm_value: 'town'}},
        ],
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    const service = createPlaceLookup();
    const {signal} = new AbortController();
    expect((await service.lookup(file(), signal)).place?.label).toBe('Annecy');
    await service.lookup(file(), signal);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]).toEqual([
      expect.any(URL),
      expect.objectContaining({
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        redirect: 'error',
      }),
    ]);
    const throttled = vi.fn(async () => new Response(null, {status: 429}));
    vi.stubGlobal('fetch', throttled);
    const paused = createPlaceLookup();
    expect((await paused.lookup(file(), signal)).place).toBeUndefined();
    expect((await paused.lookup(file(48, 2), signal)).place).toBeUndefined();
    expect(throttled).toHaveBeenCalledTimes(1);
  });
  it('skips missing GPS and rejects an already-aborted lookup', async () => {
    const fetcher = vi.fn(async () => Response.json({features: []}));
    vi.stubGlobal('fetch', fetcher);
    const service = createPlaceLookup();
    const controller = new AbortController();
    await service.lookup(new File(['no GPS'], 'a.png'), controller.signal);
    expect(fetcher).not.toHaveBeenCalled();
    controller.abort();
    await expect(service.lookup(file(), controller.signal)).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

it('caps a page at 100 provider lookups', async () => {
  vi.useFakeTimers();
  const fetcher = vi.fn(async () => Response.json({features: []}));
  vi.stubGlobal('fetch', fetcher);
  const service = createPlaceLookup();
  const {signal} = new AbortController();
  for (let index = 0; index < 101; index++) {
    vi.setSystemTime(1_800_000_000_000 + index * 1001);
    await service.lookup(file(40 + index / 1000, 6), signal);
  }

  expect(fetcher).toHaveBeenCalledTimes(100);
});

it('does not repopulate the coordinate cache with an aborted late provider response', async () => {
  const {promise, resolve: finish} = Promise.withResolvers<Response>();
  const fetcher = vi.fn(async () => promise);
  vi.stubGlobal('fetch', fetcher);
  const service = createPlaceLookup();
  const controller = new AbortController();
  const pending = service.lookup(file(), controller.signal);
  await vi.waitFor(() => {
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  controller.abort();
  service.clear();
  finish(
    Response.json({
      features: [
        {properties: {name: 'Annecy', osm_key: 'place', osm_value: 'town'}},
      ],
    }),
  );
  await expect(pending).rejects.toThrow();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({features: []})),
  );
  await service.lookup(file(), new AbortController().signal);
  expect(fetch).toHaveBeenCalledOnce();
});
