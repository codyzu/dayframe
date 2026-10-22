import process from 'node:process';
import {randomUUID} from 'node:crypto';
import {defineConfig} from 'astro/config';
import UnoCSS from 'unocss/astro';
import {buildOffline, buildNavigation} from './scripts/offline-build.mjs';

const buildId = randomUUID();

export default defineConfig({
  output: 'static',
  integrations: [
    UnoCSS(),
    {
      name: 'offline-document',
      hooks: {
        async 'astro:build:done'({dir}) {
          await buildOffline(dir);
          await buildNavigation(
            dir,
            buildId,
            process.env.DAYFRAME_OFFLINE_RETIRE === '1',
          );
        },
      },
    },
  ],
  vite: {
    define: {
      'import.meta.env.PUBLIC_BUILD_ID': JSON.stringify(buildId),
      'import.meta.env.PUBLIC_OFFLINE_NAVIGATION': JSON.stringify(
        process.env.DAYFRAME_OFFLINE_NAVIGATION === '1',
      ),
    },
    build: {target: ['firefox143', 'safari16', 'chrome106']},
  },
});
