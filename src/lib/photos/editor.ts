import {type PhotoMetadata} from './contracts.ts';
import {
  captureEditorValues,
  captureTimestampFromEditor,
  placeFromInput,
  type PhotoPlace,
} from './place.ts';

export function mountPhotoEditor(
  root: HTMLElement,
  save: (
    photo: PhotoMetadata,
    place: PhotoPlace | undefined,
    date: string | undefined,
  ) => Promise<void>,
) {
  const dialog = root.querySelector<HTMLDialogElement>('[data-photo-editor]')!;
  const form = dialog.querySelector<HTMLFormElement>('form')!;
  const image = dialog.querySelector<HTMLImageElement>('[data-editor-image]')!;
  const place = dialog.querySelector<HTMLInputElement>('[data-place-input]')!;
  const day = dialog.querySelector<HTMLInputElement>('[data-capture-date]')!;
  const time = dialog.querySelector<HTMLInputElement>('[data-capture-time]')!;
  const offset = dialog.querySelector<HTMLInputElement>(
    '[data-capture-offset]',
  )!;
  const details = dialog.querySelector<HTMLDetailsElement>(
    '[data-time-details]',
  )!;
  const timezone = dialog.querySelector<HTMLDetailsElement>(
    '[data-timezone-details]',
  )!;
  const status = dialog.querySelector<HTMLElement>('[data-editor-status]')!;
  let photo: PhotoMetadata | undefined;
  let isSaving = false;
  let returnId: string | undefined;
  function close() {
    dialog.close();
    image.removeAttribute('src');
    place.value = '';
    day.value = '';
    time.value = '';
    offset.value = '';
    status.textContent = '';
    photo = undefined;
  }

  dialog.addEventListener('close', () => {
    close();
    if (returnId !== undefined) {
      root
        .querySelector<HTMLButtonElement>(
          `[data-photo-id="${CSS.escape(returnId)}"] [data-edit-photo]`,
        )
        ?.focus({preventScroll: true});
    }
  });
  dialog.addEventListener('cancel', (event) => {
    if (isSaving) {
      event.preventDefault();
    }
  });
  dialog
    .querySelector('[data-editor-cancel]')!
    .addEventListener('click', () => {
      if (!isSaving) {
        close();
      }
    });
  const dateClear =
    dialog.querySelector<HTMLButtonElement>('[data-remove-date]')!;
  const timeClear =
    dialog.querySelector<HTMLButtonElement>('[data-remove-time]')!;
  function updateDateControls() {
    dateClear.hidden = day.value === '';
    timeClear.hidden = time.value === '';
  }

  dateClear.addEventListener('click', () => {
    day.value = '';
    time.value = '';
    offset.value = '';
    details.open = false;
    updateDateControls();
    dialog.querySelector<HTMLButtonElement>('[data-editor-save]')!.focus();
  });
  timeClear.addEventListener('click', () => {
    time.value = '';
    offset.value = '';
    updateDateControls();
    dialog.querySelector<HTMLButtonElement>('[data-editor-save]')!.focus();
  });
  day.addEventListener('input', () => {
    if (day.value === '') {
      time.value = '';
      offset.value = '';
      details.open = false;
    }

    updateDateControls();
  });
  time.addEventListener('input', updateDateControls);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!photo || isSaving) {
      return;
    }

    const current = photo;
    void (async () => {
      try {
        if (day.validity.badInput || time.validity.badInput) {
          throw new Error('Complétez la date ou l’heure, ou utilisez Retirer.');
        }

        const date = captureTimestampFromEditor(current.capturedAt, {
          day: day.value,
          time: time.value,
          offset: offset.value,
        });
        const nextPlace =
          place.value.trim() === current.place?.label
            ? current.place
            : placeFromInput(place.value);
        isSaving = true;
        for (const control of form.querySelectorAll<
          HTMLInputElement | HTMLButtonElement
        >('input, button')) {
          control.disabled = true;
        }

        status.textContent = 'Enregistrement…';
        await save(current, nextPlace, date);
        close();
      } catch (error) {
        if (dialog.open) {
          status.textContent =
            error instanceof Error
              ? error.message
              : 'Enregistrement impossible. Réessayez.';
        }
      } finally {
        isSaving = false;
        for (const control of form.querySelectorAll<
          HTMLInputElement | HTMLButtonElement
        >('input, button')) {
          control.disabled = false;
        }
      }
    })();
  });
  return {
    open(current: PhotoMetadata) {
      photo = current;
      returnId = current.id;
      const values = captureEditorValues(current.capturedAt);
      place.value = current.place?.label ?? '';
      day.value = values.day;
      time.value = values.time;
      offset.value = values.offset;
      details.open = values.time !== '';
      updateDateControls();
      timezone.open = false;
      status.textContent = '';
      image.src = `/api/photos/${current.id}`;
      dialog.showModal();
      place.focus();
    },
    clear() {
      returnId = undefined;
      close();
    },
  };
}
