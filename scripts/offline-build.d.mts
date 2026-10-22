export function buildOffline(directory: URL): Promise<void>;
export function startupGuard(): string;
export function buildNavigation(
  directory: URL,
  buildId: string,
  isRetired?: boolean,
): Promise<void>;
