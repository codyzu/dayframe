/* eslint-disable no-bitwise -- Synthetic PNG CRC and TIFF fixture encoding. */
export function gpsTiff(
  latitude = 45.8992,
  longitude = 6.1294,
  isLittle = true,
) {
  const bytes = new Uint8Array(128);
  const view = new DataView(bytes.buffer);
  const u16 = (offset: number, value: number) => {
    view.setUint16(offset, value, isLittle);
  };

  const u32 = (offset: number, value: number) => {
    view.setUint32(offset, value, isLittle);
  };

  bytes.set(isLittle ? [73, 73] : [77, 77]);
  u16(2, 42);
  u32(4, 8);
  u16(8, 1);
  u16(10, 0x88_25);
  u16(12, 4);
  u32(14, 1);
  u32(18, 26);
  u16(26, 4);
  for (const [index, tag, type, count, value] of [
    [0, 1, 2, 2, latitude < 0 ? 83 : 78],
    [1, 2, 5, 3, 80],
    [2, 3, 2, 2, longitude < 0 ? 87 : 69],
    [3, 4, 5, 3, 104],
  ]) {
    const offset = 28 + index * 12;
    u16(offset, tag);
    u16(offset + 2, type);
    u32(offset + 4, count);
    if (type === 2) {
      bytes[offset + 8] = value;
    } else {
      u32(offset + 8, value);
    }
  }

  for (const [offset, coordinate] of [
    [80, latitude],
    [104, longitude],
  ]) {
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutes = Math.floor((absolute - degrees) * 60);
    const seconds = ((absolute - degrees) * 60 - minutes) * 60;
    for (const [delta, numerator, denominator] of [
      [0, degrees, 1],
      [8, minutes, 1],
      [16, Math.round(seconds * 1_000_000), 1_000_000],
    ]) {
      u32(offset + delta, numerator);
      u32(offset + delta + 4, denominator);
    }
  }

  return bytes;
}

export function gpsJpeg(
  latitude?: number,
  longitude?: number,
  isLittle = true,
) {
  const tiff = gpsTiff(latitude, longitude, isLittle);
  const bytes = new Uint8Array(12 + tiff.length);
  bytes.set([255, 216, 255, 225]);
  new DataView(bytes.buffer).setUint16(4, tiff.length + 8);
  bytes.set([69, 120, 105, 102, 0, 0], 6);
  bytes.set(tiff, 12);
  return bytes;
}

export function gpsPng(
  image: Uint8Array,
  latitude?: number,
  longitude?: number,
) {
  const tiff = gpsTiff(latitude, longitude);
  const chunk = new Uint8Array(tiff.length + 12);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, tiff.length);
  chunk.set([101, 88, 73, 102], 4);
  chunk.set(tiff, 8);
  let crc = 0xff_ff_ff_ff;
  for (const byte of chunk.subarray(4, -4)) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ ((crc & 1) === 0 ? 0 : 0xed_b8_83_20);
    }
  }

  view.setUint32(chunk.length - 4, (crc ^ 0xff_ff_ff_ff) >>> 0);
  const result = new Uint8Array(image.length + chunk.length);
  result.set(image.subarray(0, 33));
  result.set(chunk, 33);
  result.set(image.subarray(33), 33 + chunk.length);
  return result;
}
