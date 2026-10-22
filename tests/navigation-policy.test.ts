import {test, expect} from 'vitest';
import {isDashboardUrl} from '../src/lib/offline/navigation-policy.ts';
import {createModeState} from '../src/lib/dashboard/schedule.ts';

test('dashboard interception uses exact paths and known, non-duplicated parameters only', () => {
  for (const path of [
    '/',
    '/?display=frame',
    '/?density=large',
    '/?density=standard&display=frame',
  ]) {
    expect(isDashboardUrl(new URL(path, 'https://example.test'))).toBe(true);
  }

  for (const path of [
    '/index.html',
    '/setup',
    '/admin/photos',
    '/api/photos',
    '/version.json',
    '/?unknown=1',
    '/?display=admin',
    '/?density=small',
    '/?density=large&density=standard',
    '/?display=frame&display=frame',
    '/?display=frame&token=secret',
  ]) {
    expect(isDashboardUrl(new URL(path, 'https://example.test'))).toBe(false);
  }
});

test('update override transfer preserves only remaining inactivity and rejects expiry/backward clocks', () => {
  const initial = createModeState();
  initial.interact(1000, 1000, 'night');
  const saved = initial.snapshot(61_000, 61_000);
  expect(saved).toEqual({mode: 'night', savedAt: 61_000, remaining: 240_000});
  const restored = createModeState();
  restored.restore(saved, 62_000, 0);
  expect(restored.mode(62_000, 0)).toBe('night');
  expect(restored.snapshot(302_000, 240_000)).toBeUndefined();
  restored.restore({...saved, savedAt: NaN}, 62_000, 0);
  for (const now of [60_000, 302_000]) {
    const denied = createModeState();
    denied.restore(saved, now, 0);
    expect(denied.snapshot(now, 0)).toBeUndefined();
  }
});
