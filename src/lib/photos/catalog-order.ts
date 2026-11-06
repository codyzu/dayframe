import {type PhotoMetadata} from './contracts.ts';

// Newest selection first; preserve source order within a selection, including
// after refresh. Legacy photos retain their server upload dates and ID tie-break.
export function newestPhotos(photos: PhotoMetadata[]) {
  const dates = new Map<string, number>();
  for (const photo of photos) {
    const group = photo.importGroup ?? photo.id;
    dates.set(
      group,
      Math.max(dates.get(group) ?? 0, Date.parse(photo.uploadedAt)),
    );
  }

  return photos.toSorted((a, b) => {
    const aGroup = a.importGroup ?? a.id;
    const bGroup = b.importGroup ?? b.id;
    const difference =
      aGroup === bGroup
        ? (a.importIndex ?? 0) - (b.importIndex ?? 0)
        : dates.get(bGroup)! - dates.get(aGroup)!;
    if (difference !== 0) {
      return difference;
    }

    const groupDifference = aGroup.localeCompare(bGroup);
    return groupDifference === 0 ? a.id.localeCompare(b.id) : groupDifference;
  });
}
