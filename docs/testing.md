# Verification suite

`pnpm verify` is the complete local gate: types, formatting, Vitest and Worker
integration tests, the ordinary build and browser tests, then an enabled offline
navigation build and its browser tests. CI runs these same checks in independent
jobs for both pull requests and main pushes; it does not reduce release coverage.

## Permanent test policy

The suite should protect lasting product behavior and important failure boundaries
with the smallest set of reliable checks that distinguishes correct from broken
behavior. A passing test count or coverage percentage is not a quality target.
A completed issue, temporary experiment or implementation detail does not by
itself justify a permanent regression test.

### Decide what deserves a test

Before adding a case, identify the concrete regression it would catch and inspect
existing coverage. Extend or improve the existing owning test when it already
exercises that journey. Add a separate case when it protects a distinct outcome,
boundary or failure mode; avoid replaying setup and an entire workflow for one
more assertion. Keep tests independent and readable rather than merging unrelated
contracts into a long scenario just to reduce the test count.

Use the cheapest layer that can reliably detect the regression:

| Layer                                | Owns                                                                   | Example                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Unit                                 | Pure rules, parsing, validation, permutations and numerical boundaries | Exhaustive weather mappings, DST/date selection and upload-size boundaries                         |
| Worker integration                   | Real authorization, HTTP, persistence and transaction contracts        | Rejected private reads, retry idempotency and SQLite/KV failure handling                           |
| Browser                              | Wiring and behavior that requires an actual browser                    | Import preview/upload flow, focus paint, responsive layout, IndexedDB and service-worker lifecycle |
| Explicit device/visual investigation | Acceptance evidence and temporary diagnostics                          | Physical GeckoView recovery or an owner-requested screenshot review                                |

Exhaustive rule/provider permutations belong in unit or integration tests. Browser
journeys use representative inputs to prove the pieces work together; they do not
repeat every lower-layer variant. Some overlap is intentional: testing a pure
validation rule does not prove the real endpoint enforces it or the UI handles
its rejection. Keep that boundary coverage and explain its purpose.

### Keep assertions meaningful

Assert observable results or a documented security, compatibility or performance
contract. Test names must describe what the assertions actually establish.
Prefer refreshed data and retained focus to requiring a particular DOM node to
be destroyed or retained. DOM reuse and request-count assertions remain useful
when they protect an explicit frame-performance or provider-usage contract.

A screenshot saved for inspection is diagnostic output. Permanent visual checks
must compare relevant rendered pixels or geometry; CSS properties alone do not
prove visible paint. Capture images on success only when an assertion uses them;
keep failure diagnostics and explicit visual-review captures available.

For a bug fix, check that the new or changed assertion detects the original defect
when practical. Use a focused before-fix run or a small deliberate mutation for a
suspected weak assertion; do not add a project-wide mutation run to every change.
Tests that only confirm their mock's response or cannot detect their claimed
regression need to be strengthened, replaced or removed.

### Limit browser and platform multiplication

Default ordinary journeys to Firefox at 1280 × 800. Additional engines or viewports
need a specific rendering, API, input or layout reason, using the tags and coverage
map below. Do not add `@all-browsers` as a precaution for every feature. Mobile
WebKit usually provides WebKit engine coverage; desktop WebKit is additional
coverage when its layout or keyboard behavior matters. Cover today's large-type
layout; legacy Standard settings need bounded compatibility coverage, not a second
full scenario sweep. Keep PR and main selections identical.

Preserve the coverage map's authorization, privacy clearing, real storage,
offline recovery and engine-specific contracts. Similar titles do not establish
redundancy. Desktop emulation remains separate from physical-device acceptance;
adding automated coverage never reopens an owner-deferred device/security gate.

### Maintain the suite as the product changes

When behavior is replaced or retired, update or remove its old tests as part of
the same change. Retain compatibility cases only for supported old data or clients.
A production journey should own detailed feature coverage; a separate diagnostic
page generally needs only its own meaningful smoke and any distinct safety guards.
Temporary probes and evidence collection do not automatically join the release
suite. Docs-only changes use formatting, link and whitespace checks.

For additions or changes, explain briefly in the issue or review:

- Which regression is newly protected, and why existing coverage is insufficient.
- Why this layer and any extra browser assignments are needed.
- Whether older overlapping coverage was extended, consolidated or retired.
- For materially expensive changes, what the timing reports show and why the cost
  is justified.

This is a reasoning checklist, not a requirement for a new document per test.
There is no one-in/one-out quota or ban on adding important coverage. Start with
focused checks; run the complete gate for releases. Do not repeatedly run unrelated
full suites after checks pass unless new changes or unresolved failures justify it.
Measure material suite growth using the existing reports and representative hosted
runs; do not benchmark every assertion or add routine local benchmarking to CI.

