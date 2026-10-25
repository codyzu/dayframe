// Clipboard contents are read only after an explicit user gesture; never parse HTML.
export function mountClipboardImport(
  root: HTMLElement,
  importFiles: (files: File[]) => Promise<void>,
) {
  const paste = root.querySelector<HTMLButtonElement>('[data-import-paste]')!;
  const add = root.querySelector<HTMLButtonElement>('[data-import-add]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-import-clear]')!;
  const zone = root.querySelector<HTMLElement>('[data-import-zone]')!;
  const status = root.querySelector<HTMLElement>('[data-import-status]')!;
  const previews = root.querySelector<HTMLElement>('[data-import-previews]')!;
  const expected = root.querySelector<HTMLInputElement>(
    '[data-import-expected]',
  )!;
  const queryCount = new URL(location.href).searchParams.get('expected');
  if (queryCount !== null) {
    expected.readOnly = true;
    expected.value =
      /^[1-9]0?$/v.test(queryCount) && Number(queryCount) <= 10
        ? queryCount
        : '0';
  }

  if (new URL(location.href).searchParams.get('import') === 'clipboard') {
    root.querySelector<HTMLDetailsElement>('[data-clipboard-import]')!.open =
      true;
  }

  let isEnabled = false;
  let isReading = false;
  let isPreviewing = false;
  let hasValidPreviews = false;
  let generation = 0;
  let files: File[] = [];
  let urls: string[] = [];
  function releasePreviews() {
    previews.replaceChildren();
    for (const url of urls) {
      URL.revokeObjectURL(url);
    }

    urls = [];
  }

  function complete() {
    const wanted = Number(expected.value);
    return (
      hasValidPreviews &&
      files.length > 0 &&
      (expected.value === '' ||
        (Number.isSafeInteger(wanted) &&
          wanted >= 1 &&
          wanted <= 10 &&
          wanted === files.length))
    );
  }

  function update() {
    paste.disabled = !isEnabled || isReading || isPreviewing;
    add.disabled = !isEnabled || isReading || isPreviewing || !complete();
    zone.contentEditable = String(isEnabled && !isReading && !isPreviewing);
    expected.disabled = isReading;
  }

  function reset() {
    generation++;
    files = [];
    hasValidPreviews = false;
    isPreviewing = false;
    releasePreviews();
    zone.replaceChildren();
    update();
  }

  async function showPreviews() {
    releasePreviews();
    hasValidPreviews = false;
    if (!isEnabled || files.length === 0) {
      update();
      return;
    }

    const run = generation;
    const batch = files;
    isPreviewing = true;
    status.textContent = 'Préparation des aperçus…';
    update();
    try {
      for (const [index, file] of batch.entries()) {
        const source = new Image();
        const sourceUrl = URL.createObjectURL(file);
        try {
          source.src = sourceUrl;
          await source.decode();
          if (run !== generation) {
            return;
          }

          const scale = Math.min(
            1,
            320 / Math.max(source.naturalWidth, source.naturalHeight),
          );
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error('Aperçu indisponible.');
          }

          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          const thumbnail = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Aperçu indisponible.'));
              }
            }, 'image/png');
          });
          if (run !== generation) {
            return;
          }

          const image = document.createElement('img');
          const url = URL.createObjectURL(thumbnail);
          urls.push(url);
          image.src = url;
          image.alt = `Photo à importer ${index + 1}`;
          image.className =
            'h-32 w-full object-contain rounded-lg bg-background';
          previews.append(image);
        } finally {
          URL.revokeObjectURL(sourceUrl);
          source.removeAttribute('src');
        }
      }

      hasValidPreviews = true;
      describe();
    } catch {
      if (run === generation) {
        releasePreviews();
        status.textContent =
          'Une photo ne peut pas être lue. Relancez le partage avec moins de photos ou utilisez Ajouter des photos.';
      }
    } finally {
      if (run === generation) {
        isPreviewing = false;
        update();
      }
    }
  }

  function describe() {
    status.textContent =
      files.length === 0
        ? 'Collez les photos, vérifiez les aperçus, puis ajoutez-les à la collection.'
        : `${files.length} photo(s) reçue(s)${expected.value === '' ? '' : ` sur ${expected.value} attendue(s)`}. ${complete() ? 'Vérifiez les aperçus avant l’ajout.' : 'Lot incomplet : essayez le collage manuel ou relancez le raccourci PNG.'}`;
    update();
  }

  function receive(blobs: Blob[], itemCount: number) {
    if (blobs.length !== itemCount || blobs.length === 0) {
      status.textContent =
        'Certaines images sont illisibles. Utilisez le raccourci PNG ou le collage manuel. Aucun ajout effectué.';
      return;
    }

    if (
      blobs.length > 10 ||
      blobs.some((blob) => blob.size > 40 * 1024 * 1024) ||
      blobs.reduce((sum, blob) => sum + blob.size, 0) > 100_000_000
    ) {
      status.textContent =
        'Lot trop volumineux : 10 photos maximum, 40 Mio par photo et 100 Mo par lot. Partagez moins de photos.';
      return;
    }

    files = blobs.map(
      (blob, index) =>
        new File([blob], `Photo partagée ${index + 1}`, {type: blob.type}),
    );
    void showPreviews();
  }

  paste.addEventListener('click', () => {
    if (!isEnabled || isReading) {
      return;
    }

    reset();
    if (typeof navigator.clipboard?.read !== 'function') {
      status.textContent = 'Utilisez la zone de collage manuel ci-dessous.';
      return;
    }

    const run = generation;
    // Keep this call inside the click gesture, before any await or API request.
    const pending = navigator.clipboard.read();
    isReading = true;
    update();
    status.textContent = 'Choisissez Coller si votre iPhone le demande…';
    void (async () => {
      try {
        const items = await pending;
        if (run !== generation || !isEnabled) {
          return;
        }

        if (items.length > 10) {
          throw new Error(
            'Lot trop volumineux. Partagez au maximum 10 photos.',
          );
        }

        const blobs: Blob[] = [];
        for (const item of items) {
          const type = item.types.includes('image/png')
            ? 'image/png'
            : item.types.find((type) => type.startsWith('image/'));
          if (type !== undefined) {
            blobs.push(await item.getType(type));
          }

          if (run !== generation || !isEnabled) {
            return;
          }
        }

        receive(blobs, items.length);
      } catch {
        if (run === generation) {
          status.textContent =
            'Collage refusé ou indisponible. Réessayez ou utilisez le collage manuel.';
        }
      } finally {
        isReading = false;
        update();
      }
    })();
  });
  zone.addEventListener('paste', (event) => {
    event.preventDefault();
    if (!isEnabled || isReading) {
      return;
    }

    reset();
    const pasted = [...(event.clipboardData?.files ?? [])];
    receive(
      pasted.filter((file) => file.type.startsWith('image/')),
      pasted.length,
    );
  });
  expected.addEventListener('input', describe);
  clear.addEventListener('click', () => {
    reset();
    describe();
  });
  add.addEventListener('click', () => {
    if (!isEnabled || isReading || isPreviewing || !complete()) {
      return;
    }

    const batch = files;
    reset();
    status.textContent =
      'Lot transmis à l’envoi. Suivez les résultats ci-dessous.';
    void importFiles(batch);
  });
  globalThis.addEventListener('pagehide', reset);
  return (isAllowed: boolean) => {
    if (!isAllowed && isEnabled) {
      generation++;
      isPreviewing = false;
      hasValidPreviews = false;
      releasePreviews();
    }

    const isChanged = isEnabled !== isAllowed;
    isEnabled = isAllowed;
    if (isChanged && isAllowed) {
      if (status.textContent?.trim().startsWith('Connectez-vous')) {
        describe();
      }

      void showPreviews();
    }

    update();
  };
}
