import encode, {init} from '@jsquash/webp/encode.js';
import wasmUrl from '@jsquash/webp/codec/enc/webp_enc.wasm?url';
import simdUrl from '@jsquash/webp/codec/enc/webp_enc_simd.wasm?url';

async function encodeMessage(
  event: MessageEvent<{
    pixels: Uint8ClampedArray<ArrayBuffer>;
    width: number;
    height: number;
  }>,
) {
  try {
    await init({
      locateFile: (filename: string) =>
        filename.endsWith('_simd.wasm') ? simdUrl : wasmUrl,
    });
    const {pixels, width, height} = event.data;
    const bytes = await encode(new ImageData(pixels, width, height), {
      quality: 82,
    });
    globalThis.postMessage({bytes}, {transfer: [bytes]});
  } catch {
    globalThis.postMessage({
      error:
        'Encodage WebP indisponible. Rechargez la page et réessayez avec une photo JPEG plus petite.',
    });
  }
}

globalThis.addEventListener(
  'message',
  (
    event: MessageEvent<{
      pixels: Uint8ClampedArray<ArrayBuffer>;
      width: number;
      height: number;
    }>,
  ) => {
    void encodeMessage(event);
  },
);
