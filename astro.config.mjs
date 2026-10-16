import {defineConfig} from 'astro/config';
import UnoCSS from 'unocss/astro';

export default defineConfig({
  output: 'static',
  integrations: [UnoCSS()],
  vite: {build: {target: ['firefox143', 'safari16', 'chrome106']}},
});
