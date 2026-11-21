export type MassageWindow = [start: number, end: number];
export type MassageSnapshot = {fetchedAt: number; windows: MassageWindow[]};

export const arrivalBuffer = 10 * 60_000;
export const departureBuffer = 30 * 60_000;
export const massageSnapshotLifetime = 5 * 60_000;
export const maxMassageWindows = 2500;

export function isDuringMassage([start, end]: MassageWindow, now: number) {
  return start <= now && now < end;
}

export function activeMassageWindows(windows: MassageWindow[], now: number) {
  return windows.filter((window) => isDuringMassage(window, now));
}

export function validateMassageSnapshot(value: unknown): MassageSnapshot {
  const snapshot = value as Partial<MassageSnapshot> | undefined;
  if (
    !Number.isSafeInteger(snapshot?.fetchedAt) ||
    !Array.isArray(snapshot?.windows) ||
    snapshot.windows.length > maxMassageWindows ||
    snapshot.windows.some(
      (window) =>
        !Array.isArray(window) ||
        window.length !== 2 ||
        window.some((time: unknown) => !Number.isSafeInteger(time)) ||
        window[0] >= window[1],
    )
  ) {
    throw new Error('Horaires des massages indisponibles.');
  }

  return snapshot as MassageSnapshot;
}
