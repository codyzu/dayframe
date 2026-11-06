export function createImportProgress(root: HTMLElement) {
  const panel = root.querySelector<HTMLElement>('[data-import-progress]')!;
  const label = root.querySelector<HTMLElement>('[data-progress-label]')!;
  const bar = root.querySelector<HTMLProgressElement>('[data-progress-bar]')!;
  const image = root.querySelector<HTMLImageElement>('[data-import-current]')!;
  let total = 0;
  let currentUrl: string | undefined;
  function clearImage() {
    image.hidden = true;
    image.removeAttribute('src');
    if (currentUrl === undefined) {
      return;
    }

    URL.revokeObjectURL(currentUrl);
    currentUrl = undefined;
  }

  return {
    begin(count: number) {
      total = count;
      panel.hidden = false;
      bar.max = Math.max(1, total);
      bar.value = 0;
      label.textContent = `0 sur ${total} traitées`;
    },
    show(done: number, stage: string) {
      panel.hidden = false;
      bar.value = Math.min(done, total);
      label.textContent =
        total === 0 ? stage : `${done} sur ${total} traitées · ${stage}`;
    },
    preview(file: File) {
      clearImage();
      if (document.hidden) {
        return;
      }

      currentUrl = URL.createObjectURL(file);
      image.src = currentUrl;
      image.hidden = false;
    },
    clearImage,
    clear() {
      clearImage();
      total = 0;
      bar.value = 0;
      label.textContent = '';
      panel.hidden = true;
    },
  };
}

export type ImportProgress = ReturnType<typeof createImportProgress>;
