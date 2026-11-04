import {isCaptureTimestamp} from './place.ts';

export type PhotoCoordinates = {latitude: number; longitude: number};

// Read only bounded JPEG APP1 / PNG eXIf metadata. No full image decoding or
// metadata library; unsupported/invalid metadata never blocks a photo import.
export function photoCoordinates(
  buffer: ArrayBuffer,
): PhotoCoordinates | undefined {
  return readExif(buffer, tiffCoordinates);
}

export function photoCaptureTimestamp(buffer: ArrayBuffer): string | undefined {
  return readExif(buffer, (bytes) => {
    const {directory, root, u32} = tiffDirectories(bytes);
    const pointer = root.get(0x87_69);
    if (pointer?.type !== 4 || pointer.count !== 1) {
      return undefined;
    }

    const exif = directory(u32(pointer.offset));
    function readAscii(tag: number, maximum: number) {
      const field = exif.get(tag);
      if (field?.type !== 2 || field.count < 2 || field.count > maximum) {
        return '';
      }

      const offset = field.count <= 4 ? field.offset : u32(field.offset);
      const value = bytes.subarray(offset, offset + field.count);
      return value.length === field.count && value.at(-1) === 0
        ? new TextDecoder().decode(value.subarray(0, -1))
        : '';
    }

    const original = readAscii(0x90_03, 20);
    if (!/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/v.test(original)) {
      return undefined;
    }

    const day = original.slice(0, 10).replaceAll(':', '-');
    const local = `${day}T${original.slice(11)}`;
    const fraction = readAscii(0x92_91, 10);
    const offset = readAscii(0x90_11, 7);
    const detailed = `${local}${/^\d{1,9}$/v.test(fraction) ? `.${fraction}` : ''}`;
    const zoned = detailed + offset;
    if (isCaptureTimestamp(zoned)) {
      return zoned;
    }

    return isCaptureTimestamp(detailed) ? detailed : undefined;
  });
}

function readExif<T>(
  buffer: ArrayBuffer,
  read: (tiff: Uint8Array) => T,
): T | undefined {
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

    return tiff === undefined ? undefined : read(tiff);
  } catch {
    return undefined;
  }
}

function tiffDirectories(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (![0x49_49, 0x4d_4d].includes(view.getUint16(0))) {
    throw new Error('Invalid TIFF byte order');
  }

  const isLittle = view.getUint16(0) === 0x49_49;
  const u16 = (offset: number) => view.getUint16(offset, isLittle);
  if (u16(2) !== 42) {
    throw new Error('Invalid TIFF header');
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

  return {view, u32, directory, root: directory(u32(4))};
}

function tiffCoordinates(bytes: Uint8Array): PhotoCoordinates | undefined {
  const {view, u32, directory, root} = tiffDirectories(bytes);
  const pointer = root.get(0x88_25);
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