## CI artifact handoff

The `quality` job runs types, lint and unit/Worker tests while `build` produces
ordinary and navigation-enabled assets. Each build is uploaded once as a one-day
`regular-assets` or `navigation-assets` artifact. The three `playwright` matrix jobs
download their respective artifacts into `dist/` and run concurrently: two shards
cover the regular suite and one job covers navigation. No browser job builds or
changes the candidate assets. Each regular shard keeps its two isolated workers;
the navigation fault server remains serial on its own runner.

Browser jobs use the official Playwright Noble image pinned to the exact
`@playwright/test` version in `package.json`, with Node from `.nvmrc`. Update the
image and its version guard together with Playwright. The image supplies browsers
and Linux dependencies; the job still installs the locked project dependencies.
See the [official container guidance](https://playwright.dev/docs/docker).

The required `checks` status succeeds only when quality, build and all browser
jobs succeed. Failure, cancellation or a skipped prerequisite fails the gate.
Keep its `always()` condition and explicit result checks: otherwise a failed
prerequisite skips the aggregate job, and [GitHub accepts skipped required jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions)
for branch protection. Only a successful main push can deploy: it downloads that run's exact
`navigation-assets` artifact, enforces the Free-plan assertion, then uploads and
checks the live deployment. Artifacts are candidates until the complete gate
passes; their presence alone never authorizes deployment. Browser jobs receive
no production credentials. Local `pnpm verify` and its ordinary-build restoration
behavior remain available unchanged.

Main pushes, pull requests and manual dispatch use the same verification jobs.
Feature branches use a PR or manual dispatch, avoiding duplicate push/PR runs for
the same change. Manual dispatch never deploys. Superseded verification jobs can
be cancelled independently; active production uploads retain their separate,
non-cancelling concurrency group.

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
| Clipboard experiment                 | One mobile WebKit smoke covers previews, conversion, no uploads, late-result clearing, denial and HTML rejection. Production import cases live in the photo administration suite.                             |

Desktop Firefox and mobile emulation provide local synthetic evidence. They do
not establish physical GeckoView or iPhone acceptance. Existing device and
security deferrals remain in their issues and hardware runbooks.

## Timing and isolation

Both browser suites retain JSON timing reports under
`test-results/{regular,navigation}/results.json`. GitHub uploads these as the
seven-day `browser-timings-{regular,navigation}-{shard}` artifacts, including on successful runs. Failure
screenshots and details remain in the corresponding `browser-failures-*` artifact. Compare timings on the same
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
cleanup before asserting its outcome. Wait for native network/storage work to
settle before advancing a deadline that it schedules: recovery checks observe the
retry button becoming enabled after health completes, rather than racing a timer
against an outstanding request. Rendered animation/stillness checks retain
the elapsed time needed to sample real pixels.

Successful runs capture images only when their pixels are part of an assertion,
including motion, overcast paint and focus rings. Ordinary state screenshots are
collected during explicit visual review. Automatic failure screenshots and focus
diagnostics remain available for debugging. A saved screenshot alone does not
establish visual regression coverage.

Browser animation checks use representative drizzle/snow, rain, lightning and
hail graphs across day/night examples. One collection-wide unit pass checks all
installed icons after repair and expansion, including each stage's idempotency.
Targeted transform fixtures retain ambiguous-link and geometry regressions.
Tests assert refreshed forecast data, selection and focus without requiring DOM
replacement. The separate weather node-reuse checks protect the documented frame
performance behavior.

Aim for about five minutes through the complete hosted verification gate and
six minutes through production smoke, excluding runner queues. These are review
targets, not hard failure thresholds or a reason to drop valuable assertions.
Investigate sustained overruns across comparable runs: distinguish setup/network
variation, actual test work, elapsed time and total runner usage. Optimize repeated
work and unnecessary waits before adding parallel runners or narrowing coverage;
more parallelism can reduce elapsed time while increasing compute usage. Keep the
€0 requirement and verified-artifact release gate intact. The measured baseline
and optimization evidence are in [issue #20](https://github.com/codyzu/dayframe/issues/20).

## Provenance

Verification tooling is independently authored. The upstream dashboard
`dashboard/package.json` and root MIT `LICENSE` were reviewed at
`34c91641e3cdd159756e3f1dcc15914148b2beff` on 5 November 2026. That package declares
Vite build/preview/deploy commands and provides no test-suite policy to reuse.
Dayframe keeps its own Astro, Worker, private-photo and offline verification
requirements. No upstream code or assets were copied for this change.
