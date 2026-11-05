# Verification suite

`pnpm verify` is the shared gate for local verification, pull requests and pushes
to main. It checks types and formatting, runs Vitest and Worker integration tests,
builds the ordinary application, runs browser tests, then builds and tests enabled
offline navigation. The release workflow retains that verified enabled build for
deployment. The Free-plan assertion and production smoke checks follow in the
deployment job.

## Choosing coverage

Use Vitest for pure rules, validation boundaries and provider response variants.
Use Worker integration tests for authorization, persistence and HTTP contracts.
Keep browser tests for the wiring between those parts, rendered geometry,
accessibility, image processing, browser storage and lifecycle behavior.

Ordinary browser scenarios run on desktop Firefox at 1280 × 800. Add a browser
tag to the test title when its engine, viewport or input behavior adds coverage. Selection is the
same for every verification entry point. Keep each scenario's assertions intact
when narrowing its browser assignment.

| Tag              | Additional coverage                                                                           |
| ---------------- | --------------------------------------------------------------------------------------------- |
| `@mobile`        | iPhone 13 emulation in WebKit for mobile layout, touch, photo input and storage               |
| `@chromium`      | Chromium for a third implementation of rendering, image processing, storage or lifecycle APIs |
| `@webkit`        | Desktop WebKit where desktop layout, keyboard behavior or SVG rendering differs from mobile   |
| `@all-browsers`  | The small shared compatibility checks that need all four projects                             |
| `@mobile-only`   | A phone-specific import or clipboard experiment, run only on mobile WebKit                    |
| `@chromium-only` | The existing Chromium desktop/narrow viewport sweep                                           |

An untagged scenario still runs on Firefox. Prefer that default for new ordinary
journeys; explain additional browser assignments in the test or this coverage map.
All four browser projects remain available for focused investigation. To repeat a
narrowed scenario on an otherwise excluded engine, temporarily override the
project's grep in a local config and retain the ordinary fixture setup.

## Browser coverage map

| Area                                 | Coverage and rationale                                                                                                                                                                                        |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation and density               | Shared shell and large layout on all four projects. Legacy Standard preferences have one compatibility test. Browser engines retain real SVG motion/reduced-motion checks.                                    |
| Weather, warnings and planning       | Firefox covers refresh, failures, stale data and timing. Mobile adds representative layout/dialog journeys. Cached-weather recovery also runs in Chromium. Provider payload permutations stay in Vitest.      |
| Calendar                             | Render empty, constrained and full agenda shapes on Firefox and mobile. Vitest covers every row-count boundary, DST and date selection.                                                                       |
| Administration                       | Settings UI on Firefox and mobile. Provisioning, persistent cookies and revocation on all three engines.                                                                                                      |
| Photo administration                 | Core upload/review/delete and place/date caption journeys on all projects. Orientation, image privacy and session recovery retain relevant engines. Detailed phone batch-boundary cases run on mobile WebKit. |
| Touch navigation                     | Firefox and mobile exercise gestures, timers and geometry. Actual animation lifecycle and Night colors also cover Chromium and desktop WebKit.                                                                |
| Focus                                | Full dashboard audit on all projects. Settings, setup and photo controls on Firefox and mobile.                                                                                                               |
| Offline photos and fallback document | All three engines, using mobile WebKit for WebKit coverage. Real IndexedDB transactions, cross-tab invalidation, expiration, decoding and private-pixel cleanup stay in browsers.                             |
| Enabled offline navigation           | Every scenario on Chromium, Firefox and mobile WebKit. This suite tests service-worker install/update, network faults, retirement, recovery and reload ordering.                                              |
| Clipboard experiment                 | Mobile WebKit checks its maintained diagnostic route. Production import coverage lives in the photo administration suite.                                                                                     |

Desktop Firefox and mobile emulation provide local synthetic evidence. They do
not establish physical GeckoView or iPhone acceptance. Existing device and
security deferrals remain in their issues and hardware runbooks.

## Timing and isolation

Both browser suites retain JSON timing reports under
`test-results/{regular,navigation}/results.json`. GitHub uploads these as the
seven-day `browser-timings` artifact, including on successful runs. Failure
screenshots and details remain in `browser-failures`. Compare timings on the same
runner class and distinguish queue delay, browser installation, fixture startup,
test execution and deployment.

Regular tests use two workers. Each parallel slot owns a separate HTTPS photo
fixture server on port 8789 or 8791, with independent KV, SQLite, signing authority
and credentials. Tests select their origin using Playwright's stable parallel
index, including after a failed worker is replaced. Each scenario still resets
its own slot's fixture state. Keep the worker count and fixture ports in sync.
The ordinary Wrangler preview serves immutable built assets to both workers.
Offline navigation uses one worker because its fault server has shared controls.
Controlled page clocks may advance real application timers. Tests must still observe the production transition, decode or
cleanup before asserting its outcome. Rendered animation/stillness checks retain
the elapsed time needed to sample real pixels.

An initial working budget is eight minutes for hosted checks and ten minutes
through production smoke, excluding runner queues. Runtime evidence and the
current improvement work belong in [issue #20](https://github.com/codyzu/dayframe/issues/20).

## Provenance

Verification tooling is independently authored. The upstream dashboard
`dashboard/package.json` and root MIT `LICENSE` were reviewed at
`34c91641e3cdd159756e3f1dcc15914148b2beff` on 5 November 2026. That package declares
Vite build/preview/deploy commands and provides no test-suite policy to reuse.
Dayframe keeps its own Astro, Worker, private-photo and offline verification
requirements. No upstream code or assets were copied for this change.
