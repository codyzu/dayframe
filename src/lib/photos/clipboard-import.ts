import {photoCaptureTimestamp} from './gps.ts';
import {createPlaceLookup} from './place-lookup.ts';
import {type PhotoImport, type PhotoPlace} from './place.ts';
import {type ImportProgress} from './import-progress.ts';

// Native paste supplies the metadata-preserving iPhone representation.
// Never read clipboard HTML, text, URLs or the asynchronous Clipboard API.
export function mountClipboardImport(
  root: HTMLElement,
  options: {
    importFiles: (files: PhotoImport[]) => Promise<void>;
    knownPlace: (file: File) => Promise<PhotoPlace | undefined>;
    onSelection: () => void;
    onPreparing: (isPreparing: boolean) => void;
    progress: ImportProgress;
  },
) {
  const choose = root.querySelector<HTMLButtonElement>('[data-choose-files]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-import-clear]')!;
  const zone = root.querySelector<HTMLElement>('[data-import-zone]')!;
  const target = root.querySelector<HTMLElement>('[data-import-target]')!;
  const heading = root.querySelector<HTMLElement>('[data-paste-heading]')!;
  const status = root.querySelector<HTMLElement>('[data-import-status]')!;
  const consent = root.querySelector<HTMLInputElement>(
    '[data-photo-location-consent]',
  )!;
  const recovery = root.querySelector<HTMLButtonElement>(
    '[data-recover-locations]',
  )!;
  const lookup = createPlaceLookup();
  const {progress} = options;
  const query = new URL(location.href).searchParams;
  const expected = query.get('expected');
  const expectedCount = expected === null ? undefined : Number(expected);
  let sourceCount = 0;
  let batchStart = 0;
  let selectionId = crypto.randomUUID();
  let isClipboard = true;
  let selectedFiles: File[] = [];
  let isEnabled = false;
  let isPreparing = false;
  let generation = 0;
  let controller = new AbortController();

  function update() {
    const isContinuing = batchStart > 0 && batchStart < sourceCount;
    choose.disabled = !isEnabled || isPreparing;
    consent.disabled = !isEnabled || isPreparing;
    recovery.disabled = !isEnabled || isPreparing;
    clear.hidden = !isPreparing && !isContinuing;
    clear.disabled = !isEnabled;
    zone.contentEditable = String(isEnabled && !isPreparing);
    zone.setAttribute('aria-disabled', String(!isEnabled || isPreparing));
    target.classList.toggle('opacity-50', !isEnabled || isPreparing);
    heading.textContent = isContinuing
      ? `Encore ${sourceCount - batchStart} photo${sourceCount - batchStart > 1 ? 's' : ''} : collez les suivantes ici`
      : query.get('import') === 'clipboard'
        ? 'Vos photos sont prêtes à être ajoutées'
        : 'Collez vos photos ici';
    status.hidden = status.textContent === '';
  }

  function reset() {
    generation++;
    controller.abort();
    controller = new AbortController();
    isPreparing = false;
    options.onPreparing(false);
    zone.replaceChildren();
    progress.clearImage();
  }

  function startSelection() {
    reset();
    sourceCount = 0;
    batchStart = 0;
    selectionId = crypto.randomUUID();
    selectedFiles = [];
    isClipboard = true;
    status.textContent = '';
    progress.clear();
    update();
  }

  function explain(message: string) {
    status.textContent = message;
    progress.show(batchStart, 'Sélection à vérifier');
    update();
  }

  function selectRange(itemCount: number) {
    if (itemCount > 100) {
      explain('Choisissez au maximum 100 photos à la fois.');
      return;
    }

    if (itemCount !== sourceCount && batchStart > 0) {
      explain(
        'Le nombre de photos du presse-papiers a changé. Annulez puis recommencez le collage.',
      );
      return;
    }

    if (
      isClipboard &&
      expectedCount !== undefined &&
      (expectedCount !== itemCount ||
        !Number.isSafeInteger(expectedCount) ||
        expectedCount < 1 ||
        expectedCount > 100)
    ) {
      explain(
        `${itemCount} photo(s) reçue(s) sur ${expected} attendue(s). Relancez le raccourci puis collez à nouveau.`,
      );
      return;
    }

    if (itemCount === 0) {
      explain(
        'Aucune image lisible. Utilisez le raccourci Dayframe PNG ou choisissez des photos JPEG ou PNG.',
      );
      return;
    }

    if (sourceCount === 0) {
      options.onSelection();
      progress.begin(itemCount);
    }

    sourceCount = itemCount;
    return {start: batchStart, end: Math.min(batchStart + 10, itemCount)};
  }

  async function receive(source: File[]) {
    const range = selectRange(source.length);
    if (!range) {
      return;
    }

    const files: File[] = [];
    let bytes = 0;
    for (const file of source.slice(range.start, range.end)) {
      if (
        files.length > 0 &&
        (!file.type.startsWith('image/') ||
          file.size > 40 * 1024 * 1024 ||
          bytes + file.size > 100_000_000)
      ) {
        break;
      }

      if (!file.type.startsWith('image/')) {
        explain(
          'Une photo ne peut pas être lue. Choisissez une version JPEG ou PNG, ou utilisez le raccourci Dayframe PNG.',
        );
        return;
      }

      if (file.size > 40 * 1024 * 1024) {
        explain(
          `La photo ${batchStart + 1} dépasse la limite de 40 Mio par photo (${(file.size / (1024 * 1024)).toFixed(1)} Mio reçus). Annulez puis choisissez une version plus petite.`,
        );
        return;
      }

      files.push(file);
      bytes += file.size;
    }

    const run = generation;
    const {signal} = controller;
    isPreparing = true;
    options.onPreparing(true);
    status.textContent = '';
    update();
    const entries: PhotoImport[] = [];
    try {
      for (const [index, file] of files.entries()) {
        progress.preview(file);
        progress.show(
          batchStart,
          `Préparation de la photo ${batchStart + index + 1}`,
        );
        const entry: PhotoImport = {
          file,
          importGroup: selectionId,
          importIndex: batchStart + index,
          capturedAt: photoCaptureTimestamp(await file.arrayBuffer()),
        };
        signal.throwIfAborted();
        if (consent.checked) {
          progress.show(
            batchStart,
            `Recherche du lieu · photo ${batchStart + index + 1}`,
          );
          const known = await options.knownPlace(file);
          signal.throwIfAborted();
          const result = known
            ? {place: known}
            : await lookup.lookup(file, signal);
          entry.place = result.place;
        }

        signal.throwIfAborted();
        entries.push(entry);
      }

      if (run !== generation || !isEnabled) {
        return;
      }

      isPreparing = false;
      options.onPreparing(false);
      progress.clearImage();
      // Advance only a validated group, keeping the full source order on repaste.
      batchStart += entries.length;
      await options.importFiles(entries);
      if (run !== generation) {
        return;
      }

      if (batchStart < sourceCount) {
        if (isClipboard) {
          progress.show(
            batchStart,
            'Collez les photos suivantes pour continuer',
          );
          status.textContent =
            'Maintenez le doigt dans la zone puis touchez Coller pour continuer avec le même presse-papiers.';
        } else if (isEnabled) {
          await receive(selectedFiles);
        }
      } else {
        selectedFiles = [];
      }
    } catch {
      if (run === generation) {
        explain(
          'Préparation impossible. Choisissez une version JPEG ou PNG, ou utilisez le raccourci Dayframe PNG.',
        );
      }
    } finally {
      if (run === generation) {
        isPreparing = false;
        options.onPreparing(false);
        update();
      }
    }
  }

  zone.addEventListener('paste', (event) => {
    event.preventDefault();
    if (!isEnabled || isPreparing) {
      return;
    }

    if (!isClipboard || batchStart >= sourceCount) {
      startSelection();
    }

    zone.replaceChildren();
    void receive([...(event.clipboardData?.files ?? [])]);
  });
  // Prevent typing or dropping rich HTML into this image-only paste surface.
  zone.addEventListener('beforeinput', (event) => {
    event.preventDefault();
  });
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
  });
  clear.addEventListener('click', startSelection);
  function clearSession() {
    lookup.clear();
    startSelection();
  }

  globalThis.addEventListener('pagehide', clearSession);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearSession();
    }
  });
  consent.addEventListener('change', () => {
    if (!consent.checked) {
      lookup.clear();
    }
  });
  update();
  return {
    setAllowed(isAllowed: boolean, isAccessLost = false) {
      if (isAccessLost) {
        clearSession();
      }

      isEnabled = isAllowed;
      update();
    },
    stageFiles(picked: File[]) {
      if (!isEnabled || isPreparing || picked.length === 0) {
        return;
      }

      startSelection();
      isClipboard = false;
      selectedFiles = picked;
      void receive(picked);
    },
    reset: startSelection,
  };
}
