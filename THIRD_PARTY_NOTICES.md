# Third-party notices

The project foundation is Wes Bos's [photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard). M1 uses its research and architectural ideas as reference; no upstream source or assets were copied. See [ADR 0001](docs/decisions/0001-upstream-foundation.md) for the reviewed revision, paths, and license decision.

Bundled runtime assets:

- **Manrope**, Mikhail Sharanda and contributors, via `@fontsource/manrope` 5.3.0. SIL Open Font License 1.1. The full [OFL notice](public/licenses/manrope-OFL.txt) ships with the site. Only Latin weights 400/600/700 are imported, with local WOFF2 and WOFF fallback files.
- **Meteocons**, copyright 2020–2022 Bas Milius, via `@iconify-json/meteocons` 1.2.4. MIT license. The full [MIT notice](public/licenses/meteocons-MIT.txt) ships with the site. The icon loader strips SVG animation elements for restrained motion and reduced CPU usage; artwork and credit are retained. Source: [weather-icons](https://github.com/basmilius/weather-icons).
- `public/annecy.svg` and `public/favicon.svg` are original Dayframe illustrations authored for this repository; no external photos, upstream artwork, or generated raster assets are included.

Application/tooling dependencies retain their own package notices in the lockfile-installed distribution. There are no remote font/image/icon dependencies in the shell.
