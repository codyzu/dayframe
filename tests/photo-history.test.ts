import {describe, expect, it} from 'vitest';
import {createPhotoHistory} from '../src/lib/photos/history.ts';

describe('bounded viewing history', () => {
  it('retraces actual views before continuing and preserves the cursor on resume', () => {
    const history = createPhotoHistory();
    for (const id of ['a', 'c', 'b']) {
      history.visit(id, 'next');
    }

    expect(history.previous).toBe('c');
    history.visit('c', 'previous');
    history.visit('c', 'resume');
    expect(history.current).toBe('c');
    expect(history.next).toBe('b');
    history.visit('b', 'next');
    expect(history.next).toBeUndefined();
    history.visit('d', 'next');
    expect(history.previous).toBe('b');
  });

  it('bounds IDs, skips deleted entries and clears all history on invalidation', () => {
    const history = createPhotoHistory(3);
    for (const id of ['a', 'b', 'c', 'd']) {
      history.visit(id, 'next');
    }

    history.visit('c', 'previous');
    history.visit('b', 'previous');
    expect(history.previous).toBeUndefined();
    history.reconcile(new Set(['c', 'd']));
    expect(history.current).toBeUndefined();
    expect(history.next).toBe('c');
    history.visit('c', 'next');
    expect(history.next).toBe('d');
    history.clear();
    expect(history.current).toBeUndefined();
    expect(history.previous).toBeUndefined();
    expect(history.next).toBeUndefined();
  });

  it('does not add duplicate visits for a single-photo collection', () => {
    const history = createPhotoHistory();
    history.visit('a', 'next');
    history.visit('a', 'next');
    expect(history.previous).toBeUndefined();
  });
});
