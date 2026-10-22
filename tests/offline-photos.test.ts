import {describe, expect, it} from 'vitest';
import {
  isOfflineLeaseValid,
  offlineLeaseMs,
} from '../src/lib/photos/offline.ts';

describe('offline photo retention', () => {
  const verifiedAt = Date.parse('2026-10-22T12:00:00Z');
  const lease = {verifiedAt, checkedAt: verifiedAt + 1000};
  it('expires exactly seven days after verification, independently of local reads', () => {
    expect(isOfflineLeaseValid(lease, verifiedAt + offlineLeaseMs - 1)).toBe(
      true,
    );
    expect(isOfflineLeaseValid(lease, verifiedAt + offlineLeaseMs)).toBe(false);
    expect(
      isOfflineLeaseValid(
        {...lease, checkedAt: verifiedAt + offlineLeaseMs},
        verifiedAt + offlineLeaseMs,
      ),
    ).toBe(false);
  });
  it('rejects backward and malformed persisted wall-clock evidence', () => {
    expect(isOfflineLeaseValid(lease, verifiedAt)).toBe(false);
    for (const value of [NaN, Infinity, -1, 0]) {
      expect(
        isOfflineLeaseValid({verifiedAt: value, checkedAt: value}, verifiedAt),
      ).toBe(false);
    }

    expect(
      isOfflineLeaseValid({...lease, checkedAt: verifiedAt - 1}, verifiedAt),
    ).toBe(false);
    expect(isOfflineLeaseValid(lease, NaN)).toBe(false);
  });
});
