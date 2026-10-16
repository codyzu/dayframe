/* eslint-disable no-bitwise -- Parse the WebP binary format. */
/* eslint-disable no-await-in-loop -- Read a bounded request stream one chunk at a time. */
import {
  isPhotoMetadata,
  maxPhotoBytes,
  maxPhotoEdge,
  photoPageSize,
  type PhotoMetadata,
} from '../src/lib/photos/contracts.ts';

// Structural subset of the platform binding; tests also exercise real local KV.
export type PhotoKV = {
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | undefined>;
  getWithMetadata<T>(
    key: string,
    type: 'arrayBuffer',
  ): Promise<{value: ArrayBuffer | undefined; metadata: T | undefined}>;
  put(
    key: string,
    value: ArrayBuffer,
    options: {metadata: PhotoMetadata},
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: {prefix: string; limit: number; cursor?: string}): Promise<{
    keys: Array<{name: string; metadata?: unknown}>;
    list_complete: boolean;
    cursor?: string;
  }>;
};

export class PhotoError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function readBounded(request: Request): Promise<ArrayBuffer> {
  const length = request.headers.get('Content-Length');
  if (
    length !== null &&
    (!/^\d+$/v.test(length) || Number(length) > maxPhotoBytes)
  ) {
    throw new PhotoError(
      413,
      'TOO_LARGE',
      'Photo trop volumineuse (2 Mio maximum).',
    );
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new PhotoError(400, 'INVALID_IMAGE', 'Photo manquante.');
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }

      size += value.byteLength;
      if (size > maxPhotoBytes) {
        await reader.cancel();
        throw new PhotoError(
          413,
          'TOO_LARGE',
          'Photo trop volumineuse (2 Mio maximum).',
        );
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  return bytes.buffer;
}

// Validate container, chunk boundaries, static bitstream signature and dimensions.
// Decoding is deliberately client-side; this does not certify the full bitstream.
// eslint-disable-next-line complexity -- Keep the explicit WebP chunk validation together for format auditing.
export function webpDimensions(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const text = (start: number, length = 4) =>
    String.fromCodePoint(...bytes.subarray(start, start + length));
  const invalid = () =>
    new PhotoError(
      400,
      'INVALID_IMAGE',
      'WebP statique sans métadonnées requis.',
    );
  if (
    bytes.length < 20 ||
    text(0) !== 'RIFF' ||
    text(8) !== 'WEBP' ||
    view.getUint32(4, true) !== bytes.length - 8
  ) {
    throw invalid();
  }

  let dimensions: {width: number; height: number} | undefined;
  let extended: {width: number; height: number} | undefined;
  let isAlpha = false;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) {
      throw invalid();
    }

    const kind = text(offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size + (size % 2) > bytes.length) {
      throw invalid();
    }

    if (kind === 'VP8X' && offset === 12 && size === 10) {
      if (
        (bytes[start] & ~0x10) !== 0 ||
        bytes[start + 1] !== 0 ||
        bytes[start + 2] !== 0 ||
        bytes[start + 3] !== 0
      ) {
        throw invalid();
      }

      const uint24 = (i: number) =>
        bytes[i] + bytes[i + 1] * 256 + bytes[i + 2] * 65_536 + 1;
      extended = {width: uint24(start + 4), height: uint24(start + 7)};
    } else if (
      kind === 'ALPH' &&
      extended &&
      !isAlpha &&
      !dimensions &&
      size > 0
    ) {
      isAlpha = true;
    } else if (kind === 'VP8 ' && !dimensions && size >= 10) {
      if (
        (bytes[start] & 1) !== 0 ||
        text(start + 3, 3) !== '\u{9D}\u{1}\u{2A}'
      ) {
        throw invalid();
      }

      dimensions = {
        width: view.getUint16(start + 6, true) & 0x3f_ff,
        height: view.getUint16(start + 8, true) & 0x3f_ff,
      };
    } else if (
      kind === 'VP8L' &&
      !dimensions &&
      !isAlpha &&
      size >= 5 &&
      bytes[start] === 0x2f
    ) {
      const packed = view.getUint32(start + 1, true);
      if (packed >>> 29 !== 0) {
        throw invalid();
      }

      dimensions = {
        width: (packed & 0x3f_ff) + 1,
        height: ((packed >>> 14) & 0x3f_ff) + 1,
      };
    } else {
      throw invalid();
    }

    offset = start + size + (size % 2);
  }

  if (
    !dimensions ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > maxPhotoEdge ||
    dimensions.height > maxPhotoEdge ||
    (extended &&
      (extended.width !== dimensions.width ||
        extended.height !== dimensions.height))
  ) {
    throw invalid();
  }

  return dimensions;
}

export async function listPhotos(kv: PhotoKV, cursor?: string) {
  const page = await kv.list({
    prefix: 'photo:',
    limit: photoPageSize,
    ...(cursor !== undefined && {cursor}),
  });
  if (
    !page.list_complete &&
    (page.cursor === undefined || page.cursor.length === 0)
  ) {
    throw new PhotoError(
      503,
      'STORAGE_INVALID',
      'Pagination du catalogue invalide.',
    );
  }

  const photos: PhotoMetadata[] = [];
  for (const key of page.keys) {
    if (
      !isPhotoMetadata(key.metadata) ||
      key.name !== `photo:${key.metadata.id}`
    ) {
      throw new PhotoError(
        503,
        'STORAGE_INVALID',
        'Catalogue à vérifier par un administrateur.',
      );
    }

    photos.push(key.metadata);
  }

  return {
    photos,
    cursor: page.list_complete ? null : page.cursor,
    approximate: true,
  };
}
