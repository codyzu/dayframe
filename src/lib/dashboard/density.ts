export type DisplayDensity = 'standard' | 'large';
export const densityKey = 'dayframe.display-density.v1';

export function isDisplayDensity(value: unknown): value is DisplayDensity {
  return value === 'standard' || value === 'large';
}

/**
Explicit URL choice, saved user choice, then application display profile.
*/
export function selectDensity(search: string, saved: unknown): DisplayDensity {
  const parameters = new URLSearchParams(search);
  const override = parameters.get('density');
  if (isDisplayDensity(override)) {
    return override;
  }

  if (isDisplayDensity(saved)) {
    return saved;
  }

  return parameters.get('display') === 'frame' ? 'large' : 'standard';
}

export function mountDensity(root: HTMLElement) {
  let saved: string | undefined;
  try {
    saved = localStorage.getItem(densityKey) ?? undefined;
  } catch {
    // Storage may be disabled; URL and in-session selection still work.
  }

  const select = root.querySelector<HTMLSelectElement>('[data-density-select]');
  function apply(density: DisplayDensity, shouldPersist = true) {
    root.dataset.density = density;
    if (select) {
      select.value = density;
    }

    if (!shouldPersist) {
      return;
    }

    try {
      localStorage.setItem(densityKey, density);
    } catch {
      // Keep the selected density for this page even without persistence.
    }
  }

  apply(
    selectDensity(location.search, saved),
    isDisplayDensity(new URLSearchParams(location.search).get('density')),
  );
  select?.addEventListener('change', () => {
    if (!isDisplayDensity(select.value)) {
      return;
    }

    // Consume provisioning overrides so a later user choice survives reload.
    const url = new URL(location.href);
    url.searchParams.delete('density');
    history.replaceState(history.state, '', url);
    apply(select.value);
  });
}
