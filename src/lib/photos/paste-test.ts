import {processPhoto} from './processing.ts';

// Diagnostic only: no API client, persistence, HTML clipboard parsing or uploads.
export function mountPasteTest(root: HTMLElement) {
  const paste = root.querySelector<HTMLButtonElement>('[data-paste]')!;
  const process = root.querySelector<HTMLButtonElement>('[data-process]')!;
  const clear = root.querySelector<HTMLButtonElement>('[data-clear]')!;
  const expected = root.querySelector<HTMLInputElement>('[data-expected]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const count = root.querySelector<HTMLElement>('[data-count]')!;
  const results = root.querySelector<HTMLOListElement>('[data-results]')!;
  const zone = root.querySelector<HTMLElement>('[data-paste-zone]')!;
  const report = root.querySelector<HTMLElement>('[data-clipboard-report]')!;
  const variant = new URL(location.href).searchParams.get('variant');
  const label = variant === 'png' ? 'PNG' : 'mixte';
  const fromUrl = Number(new URL(location.href).searchParams.get('expected'));
  if (Number.isSafeInteger(fromUrl) && fromUrl >= 1 && fromUrl <= 10) {
    expected.value = String(fromUrl);
  }

  report.textContent = `Test : ${label}. Aucun collage effectué.`;

  let files: File[] = [];
  let urls: string[] = [];
  let generation = 0;
  let isBusy = false;

  function reset() {
    generation++;
    files = [];
    for (const url of urls) {
      URL.revokeObjectURL(url);
    }

    urls = [];
    results.replaceChildren();
    zone.replaceChildren();
    count.textContent = '';
    report.textContent = `Test : ${label}. Aucun collage effectué.`;
    process.disabled = true;
  }

  function updateCount() {
    const isComplete = files.length === Number(expected.value);
    count.textContent = `${files.length} photo(s) reçue(s) sur ${expected.value} attendue(s).`;
    process.disabled = isBusy || files.length === 0 || !isComplete;
    return isComplete;
  }

  async function receive(blobs: Blob[], current: number) {
    if (current !== generation) {
      return;
    }

    if (
      blobs.length > 10 ||
      blobs.some((blob) => blob.size > 40 * 1024 * 1024) ||
      blobs.reduce((sum, blob) => sum + blob.size, 0) > 100_000_000
    ) {
      status.textContent =
        'Lot trop volumineux. Essayez une seule image de test.';
      return;
    }

    files = blobs.map(
      (blob, index) => new File([blob], `test-${index + 1}`, {type: blob.type}),
    );
    if (files.length === 0) {
      status.textContent =
        'Aucune image reçue. Le texte et le HTML sont ignorés.';
      updateCount();
      return;
    }

    status.textContent = updateCount()
      ? 'Toutes les images attendues sont reçues. Vérifiez les aperçus.'
      : 'Lot incomplet : le presse-papiers ne contient pas toutes les photos sélectionnées.';
    for (const [index, file] of files.entries()) {
      if (current !== generation) {
        return;
      }

      const row = document.createElement('li');
      row.className = 'rounded-xl border border-current p-4';
      const info = document.createElement('p');
      info.textContent = `Image ${index + 1} · ${file.type} · ${Math.round(file.size / 1000)} Ko`;
      const image = document.createElement('img');
      image.className = 'mt-3 max-h-80 max-w-full object-contain';
      image.alt = `Aperçu de l’image ${index + 1}`;
      const url = URL.createObjectURL(file);
      urls.push(url);
      image.src = url;
      const output = document.createElement('p');
      output.dataset.output = '';
      output.className = 'mt-3';
      row.append(info, image, output);
      results.append(row);
      try {
        await image.decode();
        if (current !== generation) {
          return;
        }

        info.textContent += ` · ${image.naturalWidth} × ${image.naturalHeight}`;
      } catch {
        if (current === generation) {
          output.textContent = 'Aperçu non décodable.';
        }
      }
    }
  }

  paste.addEventListener('click', () => {
    if (isBusy) {
      return;
    }

    reset();
    if (typeof navigator.clipboard?.read !== 'function') {
      status.textContent =
        'Lecture indisponible. Essayez la zone de collage manuel en HTTPS.';
      return;
    }

    const current = generation;
    // Start the clipboard read in the click handler, before any asynchronous work.
    const reading = navigator.clipboard.read();
    isBusy = true;
    paste.disabled = true;
    status.textContent = 'En attente du collage…';
    void (async () => {
      try {
        const items = await reading;
        if (current !== generation) {
          return;
        }

        report.textContent = [
          `Test : ${label} · bouton`,
          `Éléments renvoyés : ${items.length}`,
          ...items
            .slice(0, 10)
            .map(
              (item, index) =>
                `Élément ${index + 1} : ${item.types.length > 0 ? item.types.join(', ') : '(aucun type)'}`,
            ),
        ].join('\n');
        if (items.length > 10) {
          throw new Error('TOO_MANY');
        }

        const blobs: Blob[] = [];
        for (const item of items) {
          const type = item.types.includes('image/png')
            ? 'image/png'
            : item.types.find((value) => value.startsWith('image/'));
          if (type !== undefined) {
            blobs.push(await item.getType(type));
          }

          if (current !== generation) {
            return;
          }
        }

        report.textContent += `\nImages extraites : ${blobs.length}`;
        await receive(blobs, current);
      } catch {
        if (current === generation) {
          report.textContent += '\nLecture interrompue ou refusée.';
          status.textContent =
            'Collage annulé, refusé ou indisponible. Réessayez ou utilisez le collage manuel.';
        }
      } finally {
        isBusy = false;
        paste.disabled = false;
        if (files.length > 0) {
          updateCount();
        }
      }
    })();
  });

  zone.addEventListener('paste', (event) => {
    event.preventDefault();
    if (isBusy) {
      return;
    }

    reset();
    const images = [...(event.clipboardData?.files ?? [])].filter((file) =>
      file.type.startsWith('image/'),
    );
    const data = event.clipboardData;
    report.textContent = [
      `Test : ${label} · collage manuel`,
      `Éléments : ${data?.items.length ?? 0} · fichiers : ${data?.files.length ?? 0}`,
      `Types : ${[...(data?.types ?? [])].join(', ')}`,
      ...[...(data?.items ?? [])]
        .slice(0, 10)
        .map(
          (item, index) => `Élément ${index + 1} : ${item.kind} · ${item.type}`,
        ),
      `Images extraites : ${images.length}`,
    ].join('\n');
    void receive(images, generation);
  });
  expected.addEventListener('input', () => {
    updateCount();
  });
  clear.addEventListener('click', () => {
    reset();
    status.textContent = 'Aperçus et résultats effacés.';
  });
  process.addEventListener('click', () => {
    if (isBusy || process.disabled) {
      return;
    }

    const current = generation;
    const batch = [...files];
    isBusy = true;
    paste.disabled = true;
    process.disabled = true;
    status.textContent = 'Conversion locale en cours…';
    void (async () => {
      let passed = 0;
      try {
        for (const [index, file] of batch.entries()) {
          const photo = await processPhoto(file);
          if (current !== generation) {
            return;
          }

          const output =
            results.children[index].querySelector<HTMLElement>(
              '[data-output]',
            )!;
          output.textContent = `WebP : ${photo.width} × ${photo.height} · ${Math.round(photo.blob.size / 1000)} Ko · empreintes SHA-256 et dHash calculées.`;
          passed++;
        }

        status.textContent = `${passed} photo(s) convertie(s) en WebP sur cet appareil. Aucun envoi.`;
      } catch {
        if (current === generation) {
          status.textContent = `Conversion interrompue après ${passed} photo(s). Réessayez avec une seule image.`;
        }
      } finally {
        isBusy = false;
        paste.disabled = false;
        if (files.length > 0) {
          updateCount();
        }
      }
    })();
  });
  const hide = () => {
    reset();
    status.textContent =
      'Page masquée ou quittée : aperçus effacés. Collez à nouveau pour reprendre.';
  };

  window.addEventListener('pagehide', hide);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hide();
    }
  });
}
