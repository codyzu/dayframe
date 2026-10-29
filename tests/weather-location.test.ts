import {describe, expect, it} from 'vitest';
import {
  locationKey,
  parseLocations,
  readLocation,
  validateLocation,
} from '../src/lib/weather/location.ts';

const location = {
  location: 'Annecy',
  latitude: 45.8992,
  longitude: 6.1294,
  timezone: 'Europe/Paris',
};

describe('device weather location', () => {
  it('validates and reconstructs only weather fields', () => {
    expect(validateLocation({...location, secret: 'excluded'})).toEqual(
      location,
    );
    for (const invalid of [
      null,
      [],
      {},
      {...location, latitude: NaN},
      {...location, latitude: 91},
      {...location, longitude: -181},
      {...location, latitude: '45'},
      {...location, timezone: 'invalid'},
      {...location, location: ''},
      {...location, location: '\u{202E}evil'},
      {...location, location: 'x'.repeat(161)},
    ]) {
      expect(() => validateLocation(invalid)).toThrow();
    }
  });

  it('ignores absent, corrupt and inaccessible storage', () => {
    expect(readLocation()).toBeUndefined();
    expect(readLocation({getItem: () => '{'})).toBeUndefined();
    expect(
      readLocation({
        getItem() {
          throw new Error('denied');
        },
      }),
    ).toBeUndefined();
    expect(
      readLocation({
        getItem: (key) =>
          key === locationKey ? JSON.stringify(location) : null,
      }),
    ).toEqual(location);
  });

  it('keeps disambiguating names and rejects malformed provider results', () => {
    expect(
      parseLocations({
        results: [
          {
            ...location,
            name: 'Annecy',
            admin1: 'Auvergne-Rhône-Alpes',
            country: 'France',
          },
        ],
      }),
    ).toEqual([{...location, label: 'Annecy, Auvergne-Rhône-Alpes, France'}]);
    expect(parseLocations({})).toEqual([]);
    expect(() => parseLocations({results: 'invalid'})).toThrow();
    expect(() => parseLocations({results: [null]})).toThrow();
    expect(() =>
      parseLocations({results: Array.from({length: 11}, () => location)}),
    ).toThrow();
  });
});
