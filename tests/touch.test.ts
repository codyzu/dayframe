import {expect, it} from 'vitest';
import {swipeDirection} from '../src/lib/dashboard/touch.ts';

it('requires deliberate horizontal intent and rejects short, vertical and slow movements', () => {
  const start = {x: 100, y: 100};
  expect(swipeDirection(start, {x: 25, y: 110}, 200)).toBe(1);
  expect(swipeDirection(start, {x: 200, y: 90}, 200)).toBe(-1);
  expect(swipeDirection(start, {x: 50, y: 100}, 200)).toBe(0);
  expect(swipeDirection(start, {x: 25, y: 170}, 200)).toBe(0);
  expect(swipeDirection(start, {x: 25, y: 100}, 1500)).toBe(0);
});
