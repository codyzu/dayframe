// IDs only: history never retains image pixels or extends their privacy lease.
export function createPhotoHistory(limit = 30) {
  let ids: string[] = [];
  let cursor = -1;
  return {
    get current() {
      return ids[cursor];
    },
    get previous() {
      return ids[cursor - 1];
    },
    get next() {
      return ids[cursor + 1];
    },
    visit(id: string, direction: 'next' | 'previous' | 'resume') {
      if (id === ids[cursor]) {
        return;
      }

      if (direction === 'previous' && id === ids[cursor - 1]) {
        cursor--;
      } else if (id === ids[cursor + 1]) {
        cursor++;
      } else {
        ids = [...ids.slice(0, cursor + 1), id].slice(-limit);
        cursor = ids.length - 1;
      }
    },
    reconcile(available: Set<string>) {
      const before = ids.slice(0, cursor + 1).filter((id) => available.has(id));
      const after = ids.slice(cursor + 1).filter((id) => available.has(id));
      ids = [...before, ...after];
      cursor = before.length - 1;
    },
    clear() {
      ids = [];
      cursor = -1;
    },
  };
}
