/* eslint-disable camelcase -- Wrangler configuration keys are an external contract. */
import process from 'node:process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {unstable_readConfig as readConfig} from 'wrangler';

// Wrangler is pinned. Use its parser so JSONC comments, paths and environment
// inheritance follow the same rules as the eventual upload.
/**
 Create a complete production upload configuration without publishing private IDs.
 @param {ReturnType<typeof readConfig>} base Parsed production Wrangler config.
 @param {string | undefined} namespaceId Private production namespace identifier.
 */
export function createProductionConfig(base, namespaceId) {
  if (!/^[0-9a-f]{32}$/v.test(namespaceId ?? '')) {
    throw new Error(
      'Production deployment requires DAYFRAME_PHOTOS_NAMESPACE_ID (32 lowercase hex characters).',
    );
  }

  if (!base.name || !base.main || !base.assets?.directory) {
    throw new Error(
      'Production Worker name, entrypoint and asset directory are required.',
    );
  }

  return {
    name: base.name,
    main: base.main,
    compatibility_date: base.compatibility_date,
    compatibility_flags: base.compatibility_flags,
    workers_dev: base.workers_dev,
    preview_urls: base.preview_urls,
    assets: {...base.assets, directory: path.resolve(base.assets.directory)},
    vars: base.vars,
    observability: base.observability,
    kv_namespaces: [{binding: 'PHOTOS', id: namespaceId}],
  };
}

if (import.meta.main) {
  let namespaceId = process.env.DAYFRAME_PHOTOS_NAMESPACE_ID;
  if (namespaceId === undefined) {
    const saved = await readFile('private/photos-namespace-id.txt', 'utf8');
    namespaceId = saved.trim();
  }

  const base = readConfig({config: 'wrangler.jsonc', env: 'production'});
  const config = createProductionConfig(base, namespaceId);
  await mkdir('private', {recursive: true, mode: 0o700});
  await writeFile(
    'private/wrangler.production.jsonc',
    `${JSON.stringify(config, null, 2)}\n`,
    {mode: 0o600},
  );
  console.log(
    'Prepared ignored production configuration with the PHOTOS binding.',
  );
}
