import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {alertsFixture} from './fixtures/alerts.ts';

describe('public official warning feed boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-16T06:30:00Z'));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  const request = () => new Request('https://example.test/api/weather-alerts');

  it('shares a bounded fixed-host request and caches the unchanged national XML briefly', async () => {
    const xml = alertsFixture([{}]);
    const fetch = vi.fn(
      async () =>
        new Response(xml, {headers: {'Content-Type': 'application/atom+xml'}}),
    );
    vi.stubGlobal('fetch', fetch);
    const {weatherAlertsApi, alertsFeedUrl} =
      await import('../worker/weather-alerts.ts');
    const [first, second] = await Promise.all([
      weatherAlertsApi(request()),
      weatherAlertsApi(request()),
    ]);
    expect(await first.text()).toBe(xml);
    expect(await second.text()).toBe(xml);
    expect(first.headers.get('Cache-Control')).toBe('public, max-age=120');
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      alertsFeedUrl,
      expect.objectContaining({redirect: 'manual', headers: {Accept: '*/*'}}),
    );
    await weatherAlertsApi(request());
    expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(120_001);
    await weatherAlertsApi(request());
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects mutations without contacting a provider', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const {weatherAlertsApi} = await import('../worker/weather-alerts.ts');
    const response = await weatherAlertsApi(
      new Request(request(), {method: 'POST'}),
    );
    expect(response.status).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    () =>
      new Response(null, {
        status: 302,
        headers: {Location: 'https://untrusted.test'},
      }),
    () =>
      new Response('<html>not a feed</html>', {
        headers: {'Content-Type': 'text/html'},
      }),
    () =>
      new Response('<feed>truncated', {
        headers: {'Content-Type': 'application/xml'},
      }),
    () =>
      new Response('x'.repeat(2_000_001), {
        headers: {'Content-Type': 'application/xml'},
      }),
  ])(
    'returns an unavailable response for redirects, wrong types, truncated and oversized bodies',
    async (response) => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => response()),
      );
      const {weatherAlertsApi} = await import('../worker/weather-alerts.ts');
      const result = await weatherAlertsApi(request());
      expect(result.status).toBe(503);
      expect(result.headers.get('Cache-Control')).toBe('no-store');
    },
  );
});
