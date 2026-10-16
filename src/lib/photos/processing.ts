import {stripWebpMetadata} from './webp.ts';
import {
  differenceHash,
  maxPhotoBytes,
  maxPhotoEdge,
  sha256,
} from './contracts.ts';

export async function processPhoto(file: File) {
  if (file.size > 40 * 1024 * 1024) {
    throw new Error(
      'Original trop volumineux (40 Mio maximum). Exportez une version JPEG plus petite.',
    );
  }

  const hash = await sha256(await file.arrayBuffer());
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error(
        'Format non lisible. Pour HEIC, exportez la photo en JPEG depuis Photos.',
      );
    }

    // Modern browser image decoding applies EXIF orientation before canvas draw.
    const scale = Math.min(
      1,
      maxPhotoEdge / Math.max(image.naturalWidth, image.naturalHeight),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', {colorSpace: 'srgb'});
    if (!context) {
      throw new Error('Traitement d’image indisponible dans ce navigateur.');
    }

    // White matte makes transparent inputs hash and encode consistently.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const normalized = document.createElement('canvas');
    normalized.width = 9;
    normalized.height = 8;
    const pixels = normalized.getContext('2d', {willReadFrequently: true});
    if (!pixels) {
      throw new Error('Calcul d’empreinte indisponible.');
    }

    pixels.drawImage(canvas, 0, 0, 9, 8);
    const perceptualHash = differenceHash(pixels.getImageData(0, 0, 9, 8).data);
    const native = await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob(
        (result) => {
          resolve(result ?? undefined);
        },
        'image/webp',
        0.82,
      );
    });
    let encoded: Blob;
    if (native?.type === 'image/webp') {
      encoded = native;
    } else {
      const {encodeWebpFallback} = await import('./webp-fallback.ts');
      encoded = await encodeWebpFallback(
        context.getImageData(0, 0, canvas.width, canvas.height),
      );
    }

    const blob = new Blob([stripWebpMetadata(await encoded.arrayBuffer())], {
      type: 'image/webp',
    });
    if (blob.size > maxPhotoBytes) {
      throw new Error(
        'Photo optimisée trop volumineuse (2 Mio maximum). Exportez une version plus petite.',
      );
    }

    return {
      blob,
      sha256: hash,
      perceptualHash,
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    URL.revokeObjectURL(url);
    image.removeAttribute('src');
  }
}
