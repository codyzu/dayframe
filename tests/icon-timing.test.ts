import {expect, it} from 'vitest';
import collection from '@iconify-json/meteocons/icons.json';
import {repairMeteoconsTiming} from '../src/lib/weather/icon-timing.ts';

it('preserves valid cross-animation links and independently repeating artwork', () => {
  const body =
    '<animate id="x1" begin="0s" dur="1s"/>' +
    '<animate id="other" begin="0s; x1.end+.33s" dur=".67s"/>' +
    '<animateTransform dur="6s" repeatCount="indefinite"/>';
  expect(repairMeteoconsTiming(body)).toBe(body);
  expect(repairMeteoconsTiming(collection.icons['clear-day-fill'].body)).toBe(
    collection.icons['clear-day-fill'].body,
  );
});

it('rejects unknown dangling timing instead of guessing its intended target', () => {
  expect(() =>
    repairMeteoconsTiming(
      '<animate id="new" begin="missing.end+1s" dur="1s"/>',
    ),
  ).toThrow('Unresolved Meteocons animation ID: missing');
});

it('repairs shared restart events without redirecting them to the follower', () => {
  const body =
    '<animateTransform id="renamed" begin=".5s; x1.end+1.33s" dur="1.67s"/>' +
    '<animate begin=".5s; x1.end+1.33s" dur="1.67s"/>';
  expect(repairMeteoconsTiming(body)).toBe(
    body.replaceAll('x1.end', 'renamed.end'),
  );
  expect(() =>
    repairMeteoconsTiming(
      body + '<animate id="conflict" begin="0s; x1.end+1s" dur="1s"/>',
    ),
  ).toThrow('Ambiguous Meteocons animation ID: x1');
});

it('keeps simultaneous radius and opacity animations on their shared loop', () => {
  const body =
    '<animate id="radius" begin="0s; y1.end+.75s" dur="2.25s"/>' +
    '<animate id="opacity" begin="0s; y1.end+.75s" dur="2.25s"/>';
  expect(repairMeteoconsTiming(body)).toBe(
    body.replaceAll('y1.end', 'radius.end'),
  );
});
