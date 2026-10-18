# Morning weather (M2)

The browser requests Open-Meteo directly for the public Annecy example coordinates in `src/lib/dashboard/config.ts`. Change location, latitude, longitude and timezone together when adapting the example. These are checked-in defaults, not persisted settings; M4 adds private configuration. No geolocation permission, account, API key, proxy, or new Cloudflare service is used. The provider sees the display's IP address and requested public coordinates; requests omit credentials and referrer.

`src/lib/weather/adapter.ts` requests two forecast days, five current fields, five hourly fields and two daily fields: temperature, apparent temperature, condition code, day/night, precipitation amount/probability, and daily extremes as applicable. The normalized model includes location, timezone, metric units, fetch time and absolute hourly timestamps. The adapter rejects wrong units/timezone, missing numeric values, invalid ranges, misaligned arrays, gaps, unordered times, inverted extremes, and outdated/incomplete forecasts. Unknown condition codes retain temperatures and use an explicit fallback.

Unix hourly timestamps are formatted with the IANA timezone, independently of the browser's timezone. Daily dates follow the provider's fixed `utc_offset_seconds` convention so the autumn DST change cannot repeat a date. See [Open-Meteo time parameters](https://open-meteo.com/en/docs). Daily extrema only appear when their date matches today's local date.

## Refresh and recovery

- One request on first use, then approximately every 30 minutes; a fresh cache delays the first request until due. Switching modes does not create requests or timers.
- A single scheduler updates age and chart position each minute. Visibility/online events check the existing deadline. Requests time out after 12 seconds; failures retry after 1, 5, 15, then at most once every 30 minutes. There is no infinite immediate retry loop.
- Page exit aborts the request and clears the scheduler; a restored page resumes it. Clock/navigation operate independently.
- One versioned localStorage entry holds the last validated provider response and fetch time, keyed by coordinates/timezone. Reads revalidate through the same adapter. Entries from the future, malformed entries, and entries over 72 hours old are ignored on load. Cache failures fall back to in-memory weather.
- A failed refresh or a fetch/current timestamp at least 45 minutes old marks the display stale. It shows cache age and the last reading's date/time, and replaces current advice with a warning. Existing in-memory weather remains visible through extended failures. Expired forecast ranges show an unavailable message.
- A successful response replaces the cache; failed responses never replace valid weather. The initial unavailable state has no fabricated temperature or forecast.

Only public weather is persisted. This does not establish offline app-shell loading, private-photo caching, or credential retention. If the browser cannot load the site itself while offline, its weather cache alone cannot start the app. No service worker is added.

## Deterministic advice and icons

Twelve hourly samples start with the current hour. The temperature is a yellow line using the left °C axis; precipitation probability is a blue bar using the right % axis. A dotted marker follows the actual time. A hidden HTML table provides each hour, temperature, probability and French condition. Color is supplemented by shapes, labels and a legend.

A forecast risk begins at **50% probability or 0.1 mm** in an hourly sample. Current precipitation uses the current code/amount, separately from the forecast probability. Snow, freezing precipitation and storms get specific current wording. Future advice names the first risk hour; a low-risk statement applies only to the displayed period, never the entire day. Short/missing forecast coverage has no dry-weather claim. These thresholds are product heuristics, not official alerts. No AI service is used.

`conditions.ts` separates WMO codes, semantic conditions, French labels, and literal day/night Meteocons classes. All 29 specification codes (including 97), plus missing/unknown fallback, are tested against the installed icon collection. UnoCSS explicitly scans the browser TypeScript source. Only the large current-conditions Fill icon animates by default; hourly chart icons always use the bundled static images. The build also bundles a static SVG for each used icon, removing SVG animation elements and revealing initially transparent rain paths. The weather component always selects these still images for hourly icons and uses them for the current icon with `prefers-reduced-motion: reduce`, including when the preference changes while the page is open. This works without JavaScript or external requests. Actual-frame animation performance remains unverified pending M6.

When upgrading an already-running dev server from the original static-only config, restart it (`pnpm exec astro dev stop`, then `pnpm run dev`). The original config mutated the imported icon collection in memory; hot reloading the config or refreshing the browser cannot restore animation elements in that cached collection. A fresh process loads the unmodified SVGs.

## Deterministic development

`tests/fixtures/weather.ts` supplies the synthetic Annecy scenario; browser tests intercept every weather request and freeze the clock. After `pnpm build`, use `pnpm exec playwright test tests/e2e/weather.spec.ts --project=chromium --ui` to inspect those scenarios locally without live weather. Normal `pnpm dev` deliberately exercises the real provider. Fixtures and test routing are not imported into the production bundle.

## Provider terms and request budget

Reviewed 16 October 2026: the [free API terms](https://open-meteo.com/en/terms) allow personal noncommercial use below 10,000 calls/day, 5,000/hour and 600/minute. The [pricing page](https://open-meteo.com/en/pricing) also lists 300,000/month and variable-weighted calls. The [data licence](https://open-meteo.com/en/licence) requires attribution, a licence link, and disclosure of adaptation. The UI links Open-Meteo and CC BY 4.0 beside the data; rounding, French descriptions, charts and derived advice are disclosed here and as “présentation adaptée” on screen. No provider uptime guarantee is assumed.

An uninterrupted display makes about **48 HTTP requests/day**, or **1,488 in 31 days**. Three displays make about **144/day**, or **4,464/month**, plus cold starts and bounded retries. Conservatively count the 12 requested variable slots as 1.2 calls/request: about **173 calls/day and 5,357/month** for three displays, well below the published allowance. A sustained outage adds only the initial short retry steps before returning to a 30-minute cadence. Tabs have independent schedulers and persistent failure backoff is not shared across reloads: many users/tabs or automated reload loops require a new budget review. This budget covers the intended household, not an unrestricted public weather service.

No subscription or billing account is configured. Quota rejection becomes a normal cached/unavailable state. Reassess terms and measured usage before commercial use, additional providers, or a proxy.

## Upstream and visual provenance

Refreshed upstream review on 16 October 2026 at `e97c50ba459c49ea8237259f69b95cd28054b628` (current HEAD of Wes Bos's [photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)). Inspected `README.md`, `dashboard/js/data.js` (mock weather), `dashboard/js/app.js` (`weatherNow` and `hourly`), `dashboard/js/views/home.js` (clock, weather hierarchy and seven-hour row), `dashboard/css/views/home.css`, and the repository license-file inventory. No license file was found, consistent with ADR 0001; no upstream code or artwork is copied.

Retained ideas: glanceable large temperature/clock, brief rain advice, and bounded hourly information. Deliberate differences: independently written TypeScript adapter, live Open-Meteo data, French labels, full WMO/Meteocons mapping, absolute timestamps, distinct SVG chart axes, validated cache and backoff. Upstream's repeating hour-indexed fixture data is not used as live data or as tomorrow's forecast.

The specification references approved mockups that are absent from this checkout. M2 therefore continues M1's **explicitly provisional** original Annecy SVG and panel layout; visual conformity to those mockups is unverified. No new external assets are introduced. Screenshots use synthetic weather and desktop engines/iPhone emulation; Classic 10 compatibility still requires M6.

## Display readability

See [display density](display-density.md) for Standard/Large presets, frame provisioning, preference persistence, chart presentation and accessibility verification.
