/* eslint-disable @typescript-eslint/no-loop-func -- Each card captures its own immutable photo; shared catalog updates are serialized by isBusy. */
/* eslint-disable no-alert -- Native confirmation is required before permanent deletion. */
import {ApiError, fetchCatalog, photoRequest} from './client.ts';
import {
  hammingDistance,
  isPhotoMetadata,
  storageWarningBytes,
  type PhotoMetadata,
} from './contracts.ts';
import {processPhoto} from './processing.ts';

const adminRoot = document.querySelector<HTMLElement>('[data-photo-admin]');
if (adminRoot) {
  mountAdmin(adminRoot);
}

function mountAdmin(root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-admin-status]')!;
  const login = root.querySelector<HTMLAnchorElement>('[data-admin-login]')!;
  const choose = root.querySelector<HTMLButtonElement>('[data-choose-files]')!;
  const input = root.querySelector<HTMLInputElement>('[data-photo-files]')!;
  const refreshButton =
    root.querySelector<HTMLButtonElement>('[data-refresh]')!;
  const gallery = root.querySelector<HTMLElement>('[data-photo-gallery]')!;
  const template =
    root.querySelector<HTMLTemplateElement>('[data-photo-card]')!;
  const results = root.querySelector<HTMLElement>('[data-upload-results]')!;
  const dialog = root.querySelector<HTMLDialogElement>(
    '[data-similar-dialog]',
  )!;
  const pending = new Map<string, PhotoMetadata>();
  const deleted = new Set<string>();
  let catalog: PhotoMetadata[] = [];
  let isBusy = false;
  let isAuthorized = false;
  let privacyDeadline = Date.now() + 300_000;
  const setBusy = (isBusyValue: boolean) => {
    isBusy = isBusyValue;
    choose.disabled = isBusyValue || !isAuthorized;
    refreshButton.disabled = isBusyValue;
  };

  function listen(
    target: EventTarget,
    type: string,
    handler: () => Promise<void>,
  ) {
    target.addEventListener(type, () => {
      void handler();
    });
  }

  function showError(error: unknown) {
    status.textContent =
      error instanceof Error ? error.message : 'Une erreur est survenue.';
    if (error instanceof ApiError && [401, 403].includes(error.status)) {
      isAuthorized = false;
      login.hidden = false;
      catalog = [];
      pending.clear();
      deleted.clear();
      if (dialog.open) {
        dialog.close('skip');
      }

      dialog.querySelector('[data-similar-images]')!.replaceChildren();
      render();
    }

    setBusy(isBusy);
  }

  function render() {
    gallery.replaceChildren();
    root.querySelector<HTMLElement>('[data-catalog-empty]')!.hidden =
      catalog.length > 0;
    const bytes = catalog.reduce((sum, photo) => sum + photo.size + 1024, 0);
    root.querySelector<HTMLElement>('[data-storage]')!.textContent =
      `${catalog.length} photo${catalog.length === 1 ? '' : 's'} · ${(bytes / 1_000_000).toFixed(1)} Mo / 1 000 Mo · estimation, cohérence différée${bytes >= storageWarningBytes ? ' · Stockage bientôt plein : faites de la place avant d’ajouter des photos.' : ''}`;
    for (const photo of catalog) {
      const card = template.content.firstElementChild!.cloneNode(
        true,
      ) as HTMLElement;
      card.querySelector('img')!.src = `/api/photos/${photo.id}`;
      const download =
        card.querySelector<HTMLAnchorElement>('[data-download]')!;
      download.href = `/api/photos/${photo.id}`;
      download.download = `${photo.id}.webp`;
      card.querySelector<HTMLElement>('[data-photo-details]')!.textContent =
        `${photo.width} × ${photo.height} · ${Math.round(photo.size / 1024)} Kio · ${new Date(photo.uploadedAt).toLocaleDateString('fr-FR')}`;
      const button = card.querySelector<HTMLButtonElement>('[data-delete]')!;
      listen(button, 'click', async () => {
        if (
          isBusy ||
          !confirm(
            'Supprimer définitivement cette photo de Dayframe ? L’original dans votre photothèque est conservé.',
          )
        ) {
          return;
        }

        setBusy(true);
        button.disabled = true;
        try {
          await photoRequest(`/api/photos/${photo.id}`, {method: 'DELETE'});
          deleted.add(photo.id);
          pending.delete(photo.id);
          catalog = catalog.filter(({id}) => id !== photo.id);
          render();
          status.textContent =
            'Photo supprimée. La propagation sur les autres écrans peut prendre une minute ou plus.';
        } catch (error) {
          showError(error);
        } finally {
          button.disabled = false;
          setBusy(false);
        }
      });
      gallery.append(card);
    }
  }

  async function refresh() {
    const {photos} = await fetchCatalog(true);
    for (const photo of photos) {
      if (pending.has(photo.id)) {
        pending.delete(photo.id);
      }
    }

    catalog = [
      ...new Map(
        [...photos, ...pending.values()].map((photo) => [photo.id, photo]),
      ).values(),
    ].filter(({id}) => !deleted.has(id));
    render();
  }

  async function shouldKeepPhoto(blob: Blob, similar: PhotoMetadata[]) {
    const images = dialog.querySelector<HTMLElement>('[data-similar-images]')!;
    const url = URL.createObjectURL(blob);
    images.replaceChildren();
    for (const [index, src] of [
      url,
      ...similar.slice(0, 3).map(({id}) => `/api/photos/${id}`),
    ].entries()) {
      const image = document.createElement('img');
      image.src = src;
      image.alt = index === 0 ? 'Nouvelle photo' : 'Photo similaire existante';
      image.className =
        'w-full aspect-[4/3] object-contain bg-background rounded-lg';
      images.append(image);
    }

    dialog.returnValue = 'skip';
    dialog.showModal();
    await new Promise<void>((resolve) => {
      dialog.addEventListener(
        'close',
        () => {
          resolve();
        },
        {once: true},
      );
    });
    URL.revokeObjectURL(url);
    images.replaceChildren();
    return dialog.returnValue === 'keep';
  }

  async function upload(file: File, row: HTMLLIElement) {
    setBusy(true);
    row.replaceChildren();
    const text = document.createElement('span');
    text.textContent = `${file.name} · préparation…`;
    row.append(text);
    try {
      const photo = await processPhoto(file);
      if (catalog.some(({id}) => id === photo.sha256)) {
        text.textContent = `${file.name} · doublon exact, déjà présent.`;
        return;
      }

      const configured = Number(
        root.querySelector<HTMLInputElement>('[data-similarity]')!.value,
      );
      const threshold =
        Number.isSafeInteger(configured) && configured >= 0 && configured <= 16
          ? configured
          : 6;
      const similar = catalog.filter(
        (existing) =>
          hammingDistance(existing.perceptualHash, photo.perceptualHash) <=
          threshold,
      );
      if (similar.length > 0 && !(await shouldKeepPhoto(photo.blob, similar))) {
        text.textContent = `${file.name} · passé à votre demande.`;
        return;
      }

      text.textContent = `${file.name} · envoi…`;
      const response = await photoRequest('/api/photos', {
        method: 'POST',
        headers: {
          'Content-Type': 'image/webp',
          'X-Photo-Sha256': photo.sha256,
          'X-Photo-Dhash': photo.perceptualHash,
        },
        body: photo.blob,
      });
      const body = (await response.json()) as {
        photo: PhotoMetadata;
        duplicate: boolean;
      };
      if (!isPhotoMetadata(body.photo)) {
        throw new Error(
          'Réponse d’envoi invalide. Réessayez pour vérifier le résultat.',
        );
      }

      pending.set(body.photo.id, body.photo);
      deleted.delete(body.photo.id);
      catalog = [...catalog.filter(({id}) => id !== body.photo.id), body.photo];
      render();
      text.textContent = `${file.name} · ${body.duplicate ? 'déjà présent' : 'ajouté'} (${body.photo.width} × ${body.photo.height}).`;
    } catch (error) {
      text.textContent = `${file.name} · ${error instanceof Error ? error.message : 'Envoi échoué.'} `;
      showError(error);
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.textContent = 'Réessayer';
      retry.className = 'min-h-11 underline px-3';
      listen(retry, 'click', async () => {
        if (isBusy) {
          return;
        }

        await initialize();
        if (isAuthorized) {
          await upload(file, row);
        }
      });
      row.append(retry);
    } finally {
      setBusy(false);
    }
  }

  async function initialize() {
    setBusy(true);
    try {
      const response = await photoRequest('/api/session');
      const identity = (await response.json()) as {role: string};
      if (identity.role !== 'admin') {
        throw new ApiError(
          'Cet affichage est en lecture seule. Connectez-vous avec un compte administrateur.',
          403,
        );
      }

      await refresh();
      privacyDeadline = Date.now() + 300_000;
      isAuthorized = true;
      login.hidden = true;
      status.textContent =
        'Accès administrateur vérifié. Les photos restent privées.';
    } catch (error) {
      showError(error);
    } finally {
      setBusy(false);
    }
  }

  choose.addEventListener('click', () => {
    input.click();
  });
  listen(input, 'change', async () => {
    if (isBusy || !isAuthorized) {
      return;
    }

    const files = [...(input.files ?? [])];
    input.value = '';
    for (const file of files) {
      const row = document.createElement('li');
      results.append(row);
      if (isAuthorized) {
        await upload(file, row);
      } else {
        row.textContent = `${file.name} · en attente de reconnexion. `;
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'min-h-11 underline px-3';
        retry.textContent = 'Réessayer';
        listen(retry, 'click', async () => {
          if (isBusy) {
            return;
          }

          await initialize();
          if (isAuthorized) {
            await upload(file, row);
          }
        });
        row.append(retry);
      }
    }

    if (isAuthorized) {
      try {
        await refresh();
      } catch (error) {
        showError(error);
      }
    }
  });
  listen(refreshButton, 'click', async () => {
    if (!isBusy) {
      await initialize();
    }
  });
  // Bound decoded admin previews even during an offline outage or a long upload/review.
  const privacyCheck = setInterval(() => {
    if (Date.now() >= privacyDeadline) {
      showError(new ApiError('Accès privé à vérifier. Reconnectez-vous.', 401));
    }

    void photoRequest('/api/session')
      .then(async (response) => {
        const identity = (await response.json()) as {role: string};
        if (identity.role !== 'admin') {
          throw new ApiError('Accès administrateur requis.', 403);
        }

        privacyDeadline = Date.now() + 300_000;
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          showError(error);
        }
      });
  }, 30_000);
  globalThis.addEventListener('pagehide', () => {
    clearInterval(privacyCheck);
    gallery.replaceChildren();
    if (dialog.open) {
      dialog.close('skip');
    }

    dialog.querySelector('[data-similar-images]')!.replaceChildren();
  });
  globalThis.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      location.reload();
    }
  });
  void initialize();
}
