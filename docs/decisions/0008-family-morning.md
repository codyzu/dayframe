# ADR 0008 — Warm family display and full-day weather

19 October 2026. Web UI iteration; no deployment or device changes. This extends the delivered M1–M5 foundation independently of the concurrent H6 hardware work.

## Design and provenance

Reviewed the local specification, implementation plan, dashboard controller, density/settings precedence, protected slideshow, Open-Meteo adapter/service, condition mapping, icon timing repair and browser tests. The owner's new warm/accessibility requirements supersede the older navy/translucent visual direction. No visual mockup attachment was available in this task; the supplied written organization guides the independently authored design.

Re-inspected Wes Bos's `photo-frame-dashboard` at `e97c50ba459c49ea8237259f69b95cd28054b628`: `dashboard/index.html`, `dashboard/css/tokens.css`, `dashboard/css/views/home.css`, `dashboard/js/views/home.js`. Retain its useful ideas of centralized paper/ink tokens, a glanceable clock/weather/next-event hierarchy and bounded visible event lists. Deliberately use responsive Astro/UnoCSS, real weather, French labels, density preferences, and an empty authorized-data boundary rather than its fixed-size mock household dashboard. The checkout contains no root license permitting copying; **no upstream code or assets copied**. Existing attribution and bundled Meteocons licensing remain unchanged. The existing animated collection, semantic WMO mapping and SVG timing repair are retained; no package substitution or new dependency.

## Theme and layout

`uno.config.ts` owns semantic colors for background, surface, elevated surface, primary/secondary text, border, accent, temperature, rain, advice/ink, warning and warm night colors. UnoCSS emits matching CSS variables; night colors used only in scoped CSS are safelisted. SVG scenery uses extracted fill utilities. Shared `surface` and navigation patterns use these tokens. Global CSS retains only reset and accessibility invariants. Browser metadata and the fullscreen manifest repeat the background color as literal metadata values; manifest launch identity, scope and fullscreen behavior remain unchanged. Component-local CSS handles the scenery, viewport layout, runtime photo images, source disclosure and reduced-motion fallback.

`src/pages/index.astro` owns rem-based size variables for Standard and Large. Existing profile/query/local-storage precedence is preserved. Current icons are 128/132 px. Checkpoints use large explicit time, temperature and rain text. The four animated checkpoint icons share the existing static-image reduced-motion fallback. Opaque cards prevent decorative scenery from changing information contrast. Primary text/surface contrast exceeds 7:1; this is a baseline, not evidence of suitability for an individual reader with low vision. Actual-distance readability, brightness and preferred size must be validated with the family on Classic 10. No medical assumption or separate accessible mode.

The primary landscape layout shows current conditions beside checkpoints and a 100 px numeric plot, then advice and agenda. Secondary methodology is in a disclosure; sources remain visible. Text size stays available beside compact, auto-hiding navigation. Connection retry appears only after weather/configuration failure. Maison and photo controls/admin/setup use the same palette. Nuit uses a warm dark variation without automatic theming or hardware brightness changes.

## Forecast semantics

Pure functions in `src/lib/weather/morning.ts` operate on validated existing hourly data. No new provider or API fields.

- Preserve today's **06:00–22:00 local** hourly samples, including past hours, rather than a rolling window. This retains evening context; after the window, no new clothing advice is inferred from tomorrow. The existing 12-hour legacy summary remains available for its current-condition sentence; the rendered chart and advice use the new full-day functions.
- The configurable-shaped checkpoint array defaults to 08:00 École, 11:30 Midi, 16:30 Sortie, 18:00 Activités. Weekends use Matin/Midi/Après-midi/Soir. Weekdays say “jour d’école habituel”; the disclosure explicitly states that holidays and vacations are not known. No school-calendar inference or appointment creation.
- Match date and local hour with IANA-timezone formatting of absolute timestamps. Exact hours use that sample. Fractional hours linearly interpolate temperature between adjacent hourly samples, use the **maximum of the two hourly probabilities/amounts**, and use the preceding sample's condition/day flag. Missing adjacent samples produce an unavailable checkpoint, never extrapolation or another day's value. Accessible descriptions identify the source-hour range. This gives useful 11:30/16:30 estimates without claiming minute-level rain probability.
- Eight two-hour bars cover [06,08), …, [20,22). Each uses the maximum probability of its two hourly samples. It is **not** a union probability over the interval. Label, SVG description, bar titles and disclosure explain this. Missing second samples omit a bar. The 22:00 temperature endpoint remains available.
- A surface-colored halo separates the copper curve from blue bars where they cross. The temperature curve retains hourly points with bounded cubic handles; the numeric SVG stretches, rem-based time labels do not. Minimal grid/markers, one current-time marker only within bounds, an hourly accessible table, and no extra icon row. Chart temperature range is explicitly stated; probability remains on a fixed 0–100% scale.

## Advice

No LLM, external service or stochastic output. Priority: freezing precipitation/thunderstorm codes → apparent temperature ≤3°C → forecast rain → apparent temperature <15°C jacket → lighter clothing. Rain risk means ≥50% hourly probability or ≥0.2 mm forecast amount; these are practical heuristics, not certainties. Cold and wet advice includes rain protection. Wet future pickup checkpoints are mentioned preferentially; past checkpoints are excluded. Otherwise state the next wet hour or current risk. When dry, show current/daily maximum temperatures and suggest layers if the rise is ≥8°C. At most two short supporting details. No wind claim is made: wind is not in the current validated provider model. Missing-day forecasts give an honest unavailable message. Stale data replaces fresh-looking advice with a request to check conditions, preserving the last reading visibly and exact age for assistive technology.

## Agenda and photos

`Agenda.astro` presents up to three `{time, title}` entries with escaped Astro output and no calendar grid. Production passes no events and explicitly says no agenda is connected; this does not claim there are no appointments. School checkpoints are separate. A future private calendar reader must load entries via an authorized Worker endpoint and render client-side; **never pass household events into prerendered public HTML**. No Google Calendar work or demo appointments.

`defaultSettings.fit` and the static slideshow fallback now use `cover` (fill, cropping allowed). `contain` still shows the entire image. Validated persisted settings override defaults, so an existing saved `contain` survives; new/missing settings use `cover`. The display selector remains a session-only override, matching previous behavior; it does not change shared admin preferences. No storage migration, photo pipeline, retention, authorization or unrelated slideshow change.

## Validation

Focused deterministic tests cover local day range/DST, four checkpoint selection and interpolation/missing data, two-hour maximum aggregation, advice thresholds, and default-versus-explicit framing. Browser tests cover animated/still icons, sizing, full-day data, no invented appointments, contrast, responsive layouts and stale/unavailable states, alongside the existing protected photo/scheduling/administration suite. Final results and screenshot paths are recorded in `docs/ui-redesign.md`. Desktop browsers are not actual Firefox 143/Android acceptance. H6 files and device state remain outside this change.
