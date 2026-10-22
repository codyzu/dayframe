import {createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {build} from 'esbuild';

export async function buildOffline(directory) {
  const result = await build({
    entryPoints: ['src/lib/offline/fallback.ts'],
    bundle: true,
    write: false,
    minify: true,
    target: ['firefox143', 'safari16', 'chrome106'],
    format: 'iife',
  });
  const script = result.outputFiles[0].text.trim();
  // This document has no Astro/global CSS: it must remain independently usable.
  const style =
    'html,body{margin:0;width:100%;height:100%;background:#111;color:#fff;font:18px system-ui}main,img{width:100%;height:100%;object-fit:contain}img[data-fit=cover]{object-fit:cover}footer{position:fixed;bottom:1rem;left:1rem;right:1rem;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem;padding:.75rem;background:#111d;border-radius:1rem}button{font:inherit;color:inherit;background:#333;border:1px solid #aaa;border-radius:.5rem;padding:.75rem}';
  const hash = (value) => createHash('sha256').update(value).digest('base64');
  const csp = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(style)}'; img-src blob:; connect-src 'self'; base-uri 'none'; form-action 'none'`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>Dayframe · Hors connexion</title><style>${style}</style></head><body data-offline><main data-stage></main><footer><span data-status role="status">Chargement des photos enregistrées…</span><button type="button">Réessayer la connexion</button></footer><script>${script}</script></body></html>`;
  await writeFile(new URL('offline.html', directory), html);
}
