import {defineConfig, presetIcons} from 'unocss';
import presetWind4 from '@unocss/preset-wind4';
import iconCollection from '@iconify-json/meteocons/icons.json';
import {repairMeteoconsTiming} from './src/lib/weather/icon-timing.ts';

// Validate before entering Iconify's loader, which catches collection errors.
// Copy rather than mutate the module cached by the dev server.
const meteocons = {
  ...iconCollection,
  icons: Object.fromEntries(
    Object.entries(iconCollection.icons).map(([name, icon]) => [
      name,
      {
        ...icon,
        // Cloud translations cross nested symbol view boxes. Let those
        // symbols overflow inside the unchanged outer 512×512 icon canvas.
        body: repairMeteoconsTiming(icon.body).replaceAll(
          '<symbol ',
          '<symbol overflow="visible" ',
        ),
      },
    ]),
  ),
};

export default defineConfig({
  // Astro scans templates by default; weather classes also live in browser-only TS.
  content: {
    filesystem: [
      'src/lib/weather/{conditions,view}.ts',
      'src/lib/photos/admin.ts',
    ],
  },
  safelist: ['bg-night', 'text-night-ink'],
  theme: {
    colors: {
      background: '#F5EBD8',
      surface: '#FFF9ED',
      elevated: '#FFFFFF',
      primary: '#182C35',
      secondary: '#35454A',
      border: '#B8AC96',
      accent: '#854A18',
      temperature: '#915018',
      rain: '#176D91',
      advice: '#FFE49A',
      'advice-ink': '#32270F',
      warning: '#793D14',
      mist: '#35454A',
      night: '#211F1C',
      'night-ink': '#C6B99E',
      'alpine-far': '#D9D6BB',
      'alpine-near': '#B9C3AF',
    },
    font: {sans: 'Manrope, system-ui, sans-serif'},
  },
  shortcuts: {
    surface: 'rounded-3xl border border-border bg-surface text-primary',
    eyebrow: 'mb-3 text-sm font-bold tracking-[2.1px] uppercase text-secondary',
    'display-title':
      'text-[30px] md:text-[clamp(30px,3.6vw,48px)] font-semibold leading-tight tracking-[-1.8px]',
    clock:
      'text-[78px] md:text-[clamp(62px,8.2vw,112px)] font-normal tracking-[-4px] md:tracking-[-6px] tabular-nums leading-none',
  },
  presets: [
    presetWind4({preflights: {reset: false}}),
    presetIcons({
      collections: {
        meteocons() {
          return meteocons;
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
