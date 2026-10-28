# Morning weather (M2)

The browser requests Open-Meteo directly for the public Annecy example coordinates in `src/lib/dashboard/config.ts`. Change location, latitude, longitude and timezone together when adapting the example. These are checked-in defaults, not persisted settings; M4 adds private configuration. No geolocation permission, account, API key, proxy, or new Cloudflare service is used. The provider sees the display's IP address and requested public coordinates; requests omit credentials and referrer.

`src/lib/weather/adapter.ts` requests seven forecast days, five current fields, five hourly fields and four daily fields: temperature, apparent temperature, condition code, day/night, precipitation amount/probability, and daily extremes, condition code and maximum precipitation probability as applicable. The normalized model includes location, timezone, metric units, fetch time and absolute hourly timestamps. The adapter rejects wrong units/timezone, missing numeric values, invalid ranges, misaligned arrays, gaps, unordered times, inverted extremes, and outdated/incomplete forecasts. Unknown condition codes retain temperatures and use an explicit fallback.

Unix hourly timestamps are formatted with the IANA timezone, independently of the browser's timezone. Daily dates follow the provider's fixed `utc_offset_seconds` convention so the autumn DST change cannot repeat a date. See [Open-Meteo time parameters](https://open-meteo.com/en/docs). Daily extrema only appear when their date matches today's local date.

## Refresh and recovery

- One request on first use, then at the earlier of 30 minutes after retrieval or 45 minutes after the conditions timestamp; stale startup cache requests immediately. Switching modes does not create requests or timers.
- A single scheduler updates age and chart position each minute. Visibility/online events check the existing deadline. Requests time out after 12 seconds; failures and stale HTTP 200 responses share retries after 1, 5, 15, then every 30 minutes. Expired freshness deadlines cannot bypass recovery. There is no infinite immediate retry loop.
- Page exit aborts the request and clears the scheduler; a restored page resumes it. Clock/navigation operate independently.
- One versioned localStorage entry holds the last validated provider response and fetch time, keyed by coordinates/timezone. Reads revalidate through the same adapter. Entries from the future, malformed entries, and entries over 72 hours old are ignored on load. Cache failures fall back to in-memory weather.
- A failed refresh or a fetch/current timestamp at least 45 minutes old marks the display stale. It shows the conditions time using the configured timezone, including date/year when needed, and replaces current advice with a dated warning shared with Photos. Existing in-memory weather remains visible through extended failures. Expired forecast ranges show an unavailable message.
- Older conditions never replace retained weather or cache. Equal timestamps may update forecasts but cannot reset conditions age or an active recovery sequence. Fresh advancing conditions reset recovery. Requests disable HTTP cache reuse with `cache: no-store`; application fallback remains validated. The initial unavailable state has no fabricated temperature or forecast.

Only public weather is persisted. This does not establish offline app-shell loading, private-photo caching, or credential retention. If the browser cannot load the site itself while offline, its weather cache alone cannot start the app. No service worker is added.

## Deterministic advice and icons

Twelve hourly samples start with the current hour. The temperature is a yellow line using the left °C axis; precipitation probability is a blue bar using the right % axis. A dotted marker follows the actual time. A hidden HTML table provides each hour, temperature, probability and French condition. Color is supplemented by shapes, labels and a legend.

A forecast risk begins at **50% probability or 0.1 mm** in an hourly sample. Current precipitation uses the current code/amount, separately from the forecast probability. Snow, freezing precipitation and storms get specific current wording. Future advice names the first risk hour; a low-risk statement applies only to the displayed period, never the entire day. Short/missing forecast coverage has no dry-weather claim. These thresholds are product heuristics, not official alerts. No AI service is used.

`conditions.ts` separates WMO codes, semantic conditions, French labels, and literal day/night Meteocons classes. All 29 specification codes (including 97), plus missing/unknown fallback, are tested against the installed icon collection. UnoCSS explicitly scans the browser TypeScript source. Only the large current-conditions Fill icon animates by default; hourly chart icons always use the bundled static images. The build also bundles a static SVG for each used icon, removing SVG animation elements and revealing initially transparent rain paths. The weather component always selects these still images for hourly icons and uses them for the current icon with `prefers-reduced-motion: reduce`, including when the preference changes while the page is open. This works without JavaScript or external requests. Actual-frame animation performance remains unverified pending M6.

The build applies `src/lib/weather/icon-timing.ts` to the complete Meteocons collection before UnoCSS generates images. In the pinned Iconify 1.2.4 data, 158 of 450 icons contain renamed animation IDs with legacy restart references. The repair derives replacements from the known numeric-start/self-end timing pattern, preserves starts/delays/durations and valid links, and updates shared restart events too. Conflicting restart periods or remaining dangling timing references fail the build instead of silently emitting a broken icon. Already-correct SVGs remain unchanged, so a corrected package needs no manual ID list. This is a scoped transform for the trusted collection, not a general SVG repair or sanitizer.

Regression checks cover reference integrity and idempotency across all 450 installed icons, valid cross-links and independent loops, shared wind/smoke timing, and rejection of unsupported/ambiguous timing. Browser checks inline the exact bundled CSS image only to control SVG time, then compare animated opacity at initial, third and tenth cycles for day/night drizzle, sleet, rain, snow, showers, lightning and hail. Static hourly and reduced-motion checks remain separate. Desktop playback does not close actual-frame performance/paint acceptance.

When upgrading an already-running dev server from the original static-only config, restart it (`pnpm exec astro dev stop`, then `pnpm run dev`). The original config mutated the imported icon collection in memory; hot reloading the config or refreshing the browser cannot restore animation elements in that cached collection. A fresh process loads the unmodified SVGs.

## Deterministic development

`tests/fixtures/weather.ts` supplies the synthetic Annecy scenario; browser tests intercept every weather request and freeze the clock. After `pnpm build`, use `pnpm exec playwright test tests/e2e/weather.spec.ts --project=chromium --ui` to inspect those scenarios locally without live weather. Normal `pnpm dev` deliberately exercises the real provider. Fixtures and test routing are not imported into the production bundle.

## Provider terms and request budget

Rechecked 27 October 2026: the [free API terms](https://open-meteo.com/en/terms) allow personal noncommercial use below 10,000 calls/day, 5,000/hour and 600/minute. The [pricing page](https://open-meteo.com/en/pricing) also lists 300,000/month and variable-weighted calls. The [data licence](https://open-meteo.com/en/licence) requires attribution, a licence link, and disclosure of adaptation. The UI links Open-Meteo and CC BY 4.0 beside the data; rounding, French descriptions, charts and derived advice are disclosed here and as “présentation adaptée” on screen. No provider uptime guarantee is assumed.

With ordinary fresh conditions, an uninterrupted display makes about **48 HTTP
requests/day**. Persistent stale HTTP 200s and failures settle at the same cadence,
with at most **52 requests in the first 24 hours** including the 1/5/15-minute
recovery steps (request latency only reduces this count). Three displays therefore
budget 156 HTTP requests/day or 4,836 in 31 days. Conservatively count the 14
current/hourly/daily variable slots as 1.4 calls/request: **219 weighted calls/day,
6,771/month** rounded up, below the published 10,000/day and 300,000/month limits.
Seven days is below the provider's two-week duration multiplier. Opening, selecting
and closing forecasts makes **zero additional requests**. Unusually old but still
fresh replies can bring forward the normal freshness deadline; reloads and new
tabs also add requests, so these estimates are for continuous household displays,
not a hard global request cap or unrestricted public service. Backoff is local to
each service lifetime. Reassess usage for many tabs or automated reload loops.

The same response includes all seven days of hourly data: synthetic JSON grew
from 2,536 bytes (old two-day fixture) to 7,354 bytes; this is fixture measurement,
not a provider byte guarantee. Validation bounds hourly rows to 175 (seven 25-hour
local days) and daily rows to seven. No per-tap download, service, secret, proxy or
billing change is introduced.

No subscription or billing account is configured. Quota rejection becomes a normal cached/unavailable state. Reassess terms and measured usage before commercial use, additional providers, or a proxy.

## Upstream and visual provenance

Refreshed upstream review on 16 October 2026 at `e97c50ba459c49ea8237259f69b95cd28054b628` (current HEAD of Wes Bos's [photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)). Inspected `README.md`, `dashboard/js/data.js` (mock weather), `dashboard/js/app.js` (`weatherNow` and `hourly`), `dashboard/js/views/home.js` (clock, weather hierarchy and seven-hour row), `dashboard/css/views/home.css`, and the repository license-file inventory. No license file was found, consistent with ADR 0001; no upstream code or artwork is copied.

Retained ideas: glanceable large temperature/clock, brief rain advice, and bounded hourly information. Deliberate differences: independently written TypeScript adapter, live Open-Meteo data, French labels, full WMO/Meteocons mapping, absolute timestamps, distinct SVG chart axes, validated cache and backoff. Upstream's repeating hour-indexed fixture data is not used as live data or as tomorrow's forecast.

The specification references approved mockups that are absent from this checkout. M2 therefore continues M1's **explicitly provisional** original Annecy SVG and panel layout; visual conformity to those mockups is unverified. No new external assets are introduced. Screenshots use synthetic weather and desktop engines/iPhone emulation; Classic 10 compatibility still requires M6.

## Display readability

See [display density](display-density.md) for Standard/Large presets, frame provisioning, preference persistence, chart presentation and accessibility verification.

## Changed-value rendering — 20 October 2026

Clock/date and forecast date/hour formatters are cached for the current timezone and
recreated when it changes. The controller still checks schedules, navigation and private
photo deadlines every second, but formats the clock once per minute or timezone change,
writes clock text only when changed, and writes date text only when changed.

Weather fetching, validated cache and retry/backoff continue independently of the active
mode. Morning DOM rendering is deferred while another mode or a hidden document is active;
returning renders the latest retained state. Forecast cards, rain bars and temperature
curve retain their nodes until a new weather object or local day arrives. Minute updates
move the existing current-time marker and refresh stale age/advice with guarded text writes.
No state-management dependency, shared store, private cache, native change or animation
policy change is introduced. This implements item 1 of the
[upstream comparison](upstream-comparison-20261020.md) independently; no upstream code/assets
copied. Browser regressions check stable nodes/clock writes and inactive-mode data recovery;
actual Classic 10 CPU/memory benefit remains unmeasured.

## Official vigilance — 21 October 2026

Morning adds a conditional departmental banner above the weather cards. It uses
Météo-France warnings distributed by [EUMETNET Meteoalarm's public France Atom
feed](https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-france), independently
of the Open-Meteo forecast. CAP Moderate/Severe/Extreme map to written yellow,
orange and red levels. The strongest unexpired warning leads, including future
onsets; details expose all matching warnings and their issue/validity times.
Tests and unrelated departments are excluded. No warning is inferred from a WMO
condition or precipitation threshold.

Coverage is deliberately limited to Haute-Savoie for the checked-in Annecy
coordinates. Changing coordinates displays an unsupported-location notice rather
than applying this department to another location. Department selection/geographic
lookup is a future extension. No household coordinates, account or secret are sent
to Meteoalarm: the Worker requests the same public national feed for all displays.

`GET /api/weather-alerts` is public national data, with a fixed upstream URL,
manual redirects, an 8-second timeout, a 2 MB limit, one in-flight request per
Worker isolate, and a two-minute in-memory cache. It adds no service, binding,
subscription or dependency. The raw feed is redistributed unchanged and linked
alongside the adapted departmental presentation. The browser parses namespace-aware
XML as data, inserts only text, and never follows provider-supplied links or injects
provider markup. Malformed relevant warnings fail closed to unavailable.

Morning checks every two minutes using the existing dashboard tick; other modes do
not poll. Failures retry after one minute. Visibility/page lifecycle abort pending
requests; returning to Morning rechecks deadlines. No warning data is persisted.
A failed refresh explicitly labels still-recent warnings; expired warnings disappear,
and ten minutes without a successful retrieval becomes unavailable. Publication
time is separate: the live provider can retain a snapshot for over thirty minutes
without changing warnings, so a snapshot over two hours old (or more than five
minutes in the future) is rejected. Repeated successful fetches cannot make such
an old publication current. A failed or outdated feed never implies an all-clear. A fresh
feed with no matching warnings hides the banner. DOM updates are guarded per minute,
feed revision, failure and configured coordinates.

A continuous four-hour Morning session makes about 120 requests per display/day;
three displays make about 360, plus initial loads and bounded retries. An always-open
manual Morning override makes 720/day/display. The shared isolate cache reduces
national-feed downloads. With normal traffic, isolate, HTTP and browser caches add
at most roughly six minutes before a newly published bulletin is seen (average
below five); outages are explicitly unavailable rather than operational warnings.
This remains within the household Workers Free request budget; no paid resource is
enabled. Reassess caching and quotas before broader/public use.

The [Meteoalarm terms](https://meteoalarm.org/en/live/page/terms-and-conditions)
were inspected via the website's public content service on 21 October 2026
(last-updated text: 15 March 2024). They permit warning-information reuse under
terms equivalent to CC BY 4.0 with added attribution, original-information, issue-time,
link, timeliness and disclaimer requirements. The banner names Météo-France, details
link Meteoalarm and the unchanged original feed, and forecast methodology links the
licence, identifies the adaptation and includes the required delay disclaimer.
No Meteoalarm artwork or website code is copied. A live national-feed download
confirmed the namespace/field structure and current feed timestamp; synthetic browser
fixtures establish departmental warning behavior, not a real current Haute-Savoie
warning or actual-frame acceptance.

## Seven-day browsing (F02) — 27 October 2026

The Morning **Prévisions sur 7 jours** button opens a native modal dialog. Seven
local calendar dates, today through day six, show condition, low/high and daily
maximum precipitation probability. Selecting a day shows only returned hourly
coverage, including timezone offsets to distinguish repeated DST hours. Missing
days, missing rain values and exhausted hourly coverage remain explicitly
unavailable. No values roll forward from a previous day. Old two-day v1 caches
remain readable and display unavailable values for their missing fields/days.

The shared weather service owns loading, stale/offline and recovery states; the
panel adds no fetch, scheduler, mode or persistent selection. Close/Escape restores
focus to the opener; mode changes and override expiry close it. Reopening selects
today. Native modal focus containment, static verified Meteocons, internal hourly
scrolling and responsive daily cards keep the frame page still and mobile usable.
Freshness warnings follow F01; vigilance remains independent.

Provider fields and terms were checked in the official [forecast documentation](https://open-meteo.com/en/docs),
[terms](https://open-meteo.com/en/terms), [pricing](https://open-meteo.com/en/pricing)
and [licence](https://open-meteo.com/en/licence). French text, rounded temperatures
and daily/hourly presentation adapt the attributed CC BY 4.0 data.

Upstream refreshed at `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189` (GitHub default
head verified 27 October). Read root MIT `LICENSE`, `dashboard/js/data.js` and
`dashboard/js/views/home.js`: retained glanceable hierarchy as an idea; independently
implemented timestamp recovery and dated seven-day browsing instead of repeating
hour-indexed mock weather. No upstream source or assets copied.

Rollback: revert the dialog, view/controller integration and provider-field change
together; revert freshness independently if needed. The v1 cache remains compatible
with the previous build (new arrays exceed its old bounds and safely refetch).
No migration, private cache, navigation worker or device change. Local synthetic
validation and rollout state are recorded in the implementation plan; desktop
browsers/emulation do not establish physical Classic 10 or iPhone acceptance.

## Reading age — 28 October 2026

Morning and Photos now always show a quiet reading-age label when weather exists:
**Relevé il y a 15 min**, with **· non actualisé** when stale or a refresh failed.
The source is the provider's `current.time`, not `fetchedAt`. The existing minute
scheduler advances the age without downloads, including in Photos and offline.
Under a minute reads “à l’instant”; today's older readings use minutes then hours.
Previous local dates use “hier à…” or an explicit date, including the year at a
year boundary. Exact date/time/timezone are retained on a semantic `<time>` in its
`datetime`, title and accessible label. Unavailable weather has no fabricated age.
Stale Morning departure guidance and vigilance's separate policy are preserved.
No scheduler, API request, cache format, setting, dependency or cost change.
