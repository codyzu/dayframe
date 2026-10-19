import {expect, it} from 'vitest';
import collection from '@iconify-json/meteocons/icons.json';
import {expandMeteoconsSymbols} from '../src/lib/weather/icon-symbols.ts';
import {repairMeteoconsTiming} from '../src/lib/weather/icon-timing.ts';

it('expands animated artwork throughout the collection without duplicate IDs or dangling timing', () => {
  for (const [name, icon] of Object.entries(collection.icons)) {
    const body = repairMeteoconsTiming(icon.body);
    const expanded = expandMeteoconsSymbols(body);
    if (body.includes('<animate') && body.includes('<use')) {
      expect(expanded, name).not.toMatch(/<(?:use|symbol)\b/v);
      expect(expanded, name).toContain('<g');
    }

    const ids = Array.from(
      expanded.matchAll(/\bid="(?<id>[^"]+)"/gv),
      (match) => match.groups!.id,
    );
    expect(new Set(ids).size, name).toBe(ids.length);
    for (const timing of expanded.matchAll(
      /\b(?:begin|end)="(?<timing>[^"]+)"/gv,
    )) {
      for (const match of timing.groups!.timing.matchAll(
        /(?:^|;)\s*(?<target>[\w\-.]+)\.(?:begin|end)/gv,
      )) {
        expect(ids, `${name}: ${match.groups!.target}`).toContain(
          match.groups!.target,
        );
      }
    }

    expect(expandMeteoconsSymbols(expanded), name).toBe(expanded);
  }
});

it('retains view-box scaling, transforms, overflow, shared gradients and independently repeating copies', () => {
  const body =
    '<defs><linearGradient id="color"/><symbol id="sun" viewBox="0 0 10 20"><path fill="url(#color)"><animate id="spin" begin="0s;spin.end+.5s" dur="1s"/></path></symbol></defs><use id="first" href="#sun" width="20" height="40" transform="translate(2 3)"/><use href="#sun" width="10" height="20"/>';
  const expanded = expandMeteoconsSymbols(body);
  expect(expanded).toContain('translate(0 0) scale(2)');
  expect(expanded).toContain('translate(0 0) scale(1)');
  expect(expanded).toContain('transform="translate(2 3)"');
  expect(expanded).toContain('overflow="visible"');
  expect(expanded).toContain('id="first"');
  expect(expanded.match(/fill="url\(#color\)"/gv)).toHaveLength(2);
  expect(expanded).toContain('begin="0s;dayframe1_spin.end+.5s"');
  expect(expanded).toContain('begin="0s;dayframe2_spin.end+.5s"');
});

it('leaves static artwork unchanged and rejects cyclic or ambiguous timing references', () => {
  const still =
    '<defs><symbol id="a" viewBox="0 0 10 10"><path/></symbol></defs><use href="#a" width="10" height="10"/>';
  expect(expandMeteoconsSymbols(still)).toBe(still);
  expect(() =>
    expandMeteoconsSymbols(
      '<symbol id="a" viewBox="0 0 10 10"><animate/><use href="#a" width="10" height="10"/></symbol><use href="#a" width="10" height="10"/>',
    ),
  ).toThrow('Unsupported Meteocons symbol reference');
  expect(() =>
    expandMeteoconsSymbols(
      '<symbol id="a" viewBox="0 0 10 10"><animate id="spin"/></symbol><use href="#a" width="10" height="10"/><use href="#a" width="10" height="10"/><animate begin="spin.end"/>',
    ),
  ).toThrow('Ambiguous expanded Meteocons timing');
});
