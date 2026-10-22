// Exact dashboard variants shared by registration and the navigation worker.
export function isDashboardUrl(url: URL) {
  if (url.pathname !== '/' || url.username !== '' || url.password !== '') {
    return false;
  }

  const seen = new Set<string>();
  for (const [key, value] of url.searchParams) {
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    if (
      (key === 'display' && value === 'frame') ||
      (key === 'density' && ['standard', 'large'].includes(value))
    ) {
      continue;
    }

    return false;
  }

  return true;
}
