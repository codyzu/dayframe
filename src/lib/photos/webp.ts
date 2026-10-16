/* eslint-disable no-bitwise -- WebP feature flags are a binary contract. */
// Canvas is explicitly sRGB. Remove encoder-added profiles as well as EXIF/XMP;
// the pixels have already been converted into that shared colour space.
export function stripWebpMetadata(buffer: ArrayBuffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const chunks: Uint8Array[] = [];
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) {
      throw new Error('Encodage WebP invalide.');
    }

    const size = view.getUint32(offset + 4, true);
    const end = offset + 8 + size + (size % 2);
    if (end > bytes.length) {
      throw new Error('Encodage WebP invalide.');
    }

    const kind = String.fromCodePoint(...bytes.subarray(offset, offset + 4));
    if (!['ICCP', 'EXIF', 'XMP '].includes(kind)) {
      const chunk = bytes.slice(offset, end);
      if (kind === 'VP8X') {
        chunk[8] &= ~0x2c;
      }

      chunks.push(chunk);
    }

    offset = end;
  }

  const result = new Uint8Array(
    12 + chunks.reduce((size, chunk) => size + chunk.length, 0),
  );
  result.set(bytes.subarray(0, 12));
  new DataView(result.buffer).setUint32(4, result.length - 8, true);
  let offset = 12;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}
