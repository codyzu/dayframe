import {describe, expect, it, vi} from 'vitest';
import worker from '../worker/index.ts';
import {
  formatClock,
  isDisplayMode,
  runtimeConfig,
} from '../src/lib/dashboard/config.ts';
import {dateKey, hourLabel} from '../src/lib/weather/adapter.ts';

describe('public display foundation', () => {
  it('refreshes cached clock and forecast formats after a timezone change', () => {
    const now = new Date('2026-10-16T22:30:00Z');
    const {timezone} = runtimeConfig;
    try {
      runtimeConfig.timezone = 'Europe/Paris';
      expect(formatClock(now).time).toBe('00:30');
      expect(dateKey(now.getTime())).toBe('2026-10-17');
      expect(hourLabel(now.getTime())).toBe('00:30');
      runtimeConfig.timezone = 'America/New_York';
      expect(formatClock(now).time).toBe('18:30');
      expect(formatClock(now).date).toContain('vendredi');
      expect(dateKey(now.getTime())).toBe('2026-10-16');
      expect(hourLabel(now.getTime())).toBe('18:30');
    } finally {
      runtimeConfig.timezone = timezone;
    }
  });
  it('formats real time in Paris independently of the host timezone', () => {
    expect(formatClock(new Date('2026-01-16T07:05:00Z')).time).toBe('08:05');
    expect(formatClock(new Date('2026-07-16T07:05:00Z')).time).toBe('09:05');
    expect(isDisplayMode('admin')).toBe(false);
  });
});

describe('Worker boundary', () => {
  const assets = {fetch: vi.fn(async () => new Response('fixture asset'))};
  const env = {ASSETS: assets, DEPLOYMENT_STAGE: 'test'};
  it('serves only non-sensitive health information', async () => {
    const response = await worker.fetch(
      new Request('https://example.test/api/health'),
      env,
    );
    expect(await response.json()).toEqual({
      ok: true,
      service: 'dayframe',
      stage: 'test',
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('rejects health mutations and supports HEAD', async () => {
    const response = await worker.fetch(
      new Request('https://example.test/api/health', {method: 'POST'}),
      env,
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET, HEAD');
    const head = await worker.fetch(
      new Request('https://example.test/api/health', {method: 'HEAD'}),
      env,
    );
    expect(await head.text()).toBe('');
  });
  it.each([
    '/api',
    '/api/photos',
    '/api/photos/example',
    '/api/config',
    '/api/missing',
  ])('never falls through to assets: %s', async (path) => {
    assets.fetch.mockClear();
    for (const method of ['GET', 'POST', 'DELETE', 'PATCH']) {
      const response = await worker.fetch(
        new Request(`https://example.test${path}`, {method}),
        env,
      );
      expect(response.status).toBe(404);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      expect(response.headers.get('Content-Type')).toContain(
        'application/json',
      );
    }

    expect(assets.fetch).not.toHaveBeenCalled();
  });
  it('delegates ordinary asset requests', async () => {
    const response = await worker.fetch(
      new Request('https://example.test/'),
      env,
    );
    expect(await response.text()).toBe('fixture asset');
  });
});
