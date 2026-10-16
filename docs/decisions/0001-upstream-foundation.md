# ADR 0001 — Upstream foundation and M1 toolchain

Accepted 16 October 2026. Scope: M1, fixture-only foundation.

## Upstream review (M1.1)

Reviewed Wes Bos's [photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard/tree/e97c50ba459c49ea8237259f69b95cd28054b628) at commit `e97c50ba459c49ea8237259f69b95cd28054b628` from a shallow checkout. No upstream code or assets imported. `git ls-tree -r` found no LICENSE/COPYING file at this revision; public visibility is not permission to copy. Retain project attribution in README; seek explicit licensing before any future copying.

Paths reviewed at that revision (append each path to the permalink above):

| Paths                                                                        | Decision                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                                                                  | Adopt research-first approach, distinguish actual hardware from marketed names. No device actions in M1.                                                                                                                           |
| `dashboard/package.json`, `dashboard/vite.config.js`                         | Adapt lightweight build approach; use Astro/strict TypeScript/UnoCSS instead of Vite-only JS. Upstream targets Chrome 106 and CSS Chrome 61 based on its own unit. Our provisional Firefox 143 target is unverified on Classic 10. |
| `dashboard/wrangler.jsonc`                                                   | Adopt static Workers Assets hosting idea; add a separate minimal API Worker with explicit `/api` routing. No SSR adapter needed.                                                                                                   |
| `dashboard/index.html`, `dashboard/css/tokens.css`, `dashboard/css/base.css` | Adopt glanceable hierarchy and large touch targets as ideas. Implement independent responsive layout rather than fixed scaled canvas. Bundle fonts locally instead of Google Fonts requests.                                       |
| `dashboard/js/main.js`, `dashboard/js/app.js`                                | Adapt small controller idea with typed modules and semantic DOM. Use real French clock, fixture weather, manual navigation only in M1; full scheduling remains M5.                                                                 |
| `dashboard/js/system.js`, `dashboard/js/slideshow.js`                        | Defer slideshow/ambient behavior to M3/M5. Avoid upstream remote Picsum requests and unbounded demo features. Only original local illustration in M1.                                                                              |

Hardware guidance and issues/PRs must be refreshed in M6. Nothing here validates Classic 10 compatibility or authorizes flashing.

## Tooling gate (M1.2)

Versions queried from npm registry with `npm view` (engines and peerDependencies included), 16 October 2026. Use installed Node **24.16.0**, pnpm **10.23.0**, `.nvmrc`, `engines`, `packageManager`, `engine-strict` and pnpm lockfile. Exact direct versions:

| Package                   | Version |
| ------------------------- | ------- |
| @fontsource/manrope       | 5.3.0   |
| astro                     | 7.4.0   |
| @astrojs/check            | 0.9.10  |
| @iconify-json/meteocons   | 1.2.4   |
| @playwright/test          | 1.64.1  |
| @types/node               | 24.19.2 |
| @typescript-eslint/parser | 8.71.2  |
| @unocss/astro             | 66.11.0 |
| @unocss/preset-wind4      | 66.11.0 |
| @unocss/reset             | 66.11.0 |
| astro-eslint-parser       | 3.2.0   |
| eslint-plugin-astro       | 3.2.1   |
| prettier                  | 3.9.10  |
| prettier-plugin-astro     | 1.1.1   |
| typescript                | 6.0.3   |
| typescript-eslint         | 8.71.2  |
| unocss                    | 66.11.0 |
| vitest                    | 5.0.5   |
| wrangler                  | 4.151.0 |
| xo                        | 5.0.1   |

Astro requires Node >=22.22.0/npm >=9.6.5 and uses Vite ^8.3.4. UnoCSS Astro supports Vite 5–8. Vitest supports Vite 6.4/7/8 and Node 24. Wrangler requires Node >=22; Playwright >=20. TypeScript latest 7.0.2 was deliberately rejected: astro-check supports TS 5/6, typescript-eslint requires <6.1. TS 6.0.3 satisfies both. Prettier plugin requires Prettier ^3.5.3. XO 5 uses ESLint 10, which satisfies typescript-eslint's ESLint 8/9/10 peer range. Clean install/type/build/browser results are recorded in the plan.

Official guidance consulted:

- [Astro installation](https://docs.astro.build/en/install-and-setup/), [static Cloudflare deployment](https://docs.astro.build/en/guides/deploy/cloudflare/) — static output with manual Wrangler config, adapter only for on-demand rendering.
- [UnoCSS Astro integration](https://unocss.dev/integrations/astro) — integration and explicit presets.
- [Vitest guide](https://vitest.dev/guide/), [Playwright installation](https://playwright.dev/docs/intro).
- [Workers Assets bindings/routing](https://developers.cloudflare.com/workers/static-assets/binding/) — selective worker-first API namespace, asset binding.

## Assets and limitations

Original SVG scenery/favicon authored for Dayframe, no copied upstream assets. Manrope Latin WOFF2 fonts (OFL-1.1) and Meteocons (MIT) are bundled from installed packages; full notices are in `public/licenses/` and `THIRD_PARTY_NOTICES.md`. Strip embedded SVG animations at build time; the installed collection has no static variants. No external font, image or icon CDN. System fonts remain fallback. This is a provisional M1 design, not conformity to missing approved M2 mockups.

Static pages hold public fixtures only, including `/admin/photos`. That page has disabled controls and no household data. All API paths except health fail closed and cannot fall through to assets. Future private content must never be put in `public/` or `dist/`.

## Frontend conventions adopted during M1

Per the owner's direction: pnpm 10.23.0, XO with `prettier: true`, UnoCSS `@unocss/preset-wind4` 66.11.0 and `@unocss/reset` 66.11.0. pnpm 12.11.2 was verified in the registry but failed with ENOEXEC through this host's package-manager launcher; 10.23.0 is compatible with Node 24 and matches the established Les Mains de Sérénité setup. No npm lockfile remains.

Reviewed local reference configurations (configuration only, no product assets imported): Tetras `Downloads/Tetras/RES507/xo.config.mjs`, Les Mains de Sérénité `dev/mains-de-serenete/xo.config.mjs`, and Xen `xen/www-xenproject-org/xo.config.ts`, plus their Prettier settings. Adopt two-space indentation, semicolons, single quotes, XO's built-in Prettier integration and Astro recommended lint config. Additional pinned packages: `xo` 5.0.1, `eslint-plugin-astro` 3.2.1, `astro-eslint-parser` 3.2.0, `@typescript-eslint/parser` 8.71.2. Standalone ESLint config/direct dependency removed. React settings are irrelevant here.

Utilities handle component layout, typography, spacing, responsive variants, colors, and pressed/hover states. Four shared shortcuts cover surface, eyebrow, display-title and clock. Only page-scoped scene compositing, night backdrop and kiosk viewport sizing need custom component CSS; global.css holds accessibility invariants. The policy is recorded in AGENTS.md. Meteocons has no static icon variants in the installed collection, so the build strips animation elements from actual verified icon names.

Official references: [XO](https://github.com/xojs/xo), [Wind4](https://unocss.dev/presets/wind4), [reset](https://unocss.dev/guide/style-reset), [pnpm installation](https://pnpm.io/installation).

The external UnoCSS reset is imported in CSS layer `reset` so its native element defaults cannot override utility classes in the production CSS bundle. Wind4’s duplicate built-in reset is disabled.
