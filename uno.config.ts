import {defineConfig, presetIcons} from 'unocss';
import presetWind4 from '@unocss/preset-wind4';

export default defineConfig({
  // Astro scans templates by default; weather classes also live in browser-only TS.
  content: {
    filesystem: [
      'src/lib/weather/{conditions,view}.ts',
      'src/lib/photos/admin.ts',
    ],
  },
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
          // Cloud translations cross nested symbol view boxes. Let those
          // symbols overflow inside the unchanged outer 512×512 icon canvas.
          // Copy rather than mutate the module cached by the dev server.
          return {
            ...collection,
            icons: Object.fromEntries(
              Object.entries(collection.icons).map(([name, icon]) => [
                name,
                {
                  ...icon,
                  body: icon.body.replaceAll(
                    '<symbol ',
                    '<symbol overflow="visible" ',
                  ),
                },
              ]),
            ),
          };
        },
      },
      processor(css, {collection, svg}) {
        if (collection !== 'meteocons') {
          return;
        }

        // SVG image animations bypass page CSS. Bundle a separate still image
        // for hourly forecasts and the current icon's reduced-motion fallback.
        const still = svg
          .replaceAll(
            /<animate(?:Transform|Motion)?\b[^>]*(?:\/>|>[\s\S]*?<\/animate(?:Transform|Motion)?>)/gv,
            '',
          )
          // Rain paths start transparent and need to remain visible in the still.
          .replaceAll(' opacity="0"', '');
        css['--dayframe-static-icon'] =
          `url("data:image/svg+xml,${encodeURIComponent(still)}")`;
      },
    }),
  ],
});
