// Clipboard contents are read only after an explicit user gesture; never parse HTML.
export function mountClipboardImport(
  root: HTMLElement,
  importFiles: (files: File[]) => Promise<void>,
) {
  const paste = root.querySelector<HTMLButtonElement>('[data-import-paste]')!;
  const choose = root.querySelector<HTMLButtonElement>('[data-choose-files]')!;
  const fallback = root.querySelector<HTMLDetailsElement>(
    '[data-import-fallback]',
  )!;
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

  let sourceCount = 0;
  let batchStart = 0;
  let batchEnd = 0;
  let isClipboard = true;
  let selectedFiles: File[] = [];
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
      files.length === batchEnd - batchStart
    );
  }

  function update() {
    const hasStaged = files.length > 0;
    const isContinuing = sourceCount > 0 && batchStart < sourceCount;
    paste.disabled = !isEnabled || isReading || isPreviewing;
    paste.hidden = hasStaged;
    paste.textContent =
      isContinuing && batchStart > 0
        ? isClipboard
          ? 'Coller les suivantes'
          : 'Préparer les suivantes'
        : 'Coller des photos';
    choose.hidden = hasStaged || (isContinuing && batchStart > 0);
    choose.disabled = !isEnabled || isReading || isPreviewing;
    clear.hidden = !hasStaged && !isContinuing;
    clear.disabled = !isEnabled || isReading || isPreviewing;
    add.hidden = !hasStaged;
    add.disabled = !isEnabled || isReading || isPreviewing || !complete();
    zone.contentEditable = String(isEnabled && !isReading && !isPreviewing);
    status.hidden = (status.textContent ?? '').trim() === '';
  }

  function explain(message: string) {
    status.textContent = message;
    fallback.hidden = !isClipboard;
    update();
  }

  function reset() {
    generation++;
    files = [];
    batchEnd = batchStart;
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
          image.alt = `Photo à importer ${batchStart + index + 1}`;
          image.className =
            'h-32 w-full object-contain rounded-lg bg-background';
          previews.append(image);
          status.textContent = `Aperçu ${index + 1} sur ${batch.length}…`;
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
        explain(
          'Une photo ne peut pas être lue. Choisissez une version JPEG ou PNG, ou relancez le partage avec le raccourci Dayframe PNG.',
        );
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
        ? ''
        : complete()
          ? `${files.length} photo${files.length > 1 ? 's' : ''} sur ${sourceCount} prête${files.length > 1 ? 's' : ''} à ajouter${batchStart > 0 ? ` · ${batchStart} déjà traitée${batchStart > 1 ? 's' : ''}` : ''}.`
          : `${sourceCount} photo(s) reçue(s) sur ${expected.value} attendue(s). Relancez le raccourci ou essayez le collage manuel.`;
    if (complete()) {
      fallback.hidden = true;
      fallback.open = false;
    } else if (files.length > 0) {
      fallback.hidden = !isClipboard;
    }

    update();
  }

  function selectRange(itemCount: number) {
    if (itemCount !== sourceCount && batchStart > 0) {
      explain(
        'Le nombre de photos du presse-papiers a changé. Annulez puis recommencez le collage.',
      );
      return;
    }

    sourceCount = itemCount;
    if (itemCount > 100) {
      explain('Choisissez au maximum 100 photos à la fois.');
      return;
    }

    return {start: batchStart, end: Math.min(batchStart + 10, itemCount)};
  }

  function receive(blobs: Blob[], itemCount: number) {
    if (blobs.length !== itemCount || blobs.length === 0) {
      explain(
        'Aucune image lisible. Utilisez le raccourci Dayframe PNG ou essayez le collage manuel.',
      );
      return;
    }

    const oversized = blobs.findIndex((blob) => blob.size > 40 * 1024 * 1024);
    if (oversized !== -1) {
      explain(
        `La photo ${batchStart + oversized + 1} dépasse la limite de 40 Mio par photo. Partagez une version plus petite. ${isClipboard ? 'Les autres photos restent dans le presse-papiers.' : 'Annulez pour refaire votre sélection.'}`,
      );
      return;
    }

    const bytes = blobs.reduce((sum, blob) => sum + blob.size, 0);
    if (bytes > 100_000_000) {
      explain(
        `Le lot fait ${Math.ceil(bytes / 1_000_000)} Mo : la limite est de 100 Mo par lot.`,
      );
      return;
    }

    batchEnd = batchStart + blobs.length;
    files = blobs.map((blob, index) =>
      blob instanceof File
        ? blob
        : new File([blob], `Photo ${batchStart + index + 1}`, {
            type: blob.type,
          }),
    );
    void showPreviews();
  }

  // Preserve clipboard order. Inspect at most one next image that does not fit;
  // never retain that lookahead in the staged group or advance past it.
  function shouldStartNextGroup(blob: Blob, accepted: Blob[]) {
    return (
      accepted.length > 0 &&
      (!blob.type.startsWith('image/') ||
        blob.size > 40 * 1024 * 1024 ||
        accepted.reduce((sum, item) => sum + item.size, 0) + blob.size >
          100_000_000)
    );
  }

  function readClipboard() {
    if (!isEnabled || isReading || isPreviewing) {
      return;
    }

    if (batchStart >= sourceCount && sourceCount > 0) {
      startSelection();
    }

    if (!isClipboard) {
      stageSelected();
      return;
    }

    reset();
    if (typeof navigator.clipboard?.read !== 'function') {
      explain('Utilisez la zone de collage ci-dessous.');
      fallback.open = true;
      return;
    }

    const run = generation;
    // Keep this call inside the click gesture, before any await or API request.
    const pending = navigator.clipboard.read();
    isReading = true;
    status.textContent = 'Choisissez Coller si votre iPhone le demande…';
    update();
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
            break;
          }

          const blob = await item.getType(type);
          if (run !== generation || !isEnabled) {
            return;
          }

          if (shouldStartNextGroup(blob, blobs)) {
            break;
          }

          blobs.push(blob);
          if (blob.size > 40 * 1024 * 1024) {
            break;
          }
        }

        receive(blobs, blobs.length);
      } catch {
        if (run === generation) {
          explain(
            'Collage refusé ou indisponible. Réessayez ou utilisez le collage manuel.',
          );
        }
      } finally {
        isReading = false;
        update();
      }
    })();
  }

  paste.addEventListener('click', readClipboard);
  zone.addEventListener('paste', (event) => {
    event.preventDefault();
    if (!isEnabled || isReading || isPreviewing) {
      return;
    }

    if (!isClipboard || batchStart >= sourceCount) {
      startSelection();
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
      if (
        shouldStartNextGroup(file, images) ||
        !file.type.startsWith('image/')
      ) {
        break;
      }

      images.push(file);
      if (file.size > 40 * 1024 * 1024) {
        break;
      }
    }

    receive(images, images.length);
  });
  function startSelection() {
    sourceCount = 0;
    batchStart = 0;
    selectedFiles = [];
    isClipboard = true;
    expected.value =
      queryCount === null
        ? ''
        : /^[1-9]\d{0,2}$/v.test(queryCount) && Number(queryCount) <= 100
          ? queryCount
          : '0';
    fallback.hidden = true;
    fallback.open = false;
    reset();
  }

  function stageSelected() {
    reset();
    const images: File[] = [];
    for (const file of selectedFiles.slice(batchStart, batchStart + 10)) {
      if (shouldStartNextGroup(file, images)) {
        break;
      }

      images.push(file);
      if (file.size > 40 * 1024 * 1024) {
        break;
      }
    }

    receive(images, images.length);
  }

  clear.addEventListener('click', () => {
    startSelection();
    describe();
  });
  add.addEventListener('click', () => {
    if (!isEnabled || isReading || isPreviewing || !complete()) {
      return;
    }

    const batch = files;
    batchStart += batch.length;
    reset();
    status.textContent = 'Ajout en cours…';
    update();
    void importFiles(batch).finally(() => {
      status.textContent =
        batchStart < sourceCount
          ? `${sourceCount - batchStart} photo${sourceCount - batchStart > 1 ? 's' : ''} restante${sourceCount - batchStart > 1 ? 's' : ''}.`
          : '';
      if (batchStart >= sourceCount) {
        selectedFiles = [];
      }

      update();
    });
  });
  globalThis.addEventListener('pagehide', startSelection);
  const setAllowed = (isAllowed: boolean) => {
    if (!isAllowed && isEnabled) {
      generation++;
      isPreviewing = false;
      hasValidPreviews = false;
      releasePreviews();
    }

    const isChanged = isEnabled !== isAllowed;
    isEnabled = isAllowed;
    if (isChanged && isAllowed) {
      void showPreviews();
    }

    update();
  };

  return {
    setAllowed,
    stageFiles(picked: File[]) {
      if (!isEnabled || isReading || isPreviewing || picked.length === 0) {
        return;
      }

      startSelection();
      isClipboard = false;
      selectedFiles = picked;
      // The Shortcut's count applies only to clipboard inputs.
      expected.value = '';
      if (selectRange(picked.length)) {
        stageSelected();
      }
    },
  };
}
