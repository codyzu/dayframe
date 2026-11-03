export type PhotoCoordinates = {latitude: number; longitude: number};

// Read only bounded JPEG APP1 / PNG eXIf metadata. No full image decoding or
// metadata library; unsupported/invalid metadata never blocks a photo import.
export function photoCoordinates(
  buffer: ArrayBuffer,
): PhotoCoordinates | undefined {
  try {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    const text = (offset: number, length: number) =>
      String.fromCodePoint(...bytes.subarray(offset, offset + length));
    let tiff: Uint8Array | undefined;
    if (bytes.length >= 8 && text(0, 8) === '\u{89}PNG\r\n\u{1A}\n') {
      for (let offset = 8; offset + 12 <= bytes.length;) {
        const size = view.getUint32(offset);
        if (size > bytes.length - offset - 12) {
          return undefined;
        }

        if (text(offset + 4, 4) === 'eXIf' && size <= 262_144) {
          tiff = bytes.subarray(offset + 8, offset + 8 + size);
          break;
        }

        offset += size + 12;
      }
    } else if (bytes[0] === 255 && bytes[1] === 216) {
      for (let offset = 2; offset + 4 <= bytes.length;) {
        if (bytes[offset] !== 255 || [218, 217].includes(bytes[offset + 1])) {
          break;
        }

        const size = view.getUint16(offset + 2);
        if (size < 2 || size > bytes.length - offset - 2) {
          return undefined;
        }

        if (bytes[offset + 1] === 225 && text(offset + 4, 6) === 'Exif\0\0') {
          tiff = bytes.subarray(offset + 10, offset + 2 + size);
          break;
        }

        offset += size + 2;
      }
    }

    return tiff === undefined ? undefined : tiffCoordinates(tiff);
  } catch {
    return undefined;
  }
}

function tiffCoordinates(bytes: Uint8Array): PhotoCoordinates | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (![0x49_49, 0x4d_4d].includes(view.getUint16(0))) {
    return undefined;
  }

  const isLittle = view.getUint16(0) === 0x49_49;
  const u16 = (offset: number) => view.getUint16(offset, isLittle);
  if (u16(2) !== 42) {
    return undefined;
  }

  const u32 = (offset: number) => view.getUint32(offset, isLittle);
  function directory(offset: number) {
    const count = u16(offset);
    if (count > 256 || offset + 2 + count * 12 + 4 > view.byteLength) {
      throw new Error('Invalid EXIF directory');
    }

    const entries = new Map<
      number,
      {type: number; count: number; offset: number}
    >();
    for (let index = 0; index < count; index++) {
      const entry = offset + 2 + index * 12;
      entries.set(u16(entry), {
        type: u16(entry + 2),
        count: u32(entry + 4),
        offset: entry + 8,
      });
    }

    return entries;
  }

  const pointer = directory(u32(4)).get(0x88_25);
  if (pointer?.type !== 4 || pointer.count !== 1) {
    return undefined;
  }

  const gps = directory(u32(pointer.offset));
  function coordinate(tag: number, reference: number) {
    const entry = gps.get(tag);
    const ref = gps.get(reference);
    if (
      entry?.type !== 5 ||
      entry.count !== 3 ||
      ref?.type !== 2 ||
      ref.count !== 2
    ) {
      throw new Error('Invalid GPS fields');
    }

    const offset = u32(entry.offset);
    const values = [0, 8, 16].map((delta) => {
      const denominator = u32(offset + delta + 4);
      if (denominator === 0) {
        throw new Error('Invalid GPS rational');
      }

      return u32(offset + delta) / denominator;
    });
    if (values[1] >= 60 || values[2] >= 60) {
      throw new Error('Invalid GPS minutes');
    }

    const direction = String.fromCodePoint(view.getUint8(ref.offset));
    if (!(reference === 1 ? ['N', 'S'] : ['E', 'W']).includes(direction)) {
      throw new Error('Invalid GPS reference');
    }

    const value =
      (values[0] + values[1] / 60 + values[2] / 3600) *
      (['S', 'W'].includes(direction) ? -1 : 1);
    if (
      !Number.isFinite(value) ||
      Math.abs(value) > (reference === 1 ? 90 : 180)
    ) {
      throw new Error('Invalid GPS coordinate');
    }

    return value;
  }

  return {latitude: coordinate(2, 1), longitude: coordinate(4, 3)};
}
