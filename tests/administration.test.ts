import {describe, expect, it} from 'vitest';
import {isHomeNetwork} from '../worker/auth/network.ts';
import {
  Administration,
  type AdministrationStorage,
} from '../worker/administration.ts';
import {
  defaultSettings,
  validateSettings,
} from '../src/lib/dashboard/settings.ts';

describe('settings and home address validation', () => {
  it('defaults missing settings and validates overnight half-open schedules', () => {
    expect(validateSettings({})).toEqual(defaultSettings);
    expect(
      validateSettings({
        schedule: [
          {start: '21:00', end: '06:00', mode: 'night'},
          {start: '06:00', end: '21:00', mode: 'photos'},
        ],
      }).schedule,
    ).toHaveLength(2);
    for (const schedule of [
      [],
      [{start: '00:00', end: '00:00', mode: 'photos'}],
      [{start: '24:00', end: '06:00', mode: 'night'}],
      [{start: '06:00', end: '07:00', mode: 'admin'}],
      [null],
    ]) {
      expect(() => validateSettings({schedule})).toThrow();
    }
  });
  it('compares complete IPv4 addresses and IPv6 prefixes, failing closed on invalid configuration', () => {
    const request = (ip: string) =>
      new Request('https://example.test', {headers: {'CF-Connecting-IP': ip}});
    expect(isHomeNetwork(request('192.0.2.1'), '192.0.2.1')).toBe(true);
    expect(isHomeNetwork(request('192.0.2.2'), '192.0.2.1')).toBe(false);
    expect(
      isHomeNetwork(
        request('2001:db8:1234:5678::1'),
        '2001:db8:1234:5600::/56',
      ),
    ).toBe(true);
    expect(
      isHomeNetwork(
        request('2001:db8:1234:5778::1'),
        '2001:db8:1234:5600::/56',
      ),
    ).toBe(false);
    expect(
      isHomeNetwork(request('::ffff:192.0.2.1'), '::ffff:c000:201/128'),
    ).toBe(true);
    for (const networks of [
      undefined,
      '',
      '0.0.0.0/0',
      '192.0.2.0/24',
      '::/0',
      '2001:db8::/129',
      '192.0.2.1,bad',
      '192.0.2.1/32/junk',
      '192.0.2.1/32/',
    ]) {
      expect(isHomeNetwork(request('192.0.2.1'), networks)).toBe(false);
    }

    for (const ip of [
      '1.2.3',
      '999.2.3.4',
      '::1%eth0',
      '1:2:3:4:5:6:7',
      '1:2:3:4:5:6:7:8:9',
      ':::1',
    ]) {
      expect(isHomeNetwork(request(ip), '192.0.2.1,2001:db8::/48')).toBe(false);
    }
  });
  it('rejects expired credentials using server time even if stored state remains readable', async () => {
    const expired = {
      settings: defaultSettings,
      credential: {digest: 'a'.repeat(64), issuedAt: 1, expiresAt: 2},
    };
    const storage: AdministrationStorage = {
      async get<T>() {
        return expired as T;
      },
      async put() {
        return undefined;
      },
      async transaction<T>(
        callback: (store: AdministrationStorage) => Promise<T>,
      ): Promise<T> {
        return callback(storage);
      },
    };
    const object = new Administration({storage});
    const request = new Request('https://internal/verify', {
      method: 'POST',
      body: JSON.stringify('a'.repeat(64)),
    });
    const response = await object.fetch(request);
    expect(await response.json()).toMatchObject({valid: false});
  });
});
