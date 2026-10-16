import {defineConfig, presetIcons} from 'unocss';
import presetWind4 from '@unocss/preset-wind4';

export default defineConfig({
  // Astro scans templates by default; weather classes also live in browser-only TS.
  content: {filesystem: ['src/lib/weather/{conditions,view}.ts']},
  theme: {
    colors: {mist: '#d5e0df'},
    font: {sans: 'Manrope, system-ui, sans-serif'},
  },
  shortcuts: {
    surface: 'rounded-3xl border border-white/25 bg-[#0d2731]/90 shadow-lg',
    eyebrow: 'mb-3 text-[11px] font-bold tracking-[2.1px] uppercase text-mist',
    'display-title':
      'text-[30px] md:text-[clamp(30px,3.6vw,48px)] font-semibold leading-tight tracking-[-1.8px]',
    clock:
      'text-[78px] md:text-[clamp(62px,8.2vw,112px)] font-normal tracking-[-4px] md:tracking-[-6px] tabular-nums leading-none',
  },
  presets: [
    presetWind4({preflights: {reset: false}}),
    presetIcons({
      collections: {
        async meteocons() {
          const {default: collection} =
            await import('@iconify-json/meteocons/icons.json');
          // Embedded SVG animations ignore CSS reduced-motion rules. Strip them at build time.
          for (const icon of Object.values(collection.icons)) {
            icon.body = icon.body.replaceAll(
              /<animate(?:Transform|Motion)?\b[^>]*(?:\/>|>[\s\S]*?<\/animate(?:Transform|Motion)?>)/gv,
              '',
            );
            // Rain paths start transparent and rely on animation to become visible.
            icon.body = icon.body.replaceAll(' opacity="0"', '');
          }

          return collection;
        },
      },
    }),
  ],
});
