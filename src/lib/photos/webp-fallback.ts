export async function encodeWebpFallback(image: ImageData): Promise<Blob> {
  const worker = new Worker(new URL('webp-worker.ts', import.meta.url), {
    type: 'module',
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const bytes = await new Promise<ArrayBuffer>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            'Encodage trop lent. Réessayez avec une photo JPEG plus petite.',
          ),
        );
      }, 45_000);
      worker.addEventListener(
        'message',
        (event: MessageEvent<{bytes?: ArrayBuffer; error?: string}>) => {
          if (event.data.bytes) {
            resolve(event.data.bytes);
          } else {
            reject(
              new Error(event.data.error ?? 'Encodage WebP indisponible.'),
            );
          }
        },
        {once: true},
      );
      worker.addEventListener(
        'error',
        () => {
          reject(
            new Error(
              'Ce navigateur ne peut pas encoder en WebP. Vérifiez que WebAssembly est autorisé.',
            ),
          );
        },
        {once: true},
      );
      worker.postMessage(
        {pixels: image.data, width: image.width, height: image.height},
        [image.data.buffer],
      );
    });
    return new Blob([bytes], {type: 'image/webp'});
  } finally {
    clearTimeout(timer);
    worker.terminate();
  }
}
