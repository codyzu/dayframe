/* eslint-disable no-bitwise -- dHash is a defined 64-bit bit comparison. */
export const maxPhotoBytes = 2 * 1024 * 1024;
export const maxPhotoEdge = 1600;
export const photoPageSize = 1000;
export const storageWarningBytes = 700_000_000;
export const shaPattern = /^[0-9a-f]{64}$/v;
export const hashPattern = /^[0-9a-f]{16}$/v;

export type PhotoMetadata = {
  id: string;
  sha256: string;
  perceptualHash: string;
  uploadedAt: string;
  uploadedBy: string;
  width: number;
  height: number;
  contentType: 'image/webp';
  size: number;
};

export function isPhotoMetadata(value: unknown): value is PhotoMetadata {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const p = value as PhotoMetadata;
  return (
    typeof p.id === 'string' &&
    shaPattern.test(p.id) &&
    p.sha256 === p.id &&
    typeof p.perceptualHash === 'string' &&
    hashPattern.test(p.perceptualHash) &&
    typeof p.uploadedAt === 'string' &&
    Number.isFinite(Date.parse(p.uploadedAt)) &&
    typeof p.uploadedBy === 'string' &&
    p.uploadedBy.length > 0 &&
    p.uploadedBy.length <= 254 &&
    p.contentType === 'image/webp' &&
    hasPhotoSize(p)
  );
}

export async function sha256(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('');
}

// Row-major 9×8 grayscale, comparing each pixel to its right-hand neighbour.
export function differenceHash(rgba: Uint8ClampedArray): string {
  if (rgba.length !== 9 * 8 * 4) {
    throw new Error('Pixels dHash invalides.');
  }

  let bits = 0n;
  const gray = (index: number) =>
    rgba[index] * 299 + rgba[index + 1] * 587 + rgba[index + 2] * 114;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const offset = (y * 9 + x) * 4;
      bits = (bits << 1n) | BigInt(gray(offset) > gray(offset + 4));
    }
  }

  return bits.toString(16).padStart(16, '0');
}

export function hammingDistance(a: string, b: string): number {
  if (!hashPattern.test(a) || !hashPattern.test(b)) {
    throw new Error('Empreinte invalide.');
  }

  let bits = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let count = 0;
  while (bits !== 0n) {
    bits &= bits - 1n;
    count++;
  }

  return count;
}

function isBoundedInteger(value: unknown, maximum: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= maximum
  );
}

export function hasPhotoSize(value: {
  width?: unknown;
  height?: unknown;
  size?: unknown;
}) {
  return (
    isBoundedInteger(value.width, maxPhotoEdge) &&
    isBoundedInteger(value.height, maxPhotoEdge) &&
    isBoundedInteger(value.size, maxPhotoBytes)
  );
}
