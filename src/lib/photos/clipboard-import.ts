// Clipboard contents are read only after an explicit user gesture; never parse HTML.
export function mountClipboardImport(
  root: HTMLElement,
  importFiles: (files: File[]) => Promise<void>,
) {
  const paste = root.querySelector<HTMLButtonElement>('[data-import-paste]')!;
  const small = root.querySelector<HTMLButtonElement>('[data-import-small]')!;
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
      /^[1-9]\d{0,2}$/v.test(queryCount) && Number(queryCount) <= 100
        ? queryCount
        : '0';
  }

  if (new URL(location.href).searchParams.get('import') === 'clipboard') {
    root.querySelector<HTMLDetailsElement>('[data-clipboard-import]')!.open =
      true;
  }

  let sourceCount = 0;
  let batchStart = 0;
  let batchEnd = 0;
  let groupBytes = 0;
  let isAdaptiveBatch = false;
  let canSplit = false;
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
          wanted <= 100 &&
          wanted === sourceCount)) &&
      files.length === (isAdaptiveBatch ? batchEnd - batchStart : sourceCount)
    );
  }

  function update() {
    const isFinished = isAdaptiveBatch && batchStart >= sourceCount;
    paste.disabled = !isEnabled || isReading || isPreviewing || isFinished;
    paste.textContent =
      isAdaptiveBatch && !isFinished
        ? `Coller à partir de la photo ${batchStart + 1}`
        : 'Coller les photos';
    small.hidden = !canSplit;
    small.disabled = !isEnabled || isReading || isPreviewing;
    add.disabled = !isEnabled || isReading || isPreviewing || !complete();
    zone.contentEditable = String(isEnabled && !isReading && !isPreviewing);
    expected.disabled = isReading;
  }

  function reset() {
    generation++;
    files = [];
    batchEnd = batchStart;
    groupBytes = 0;
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
    const size =
      groupBytes >= 1_000_000
        ? `${Math.round(groupBytes / 1_000_000)} Mo`
        : `${Math.ceil(groupBytes / 1000)} ko`;
    status.textContent =
      files.length === 0
        ? 'Collez les photos, vérifiez les aperçus, puis ajoutez-les à la collection.'
        : `${isAdaptiveBatch ? `Photos ${batchStart + 1} à ${batchStart + files.length} sur ${sourceCount} · ${size} : ` : ''}${files.length} photo(s) reçue(s)${isAdaptiveBatch || expected.value === '' ? '' : ` sur ${expected.value} attendue(s)`}. ${complete() ? 'Vérifiez les aperçus avant l’ajout.' : 'Lot incomplet : essayez le collage manuel ou relancez le raccourci PNG.'}`;
    update();
  }

  function tooLarge(message: string) {
    canSplit = !isAdaptiveBatch && sourceCount > 1;
    status.textContent = `${message} Aucun ajout effectué. ${canSplit ? 'Le collage n’a pas vidé le presse-papiers : utilisez les petits lots ci-dessous sans retourner dans Photos.' : 'Le presse-papiers est conservé. Cette photo doit être partagée dans une version plus petite.'}`;
    update();
  }

  function selectRange(itemCount: number) {
    if (isAdaptiveBatch && itemCount !== sourceCount) {
      status.textContent =
        'Le nombre de photos du presse-papiers a changé. Effacez le lot puis recommencez le collage.';
      return;
    }

    sourceCount = itemCount;
    if (itemCount > 100) {
      status.textContent = 'Partagez au maximum 100 photos à la fois.';
      return;
    }

    if (!isAdaptiveBatch && itemCount > 10) {
      tooLarge(`${itemCount} photos reçues : la limite est de 10 par lot.`);
      return;
    }

    return {
      start: isAdaptiveBatch ? batchStart : 0,
      end: isAdaptiveBatch ? Math.min(batchStart + 10, itemCount) : itemCount,
    };
  }

  function receive(blobs: Blob[], itemCount: number) {
    if (blobs.length !== itemCount || blobs.length === 0) {
      status.textContent =
        'Certaines images sont illisibles. Utilisez le raccourci PNG ou le collage manuel. Aucun ajout effectué.';
      return;
    }

    const oversized = blobs.findIndex((blob) => blob.size > 40 * 1024 * 1024);
    if (oversized !== -1) {
      tooLarge(
        `La photo ${batchStart + oversized + 1} dépasse la limite de 40 Mio par photo.`,
      );
      return;
    }

    const bytes = blobs.reduce((sum, blob) => sum + blob.size, 0);
    if (bytes > 100_000_000) {
      tooLarge(
        `Le lot fait ${Math.ceil(bytes / 1_000_000)} Mo : la limite est de 100 Mo par lot.`,
      );
      return;
    }

    canSplit = false;
    batchEnd = batchStart + blobs.length;
    groupBytes = bytes;
    files = blobs.map(
      (blob, index) =>
        new File([blob], `Photo partagée ${batchStart + index + 1}`, {
          type: blob.type,
        }),
    );
    void showPreviews();
  }

  // Preserve clipboard order. Inspect at most one next image that does not fit;
  // never retain that lookahead in the staged group or advance past it.
  function shouldStartNextGroup(blob: Blob, accepted: Blob[]) {
    return (
      isAdaptiveBatch &&
      accepted.length > 0 &&
      (!blob.type.startsWith('image/') ||
        blob.size > 40 * 1024 * 1024 ||
        accepted.reduce((sum, item) => sum + item.size, 0) + blob.size >
          100_000_000)
    );
  }

  function readClipboard() {
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

        const range = selectRange(items.length);
        if (!range) {
          return;
        }

        const selected = items.slice(range.start, range.end);
        const blobs: Blob[] = [];
        for (const item of selected) {
          const type = item.types.includes('image/png')
            ? 'image/png'
            : item.types.find((type) => type.startsWith('image/'));
          if (type === undefined) {
            if (isAdaptiveBatch) {
              break;
            }

            continue;
          }

          const blob = await item.getType(type);
          if (run !== generation || !isEnabled) {
            return;
          }

          if (shouldStartNextGroup(blob, blobs)) {
            break;
          }

          blobs.push(blob);
          if (isAdaptiveBatch && blob.size > 40 * 1024 * 1024) {
            break;
          }
        }

        receive(blobs, isAdaptiveBatch ? blobs.length : selected.length);
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
  }

  paste.addEventListener('click', readClipboard);
  small.addEventListener('click', () => {
    if (!isEnabled || isReading || isPreviewing) {
      return;
    }

    isAdaptiveBatch = true;
    batchStart = 0;
    canSplit = false;
    readClipboard();
  });
  zone.addEventListener('paste', (event) => {
    event.preventDefault();
    if (!isEnabled || isReading) {
      return;
    }

    reset();
    const pasted = [...(event.clipboardData?.files ?? [])];
    const range = selectRange(pasted.length);
    if (!range) {
      return;
    }

    const selected = pasted.slice(range.start, range.end);
    const images: Blob[] = [];
    for (const file of selected) {
      if (shouldStartNextGroup(file, images)) {
        break;
      }

      if (!file.type.startsWith('image/')) {
        if (isAdaptiveBatch) {
          break;
        }

        continue;
      }

      images.push(file);
      if (isAdaptiveBatch && file.size > 40 * 1024 * 1024) {
        break;
      }
    }

    receive(images, isAdaptiveBatch ? images.length : selected.length);
  });
  expected.addEventListener('input', describe);
  clear.addEventListener('click', () => {
    sourceCount = 0;
    batchStart = 0;
    isAdaptiveBatch = false;
    canSplit = false;
    reset();
    describe();
  });
  add.addEventListener('click', () => {
    if (!isEnabled || isReading || isPreviewing || !complete()) {
      return;
    }

    const batch = files;
    if (isAdaptiveBatch) {
      batchStart += batch.length;
    }

    reset();
    status.textContent = isAdaptiveBatch
      ? `Lot transmis à l’envoi. ${batchStart < sourceCount ? `Collez les photos suivantes, jusqu’à ${sourceCount} au total. Ne copiez rien d’autre avant la fin.` : 'Toutes les photos ont été transmises. Vérifiez les résultats ci-dessous.'}`
      : 'Lot transmis à l’envoi. Suivez les résultats ci-dessous.';
    void importFiles(batch);
  });
  globalThis.addEventListener('pagehide', () => {
    sourceCount = 0;
    batchStart = 0;
    isAdaptiveBatch = false;
    canSplit = false;
    reset();
  });
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
