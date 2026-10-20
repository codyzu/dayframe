# Upstream comparison — 20 October 2026

Compared Dayframe `f44c06d97942090814ee1c0d9b0e29cf8bab6789` with Wes Bos's
[photo-frame-dashboard at `f1e0820918c926396e0ccafb4839568825f63edc`](https://github.com/wesbos/photo-frame-dashboard/tree/f1e0820918c926396e0ccafb4839568825f63edc).
Upstream HEAD was checked remotely and its source inspected in a separate temporary checkout.
The review made no project or device changes. This document records that comparison before
follow-up implementation; historical acceptance and owner deferrals retain their scope.

## Differences and provenance

Paths below are relative to the pinned upstream tree above. No upstream code or assets were
copied. Follow-up rendering work will independently implement the ideas described here.

| Area             | Upstream paths / behavior                                                                                                                                                                                  | Dayframe implementation and decision                                                                                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture     | `dashboard/package.json`, `vite.config.js`, `js/app.js`: Vite/plain JS, global state, scaled 1280 × 800 canvas                                                                                             | Static Astro/TypeScript/UnoCSS, responsive rem-based density, Worker authorization boundary. Retain local architecture.                                                                                                                                                   |
| Product breadth  | `js/data.js`, `js/views/{home,calendar,tasks,shopping,control,agents}.js`, `js/system.js`: broad prototype backed by mock data, including simulated time                                                   | Live French weather, private photos/settings and real IANA schedules. Agenda is an honest empty integration point. Prototype screens are design references, not ready integrations.                                                                                       |
| Photos           | `js/slideshow.js`, `js/views/photos.js`: Picsum images, portrait pairs/collages, captions, favorites and anniversaries                                                                                     | Authenticated KV storage, sequential WebP optimization, duplicate review, current/next image bounds and five-minute privacy lease. Retain privacy/memory limits; consider captions or portrait pairs later. Avoid continuous Ken Burns motion and blur.                   |
| Display behavior | `js/app.js`: idle return to Home/ambient, demo clock and host-local night hours                                                                                                                            | Configurable Paris/IANA schedules, temporary per-display overrides, clock-correction handling and explicit cleanup. Retain these semantics.                                                                                                                               |
| Native kiosk     | `dashboard/kiosk/README.md`, `src/com/wesbos/homehq/MainActivity.java`: primarily system WebView, optional HOME role, accessibility navigation, clock/certificate/load retry; optional bundled static site | Separate GeckoView 143 runtime, strict origins/setup, clock gate before profile creation, bounded recovery, separate supervisor and physical maintenance. Existing operational acceptance has version-specific limits; no system WebView change justified by this review. |
| Diagnostics      | `dashboard/js/diag.js`: opt-in timing overlay and visual A/B switches                                                                                                                                      | Native process sampling exists; browser render/data-refresh correlation could improve. Consider bounded, opt-in diagnostics with measured overhead.                                                                                                                       |

## Prioritized improvements

1. **Avoid unchanged rendering work.** Cache clock formatters per locale/timezone;
   update clock/date DOM only when displayed values change. Preserve independent frequent
   schedule/privacy checks. Keep chart/forecast nodes while weather data and local day are
   unchanged; update the time marker, stale age and time-sensitive advice separately.
   Defer weather DOM updates while Morning/the document is hidden, retaining data fetching,
   cache and retry behavior. Use module-local state, without a shared store or dependency.
2. **Measure remaining continuous animation cost.** Current Dayframe has four still forecast
   icons and one animated current icon. [Issue #143](https://github.com/wesbos/photo-frame-dashboard/issues/143)
   and merged PR #147 / `docs/building-for-the-frame.md` report high cost even for one
   animated icon on other A33/WebView units. A controlled GeckoView comparison is needed;
   neither those numbers nor our overnight correlation establish animation as the memory
   growth cause. Do not introduce blind periodic reloads as a substitute for diagnosis.
3. **Improve bounded diagnostics** before attributing memory steps: correlate mode,
   forecast requests, render counts, decodes and native recovery. The upstream continuous
   animation-frame sampler itself has overhead and is not a normal runtime requirement.
4. **Investigate USB recovery separately.** New `docs/dragontouch-classic10.md` reports our
   exact firmware string `Classic10_A33M187_20250910-1617_V09`, root USB ADB and a WebView
   replacement on another unit. Cable/auth details and restore are incomplete; this is not
   our acceptance evidence or an instruction to replace WebView. `docs/dragontouch-classic10-charm.md`
   describes a different Frameo/WebView-106 model; Modern10 Charm also remains distinct.
5. **Add selected household features later.** A protected next-appointment card, optional
   captions or portrait pairing could add value after stability acceptance. Calendar and
   home automation need actual providers/authorization; mock data cannot supply them.

[Issue #156](https://github.com/wesbos/photo-frame-dashboard/issues/156) reports benefits from
caching `Intl.DateTimeFormat`, rendering only changed data and minute clock updates.
Its reported performance gains concern another frame/WebView implementation, not ours.
Local candidates are `src/lib/dashboard/{config,controller}.ts` and
`src/lib/weather/{service,view}.ts`. Our
[overnight analysis](hardware/overnight-analysis-20261020.md) distinguishes sustained GPU
process CPU from separate main-process memory growth and records attribution limits.

## License and acceptance boundaries

Upstream added an MIT `LICENSE` in commit `34d04b8`. The reviewed current license names
Wes Bos, copyright 2026, and requires retaining copyright and permission notices for copies
or substantial portions. Future reuse must record exact paths/revision/modifications and
check separate asset rights. Earlier records finding no license at `e97c50b` remain accurate.
No copied material is introduced by this comparison.

Retain Dayframe's HTTPS/authentication boundary, private-photo retention limits and €0
recurring-cost requirement. Upstream local HTTP, system modifications, broad URL handling,
accessibility grants and daily reload advice are not automatic adoption decisions. Hardware
security changes remain deferred at the owner's request. Physical performance, outage and
extended-stability acceptance remain separate from browser tests and source inspection.
