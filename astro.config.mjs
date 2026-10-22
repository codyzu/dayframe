import {defineConfig} from 'astro/config';
import UnoCSS from 'unocss/astro';
import {buildOffline} from './scripts/offline-build.mjs';

export default defineConfig({
  output: 'static',
  integrations: [
    UnoCSS(),
    {
      name: 'offline-document',
      hooks: {'astro:build:done': async ({dir}) => buildOffline(dir)},
    },
  ],
  vite: {build: {target: ['firefox143', 'safari16', 'chrome106']}},
});
