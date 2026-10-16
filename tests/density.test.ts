import {describe, expect, it} from 'vitest';
import {selectDensity} from '../src/lib/dashboard/density.ts';

describe('display-density precedence', () => {
  it('defaults to Standard unless provisioned as a frame', () => {
    expect(selectDensity('', undefined)).toBe('standard');
    expect(selectDensity('?display=frame', undefined)).toBe('large');
  });
  it('uses saved preferences ahead of the device profile', () => {
    expect(selectDensity('?display=frame', 'standard')).toBe('standard');
    expect(selectDensity('', 'large')).toBe('large');
  });
  it('accepts explicit overrides and ignores invalid choices', () => {
    expect(selectDensity('?density=standard&display=frame', 'large')).toBe(
      'standard',
    );
    expect(selectDensity('?density=large', 'standard')).toBe('large');
    expect(selectDensity('?density=huge', 'invalid')).toBe('standard');
  });
});
