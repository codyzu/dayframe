# Dayframe: Implementation Plan

**Status:** M1 complete; M2 implemented and locally verified — M3 onward pending
**Date:** 16 October 2026  
**Requirements:** [Family Dashboard: Technical Specification](technical-specification.md)  
**Primary upstream:** [Wes Bos — photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)

> **Start here, including implementation agents:** Dayframe is based on Wes Bos's dashboard and photo-frame work. Inspect the relevant upstream implementation and research before starting a related task. Preserve attribution, record reuse and deliberate differences, and verify hardware assumptions on our actual device. The local specification remains the authority for Dayframe's requirements.

## 1. Upstream foundation and provenance

### Source map

| Source                                                                                                                                      | Use in Dayframe                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [Upstream README and agent guidance](https://github.com/wesbos/photo-frame-dashboard/blob/main/README.md)                                   | Understand the project, device investigation process, backup/recovery lessons, and entry points.                            |
| [Dashboard source](https://github.com/wesbos/photo-frame-dashboard/tree/main/dashboard)                                                     | Review layout, display behavior, asset handling, deployment, and browser compatibility before building equivalent features. |
| [Kiosk guide](https://github.com/wesbos/photo-frame-dashboard/blob/main/dashboard/kiosk/README.md)                                          | Evaluate kiosk behavior and an existing Android wrapper during M6, if a browser alone is insufficient.                      |
| [Device index](https://github.com/wesbos/photo-frame-dashboard/blob/main/docs/devices.md)                                                   | Find relevant board/firmware reports after identifying our unit.                                                            |
| [Dragon Touch Modern10 Charm notes](https://github.com/wesbos/photo-frame-dashboard/blob/main/docs/dragontouch-modern10-charm.md)           | Related research to investigate, **not a validated procedure for Classic 10**.                                              |
| [Issues](https://github.com/wesbos/photo-frame-dashboard/issues) and [pull requests](https://github.com/wesbos/photo-frame-dashboard/pulls) | Check newer findings relevant to the actual hardware before device work. Treat unmerged procedures as unverified.           |

**Review baseline:** The upstream README and device index were reviewed via GitHub on 16 October 2026. The README describes a Vite dashboard using mock data and Cloudflare Workers, plus an Android kiosk wrapper. This is an initial orientation, not a source-code or license audit. No upstream code or assets have been imported. The subsequent M1 source/license audit is recorded at commit `e97c50ba459c49ea8237259f69b95cd28054b628` in [ADR 0001](decisions/0001-upstream-foundation.md); branch links above move over time.

### Required upstream review before implementation

- [x] M1: Capture an upstream commit SHA; inspect the dashboard source, package manifest, build configuration, styling, and deployment setup at that revision.
- [x] Record useful source paths, adoption decisions, and any incompatibilities in `docs/decisions/0001-upstream-foundation.md`.
- [x] Verify license coverage for each code/asset candidate before copying it. If permission is unclear, use the research as reference and implement locally without copying that material.
- [x] For adapted material, retain required notices and record source permalink, original path, local destination, and modifications. Add a third-party notices file when material is imported.
- [x] Refresh the relevant upstream review when starting a new feature or device session; record the revision actually used. Do not silently absorb upstream changes.

Review upstream first, then decide deliberately. Dayframe keeps Astro/TypeScript/UnoCSS, French weather for Annecy, protected family photos, KV storage, and the strict €0 deployment requirement. An upstream implementation does not override these choices. No automated upstream synchronization or full fork is planned unless the review justifies it.

## 2. Delivery approach

Deliver one demonstrable slice at a time. Keep task IDs in commits/PRs and update this document with validation evidence. M1 is delivered with local and Workers Free acceptance evidence below. M2 has local acceptance evidence below; its public deployment remains pending. M3 onward are pending. A task is done only when its acceptance evidence exists; a mock or desktop-only test must be labeled as such.

```text
M1 foundation → M2 weather → M3 protected photos → M4 administration → M5 display behavior
                                                                            ↓
                                                          M6 device acceptance → M7 optional work
```

Non-destructive hardware discovery can happen as soon as the frame is available. Its findings feed browser and authentication decisions throughout the plan; the web application must remain usable if the frame is unsupported.

### Architecture to establish

- Static Astro pages and locally bundled assets, with small TypeScript modules for clock, scheduling, weather, and slideshow behavior. Add hydration only where needed.
- A lightweight Worker boundary for private reads, uploads, deletes, and persisted settings. Verify API routes cannot fall through to static asset handling in a way that bypasses authorization.
- Provider adapters keep Open-Meteo and KV details out of display components. Pure functions handle WMO mapping, summaries, scheduling, and fingerprint comparisons.
- A shared validation layer defines photo metadata, display-safe configuration, and consistent API errors. Authorization is evaluated server-side for every protected route.
- Browser image processing runs on the uploading device. Workers receive optimized images; no server-side photo transformation service is planned.

Use the source layout proposed in specification §15. Keep ADRs in `docs/decisions/` and deployment/recovery instructions in `docs/operations.md` as those capabilities are implemented.

## 3. M1 — Foundation

**Scope:** Repository tooling, source review, a static dashboard shell, and a free-tier deployment path. Use fixtures and non-private images.

| Task | Work                                                                                                                                                                                                                                                                                                                                                                         | Acceptance evidence                                                                                                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| M1.1 | Complete the upstream review and provenance record above; compare reuse against our stack.                                                                                                                                                                                                                                                                                   | ADR with source revision, paths, license findings, and explicit adopt/adapt/defer decisions.                                               |
| M1.2 | Select compatible versions of Node, package manager, Astro, TypeScript, UnoCSS, Iconify Meteocons, Wrangler, Vitest, Playwright, and lint/format tooling. Verify current official docs and package engine/peer requirements.                                                                                                                                                 | Exact versions recorded in the ADR and manifest, committed lockfile, pinned runtime/package manager, reproducible clean install and build. |
| M1.3 | Scaffold static pages, layout, dashboard controller, example configuration, and locally bundled icons/fonts/assets with documented rights.                                                                                                                                                                                                                                   | French shell renders at 1280 × 800; admin shell adapts to phone/desktop; no kiosk scrolling; reduced motion supported.                     |
| M1.4 | Validate the Astro/static-assets/Worker API integration with a non-sensitive health route. Configure local bindings and ignore private configuration.                                                                                                                                                                                                                        | Local preview serves assets and the API; bundles contain no secrets; separate local and production settings documented.                    |
| M1.5 | Add CI for type checks, lint, unit tests, and build; document deployment with least-privilege CI credentials.                                                                                                                                                                                                                                                                | Required checks pass on a clean checkout; deployment runs only after checks pass.                                                          |
| M1.6 | Complete: Workers plans dashboard visibly confirmed Free / $0 / Current plan on 16 October 2026, with 100,000 requests/day and 10 ms CPU. OAuth subscription read returned 403, so billing was verified in the authenticated dashboard instead. Deployed only Worker + Static Assets; no paid service, storage product, or subscription change. Public smoke evidence below. |

**Tooling gate:** Exact dependency versions are intentionally unresolved in this document, not implied to have been verified. M1.2 must resolve them before scaffolding; do not invent versions or inherit upstream versions without checking compatibility.

**Exit:** A reproducible shell runs locally and on Workers Free, with CI and documented configuration. A missing deployment account/credential leaves deployment explicitly pending, while local work can proceed.

## 4. M2 — Morning weather

1. **M2.1 — Data adapter:** Define a normalized weather model with timestamped hourly data, location, timezone, units, and fetch time. Fetch only required Open-Meteo fields; validate responses. Use deterministic fixtures for development and tests.
2. **M2.2 — Icons and descriptions:** Implement exhaustive WMO-to-condition mapping, explicit day/night Meteocons identifiers, French labels, and an unknown fallback. Verify names against the installed collection and keep UnoCSS references literal/extractable.
3. **M2.3 — UI:** Build clock/date, current and feels-like temperatures, high/low, rain information, and an hourly chart. Start with lightweight SVG, distinct temperature/precipitation encodings, an accessible text equivalent, and a current-time marker. Obtain the approved mockups mentioned in the specification before claiming visual conformity; they are not present in this repository.
4. **M2.4 — Summary and recovery:** Generate deterministic summaries with thresholds documented in code/tests. Refresh around every 30 minutes, avoid duplicate timers, cache the last valid response, show its age when stale, and retry with bounded backoff.
5. **M2.5 — Provider compliance:** Verify current usage terms, show required attribution, and document the request budget. Add a proxy only if measured usage or another provider requires one.

**Exit:** Unit coverage proves every required WMO code resolves to an installed icon; browser checks cover day/night, offline/stale, malformed data, and initial failure. The French 1280 × 800 view is readable and does not scroll. Provider failures leave clock/navigation working.

## 5. M3 — Protected photos

### M3.0: Security and storage decision gate

Complete this before publishing any private photo route:

- Evaluate Cloudflare Access for two independent admins, including current free terms, identity verification at the Worker, session expiry, and route coverage. Record the selected mechanism in an auth ADR; do not rely on a hidden admin page or an unverified header.
- Define admin/display authorization, cookie or token transport, origin/CSRF protections for mutations, and revocation behavior. Anonymous requests must fail closed. Keep incomplete routes disabled on public deployments.
- Prototype protected image delivery in Firefox and Safari. Prefer a scoped Secure/HttpOnly cookie if it works across the kiosk lifecycle; evaluate authenticated fetch/blob URLs with bounded memory as the fallback. Never put reusable credentials in image URLs.
- Validate KV binary/metadata layout, pagination, free quotas, and eventual-consistency behavior. Use deterministic IDs derived from the source SHA-256 for retry identity; hashes are deduplication inputs, not proof of trust.

### Implementation tasks

| Task | Work                                                                                                                                                                                                                      | Acceptance evidence                                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3.1 | Build validated metadata contracts and KV adapter: separate binary records and listable metadata, stable IDs, cursor pagination, and consistent errors.                                                                   | Catalog does not read all binaries; partial writes/deletes and delayed visibility have documented recovery behavior.                                |
| M3.2 | Add protected catalog/image/upload/delete endpoints with size limits, ID/hash format checks, image header/dimension validation within Worker limits, trusted identity attribution, and authorization-aware cache headers. | Anonymous reads and non-admin mutations fail; malformed/oversized input is rejected; private responses never enter shared caches.                   |
| M3.3 | Build sequential browser processing: original-byte SHA-256, orientation-aware decode, normalized 64-bit dHash, no-upscale resize to ~1600px, WebP ~0.82, metadata stripping, and per-file feedback.                       | Representative iPhone/browser images render correctly; actual output MIME is checked; unsupported formats/encoders produce actionable errors.       |
| M3.4 | Add exact duplicate lookup and human review of perceptual matches, configurable thresholds, and safe retry UI.                                                                                                            | Repeated uploads target the same identity; similar photos are not discarded automatically; concurrency limitations remain explicit.                 |
| M3.5 | Add responsive admin catalog, thumbnails, confirmed deletion, and storage reporting.                                                                                                                                      | Both admins can manage photos; quota errors preserve existing content; usage is labeled approximate if based on eventually consistent metadata.     |
| M3.6 | Add shuffle slideshow, ~20-second interval, contain/cover, bounded preloading, empty state, periodic catalog refresh, and failure recovery.                                                                               | No immediate repeats when multiple photos exist; new uploads appear; transient errors retain the current image; decoded image memory stays bounded. |

**Quota design gate:** Before calling storage usage authoritative, decide how concurrent writes and deletions affect accounting. Prefer conservative warnings and quota failure handling over a falsely exact counter. Estimate reads/list/writes for the actual polling cadence and photo collection; avoid hot shared counters and repeated full-catalog scans. Any new coordination service needs an ADR and free-cost validation.

**Exit:** Run the specification's M3 upload/privacy/retry checks using synthetic photos first. Basic authentication is complete here; M4 extends provisioning and operations rather than postponing protection.

## 6. M4 — Security and administration

- **M4.1:** Complete independent access and session recovery for both administrators, including expired sessions during uploads.
- **M4.2:** Implement protected display provisioning, a high-entropy read-only credential, rotation, revocation, and restart persistence. Define credential storage and the maximum revocation delay explicitly; KV eventual consistency cannot provide an unqualified immediate-revocation guarantee.
- **M4.3:** Enforce privately configured verified home IPv4/IPv6 restrictions for the display role alongside credential checks. Test off-network rejection, address changes, and admin recovery without giving the frame admin access.
- **M4.4:** Add validated persisted configuration and separate display-safe and admin responses. Settings include timezone, location, schedule, override duration, slideshow interval, and fit preference. Reject invalid/overlapping schedules and define defaults for missing settings.
- **M4.5:** Document identity recovery, reprovisioning, credential rotation, changing the home IP, and configuration/optimized-photo export. Ensure logout/revocation clears or bounds any local private-photo cache according to the selected offline policy.

**Exit:** Test the admin/display/anonymous authorization matrix across all routes, CSRF/origin handling, secret exclusion, expired credentials, off-network access, and revoked credentials after the documented propagation window. Verify image authentication survives browser restarts; hardware confirmation remains M6.

## 7. M5 — Scheduling and offline display

1. Implement a pure mode resolver using the configured IANA timezone and local wall-clock schedule. Define half-open intervals, overnight ranges, DST gaps/repeated hours, and invalid-config fallback. Use injected time in tests.
2. Add per-display manual overrides and inactivity expiry, hidden touch navigation, Morning/Photos/Home/Night views, and visible recovery controls that do not expose admin tools. Keep Home a placeholder initially.
3. Recompute scheduled mode on startup, resume, configuration refresh, and time changes. Avoid duplicate timers/listeners across mode transitions.
4. Implement bounded offline photo caching only after deciding what can remain readable on a compromised/revoked offline frame. Start with in-memory/current-image continuity; persist private images only under an explicit retention and clearing policy. Service worker support is optional and hardware-dependent.
5. Add dimmed Night rendering; record hardware brightness/screen-off as a separate M6 capability rather than assuming CSS controls the backlight.

**Exit:** Tests cover every schedule boundary, DST transitions, overnight intervals, manual override expiry, resume, invalid configuration, and routine outages. Browser flows cover touch, reduced motion, all four modes, mobile admin, and no kiosk scrolling.

## 8. M6 — Dragon Touch Classic 10

Read current upstream hardware guidance before this phase. Identify the real model, board, firmware, Android build, RAM, browser/WebView, and recovery options without modifying the device. Keep private identifiers, dumps, keys, and diagnostics out of Git; publish only sanitized observations, clearly separated from assumptions, in `docs/devices/dragon-touch-classic-10.md`.

- Verify browser installation/support, HTTPS, WebP/SVG, timezone behavior, touch, authenticated images, and available memory. The provisional Firefox/GeckoView baseline must be tested rather than assumed.
- Prefer a working browser kiosk. Evaluate Wes's existing wrapper only if needed and compatible; adopting it requires a recorded decision because native app development is outside the initial product scope.
- Before any firmware/system modification, establish a verified backup and recovery route and obtain authorization for the specific change. Match device identities exactly; do not apply Modern10 Charm or BIUFRAME scripts by brand similarity.
- Verify physical access back to Settings and a recovery route before disabling vendor navigation or replacing launch behavior.
- Test cold boot, kiosk launch/manual fallback, Wi-Fi loss/recovery, sleep/resume, credential persistence, and a proposed minimum 48-hour run. Record crashes, memory growth, image failures, and recovery behavior.

**Exit:** Actual-device evidence supports the M6 criteria. If unsupported, document the blocker and retain the working web application; do not claim desktop emulation establishes frame compatibility.

## 9. M7 — Optional integrations

Start only after the core display is usable. Create a small separate proposal for each addition, with a threat model, authentication transport, outage behavior, compatibility checks, current terms, and €0-cost evidence.

- iOS Shortcut: scoped revocable upload token or authenticated handoff; reuse validation/optimization requirements without assuming browser cookies are available.
- Hue and other LAN devices: prove a secure connectivity path before adding controls; a hosted Worker cannot directly reach a private LAN bridge.
- Calendar, alerts, or additional widgets: preserve the primary display's hierarchy and minimize private data held on the frame.

## 10. Verification and completion records

CI should run type/lint checks, focused Vitest suites, browser flows, and the production build. Use deterministic fixtures and a local KV environment for normal tests; do not make CI depend on live weather, household photos, or a physical frame. Exercise real deployment and hardware separately with sanitized evidence.

For each milestone record: completed task IDs, checks run and results, screenshots when layout changes, upstream revision/paths consulted, ADRs, deployment state, and remaining limitations. Do not mark a milestone complete until its specification acceptance criteria and the plan's gates pass.

### Decisions to resolve at their gates

| Decision                                                      | Due          | Required outcome                                                                    |
| ------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| Upstream revision, reuse scope, and licensing                 | M1.1         | Source review and attribution record.                                               |
| Exact dependencies and Astro/Worker wiring                    | M1.2–M1.4    | Pinned compatible versions and verified local build/API.                            |
| Approved visual assets/mockups                                | M2.3         | Available reference and asset rights, or an explicitly recorded provisional design. |
| Admin authentication and image credential transport           | M3.0         | Working protected-route prototype and auth ADR.                                     |
| KV schema, accounting, and partial-operation recovery         | M3.0–M3.5    | Measured operation budget and documented consistency limits.                        |
| Credential revocation bounds and private offline cache policy | M4–M5        | Explicit propagation/retention guarantees and tests.                                |
| Classic 10 compatibility, kiosk, brightness, startup          | Discovery/M6 | Observations on the actual unit and a recovery path.                                |

**Next implementation slice:** M3 protected photos, starting with the M3.0 authentication/storage gate. This document authorizes no hardware changes or paid infrastructure.

## M1 implementation record — 16 October 2026

**Status: M1 complete. Local checks and public Workers Free deployment passed; hosted GitHub Actions checks passed after repository publication (see follow-up below).**

| Task | Evidence / status                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1.1 | Complete: [ADR 0001](decisions/0001-upstream-foundation.md), upstream `e97c50ba459c49ea8237259f69b95cd28054b628`, relevant source/build/style/deployment review. No upstream license file found; no upstream source/assets copied. Asset notices ship under `public/licenses/`.                                                                                              |
| M1.2 | Pinned Node 24.16.0, pnpm 10.23.0, exact direct dependencies and `pnpm-lock.yaml`; peer/engine evidence and owner's tool preferences recorded in ADR. Fresh frozen install and full `pnpm verify` passed; evidence below.                                                                                                                                                    |
| M1.3 | French fixture shell at `/`, local clock using Europe/Paris, four manual navigation modes, responsive `/admin/photos` placeholder. UnoCSS Wind4/reset/utilities, minimal global accessibility CSS, locally bundled Manrope/Meteocons and original SVG scenery. No live weather, private photos, persisted settings, scheduling, or device claims.                            |
| M1.4 | Worker `/api/health` plus static assets tested through local Wrangler. GET/HEAD health, 405 mutations, all other API paths 404/no-store and never fall through to assets (including document navigation). No KV or secret binding needed in M1. Production dry-run passes: ASSETS plus public DEPLOYMENT_STAGE only; Worker 1.40 KiB, gzip 0.70 KiB.                         |
| M1.5 | `.github/workflows/ci.yml` runs frozen install, checks, XO/Prettier/Astro lint, unit tests, build, and browser flows. Manual main-only deployment re-runs checks; protected environment and least-privilege secrets documented in [operations](operations.md). The repository was subsequently published and hosted checks passed; see CI/CD follow-up below.                |
| M1.6 | Complete: Workers plans dashboard visibly confirmed Free / $0 / Current plan on 16 October 2026, with 100,000 requests/day and 10 ms CPU. OAuth subscription read returned 403, so billing was verified in the authenticated dashboard instead. Deployed only Worker + Static Assets; no paid service, storage product, or subscription change. Public smoke evidence below. |

Initial verification: Astro/TypeScript clean (14 files); XO clean; 9 Vitest tests; 16 Playwright checks across Chromium, desktop Firefox, WebKit and iPhone 13 emulation. Browser tests cover manual modes, French clock, no 1280×800 scrolling, mobile/admin overflow, bundled icon rendering, no external requests, API failures, keyboard/reduced motion. Visual QA caught and corrected missing display text color and hidden rain paths after freezing animated icons. Final clean verification and screenshots are recorded below.

Asset processing: the installed Meteocons collection has no `*-static` variants. Actual `partly-cloudy-day-fill` and `rain-fill` names are used literally. The build strips embedded SVG animations and reveals rain paths that were initially transparent. Complete WMO mapping remains M2.

Dependency audit: `pnpm audit --prod` reports no known vulnerabilities. Full audit reports one high advisory in `braces` 3.0.3 (no patched release available) and one low advisory in `katex` 0.16.47, both confined to XO's development dependency tree (`pnpm why` verified). Do not apply a forced XO downgrade or incompatible transitive KaTeX upgrade. Lint only trusted repository content; reassess when upstream packages publish compatible fixes. Neither dependency is shipped to the browser/Worker.

Final local acceptance: a fresh directory under `/tmp` completed `pnpm install --frozen-lockfile` and the complete `pnpm verify` pipeline: strict Astro/TypeScript checks, XO with built-in Prettier/Astro support, 9 unit tests, production build, and all 16 browser checks passed. These browser checks use current desktop engines and iPhone emulation, not the physical Android frame. [1280×800 screenshot](evidence/m1/dashboard-1280x800.png) and [mobile admin screenshot](evidence/m1/admin-mobile.png) were inspected after the visual corrections. No private data is present. The production Worker packaging dry-run also passed.

### Public deployment acceptance

On 16 October 2026, after the owner authenticated Wrangler, the matching account’s Workers plans UI showed **Free**, **$0**, and disabled **Current plan**, alongside a separate Paid upgrade option. No upgrade or billing action was taken. The account settings API reported standard usage; that alone was not treated as proof of plan. No account identifiers or credentials are recorded here.

`CLOUDFLARE_FREE_PLAN_CONFIRMED=true pnpm run deploy` ran the full verification pipeline successfully before deployment. Worker `dayframe-fixture-production`, version `ac9e9c06-4f2f-457b-962e-10a73c024727`, deployed to [the public fixture preview](https://dayframe-fixture-production.cody-zuschlag.workers.dev). The only bindings are ASSETS and the non-sensitive production stage. Bundle 1.40 KiB (gzip 0.70 KiB), startup 1 ms; no KV/R2/D1/Images/paid Workers provisioning.

The public HTTPS smoke check verifies that the home HTML exactly matches the checked local production build, admin shell responds 200, production health responds correctly, health mutation returns 405, photo/config/unknown APIs return JSON 404/no-store, and missing static pages return 404. Hosted CI subsequently passed on the first GitHub push; see CI/CD follow-up below. Hardware and live weather/photo functionality remain outside M1.

### GitHub CI/CD follow-up — 16 October 2026

Created public [codyzu/dayframe](https://github.com/codyzu/dayframe), connected origin and pushed M1 commit `8fcb6bf25f12b0c36fefd8f77f705c2b8c466853`. The push-triggered [Checks run](https://github.com/codyzu/dayframe/actions/runs/38875194304) passed on an Ubuntu GitHub-hosted runner: frozen pnpm install, types, XO/Prettier, 9 unit tests, build, 16 Chromium/Firefox/WebKit/mobile browser checks. Local `pnpm smoke:production` also passed.

Manual **Deploy to Cloudflare** workflow is ready: main branch only, production environment, Free-plan assertion, credential-free verification, credentials scoped to Wrangler upload step, and production HTTPS smoke checks. No automatic deployment on push. Jobs have 20-minute timeouts; check runs cancel superseded runs and deployments are serialized.

The owner approved and completed the production access setup: main-only production environment, codyzu review with self-review allowed, verified Free-plan flag, and token/account ID stored only as GitHub production environment secrets. The dedicated account-owned token has Individual Workers Editor permission for dayframe-fixture-production only, with 90-day expiry displayed as 15 January 2027. The token value was transferred directly from the Cloudflare one-time dialog to the GitHub secret without appearing in chat, source, or logs. No personal Wrangler OAuth credential was copied into CI. The token dialog was closed and temporary credential variables were cleared.

The first manual GitHub deployment [run](https://github.com/codyzu/dayframe/actions/runs/38876764782) paused for production review as expected, then passed all checks and uploaded version `39a9a9dc-a8ca-480a-8678-401951cbdc6e` using the scoped token. Its immediate smoke check saw the previous HTML during Cloudflare propagation and failed; a later HTTPS request confirmed the uploaded CSS fingerprint. The smoke script now retries failed checks up to 12 times with five-second waits, retaining the exact HTML comparison via SHA-256 and all API assertions. A local simulated stale-first response check confirmed retry and eventual exact-build acceptance. The corrected [deployment run](https://github.com/codyzu/dayframe/actions/runs/38877356532) passed: full verification (9 unit tests and 16 browser checks), scoped-token upload (version `491beb73-2a8b-446a-a7f0-dd34be05a349`), and all eight public smoke checks. The corresponding automatic [push checks](https://github.com/codyzu/dayframe/actions/runs/38877349654) also passed. No token permissions were expanded and no paid service was enabled.

## M2 implementation record — 16 October 2026

**Status: M2 complete locally. Public deployment remains M1; no M2 deploy or hardware changes performed.**

| Task | Evidence / status                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M2.1 | Complete: `src/lib/weather/adapter.ts` normalizes public location/timezone/units, fetch time, current/hourly/daily data. Boundary validation rejects malformed fields, units, arrays, ranges, times and incomplete forecasts. Unix hourly times and provider-offset daily dates handle Paris DST. Deterministic synthetic fixtures are in `tests/fixtures/weather.ts`. A live Annecy request passed the final adapter (48 hours, two dated daily ranges, metric units).        |
| M2.2 | Complete: `conditions.ts` maps all 29 specification WMO codes to semantic conditions, French descriptions and literal day/night Meteocons classes, with unknown fallback. Tests resolve every variant against installed `@iconify-json/meteocons` 1.2.4. UnoCSS explicitly scans browser weather TS; production browser tests verify actual current/hourly icon backgrounds and day/night switching.                                                                           |
| M2.3 | Complete with explicitly provisional design: current/feels-like/high/low, current rain, upcoming precipitation advice, existing French clock/date and original Annecy scene. SVG has separate °C/% axes, yellow line/blue bars, current-time marker, legend and accessible hourly table. No 1280×800 scrolling in tested desktop engines; mobile adapts. Approved mockups remain absent, so conformity to them is not claimed. No new external assets copied.                  |
| M2.4 | Complete: deterministic 50% / 0.1 mm thresholds, bounded forecast language, 30-minute refresh, 12-second timeout, 1/5/15/30-minute backoff, one in-flight request and scheduler, validated single-entry cache, blocked/quota storage fallback, stale age and last-reading date/time, exit/resume cleanup. Browser flows cover offline reload with retained weather, stale status, recovery, malformed initial data, missing cache, unknown codes, and independent clock/modes. |
| M2.5 | Complete: current official Open-Meteo docs/terms/licence/pricing reviewed; attribution/licence and adaptation label displayed beside data. [Weather operations](weather.md) records a conservative household request budget, public coordinate disclosure, cache/retry policy, limits and provider sources. No key, subscription, proxy, paid service or Cloudflare binding added.                                                                                             |

Final local acceptance: the complete `pnpm verify` pipeline passed. Strict Astro/TypeScript checks (23 files) and XO/Prettier passed; **32 Vitest tests** passed; production build passed; **32 Playwright checks** passed across Chromium, Firefox, WebKit and iPhone 13 emulation. Coverage includes WMO/icon lookup, validation, DST daily/hourly behavior, summary thresholds, cache age/invalidity, timeout/backoff, deduplication, suspend/resume and storage quota handling. Browser scenarios use deterministic data and never depend on live weather. A separate manual live-provider check validated the actual response. Private API fail-closed tests still pass. `git diff --check` is clean.

Visual evidence (synthetic weather): [1280×800 morning](evidence/m2/dashboard-1280x800.png), [night condition icon](evidence/m2/night-condition-1280x800.png), [stale/offline](evidence/m2/stale-1280x800.png), [mobile morning](evidence/m2/morning-mobile.png). Visual QA corrected production icon extraction and the hidden table's overflow. Desktop Firefox and iPhone emulation do not establish Classic 10 compatibility. The night icon screenshot tests weather day/night mapping, not scheduled night mode.

Upstream review refreshed at current HEAD `e97c50ba459c49ea8237259f69b95cd28054b628`; reviewed README, `dashboard/js/data.js`, weather helpers in `dashboard/js/app.js`, weather layout in `dashboard/js/views/home.js`, and `dashboard/css/views/home.css`. Retained glanceable hierarchy and short rain advice as ideas; independently implemented live timestamped weather/chart/cache instead of upstream's hour-indexed mock data. No license file found and no upstream source/assets copied. [Weather provenance](weather.md#upstream-and-visual-provenance) records the details; ADR 0001 still governs the foundation.

Remaining limits: provisional visuals until mockups are supplied; actual Android/frame testing remains M6; offline weather persistence requires the app shell itself to load; M2 is not yet published to Workers. M3 must start with its authentication/storage gate before any private photo route becomes public.

### M2 icon motion follow-up — 16 October 2026

Owner requested animated Fill icons by default, with static images for reduced motion. This supersedes M1's unconditional SVG animation removal. UnoCSS keeps the original animated SVG and generates a still-image CSS property for each used Meteocons icon. A scoped weather-component media query selects the still image for current and hourly icons, responding to live preference changes without JavaScript. Static rain paths remain visible. Existing Meteocons MIT notices continue to apply; no dependency or service added.

Re-inspected upstream checkout `e97c50ba459c49ea8237259f69b95cd28054b628`: `dashboard/js/app.js` (`App.icon`), `dashboard/js/views/home.js` (current/hourly icons), and `dashboard/css/views/home.css` (weather sizing). Upstream uses inline stroked SVGs; Dayframe deliberately retains its locally bundled Meteocons Fill icons and independent reduced-motion implementation. The revision has no license file; no upstream code or assets copied.

Validation: Astro/TypeScript checks, XO/Prettier lint, all 32 unit tests, production build, and all 36 Playwright checks passed across Chromium, Firefox, WebKit, and iPhone emulation. The new browser case checks animated current/hourly SVGs, animation-free still images with visible rain paths under reduced motion, and switching back without reloading. Physical Classic 10 animation performance remains an M6 check; this change is local and not deployed.

## M1.5 automatic deployment follow-up — 16 October 2026

At the owner's request, `Deploy to Cloudflare` now triggers on pushes to main, retaining manual dispatch for retries. Each deployment independently runs the Free-plan assertion and full `pnpm verify` before Wrangler upload, then public smoke checks. Production deployments remain serialized; credentials remain scoped to the upload step.

Removed the GitHub production environment's required reviewer and wait timer through the repository API. Read-back confirmed only the branch policy remains, restricted to the `main` branch; `CLOUDFLARE_FREE_PLAN_CONFIRMED=true` and both deployment secret names remain configured. The assertion is a standing human confirmation, not a live billing lookup. No Cloudflare billing, services, token scope, dashboard code, or hardware changed. This supersedes the manual-deployment instructions in the historical M1 record above.

Local validation passed: Astro/TypeScript, XO/Prettier, 32 unit tests, production build, and 36 browser tests. The browser test server required loopback access outside the filesystem sandbox; rerunning that stage with the required access passed. Workflow/docs formatting and `git diff --check` passed. Pushed implementation commit `79f438297c8a897ea818a1555e4aed96f4f01f11` to main. The push-triggered [automatic deployment](https://github.com/codyzu/dayframe/actions/runs/38894994357) passed without production review: Free-plan assertion, full verification, Wrangler upload, and live smoke checks. M2 weather and animated icons are now publicly deployed; this supersedes the earlier local-only deployment status. The separate push Checks workflow also passed.

### M2 accessibility follow-up — display density

Implemented an explicit frame profile and persisted Standard/Large choices, shared rem tokens, larger secondary weather text, aligned chart icons/labels, stronger panel contrast and accessible navigation targets. This is a reviewable M2 UI refinement; M3 onward remain pending. Upstream review at `e97c50ba459c49ea8237259f69b95cd28054b628` covered `dashboard/css/tokens.css` and `dashboard/css/views/home.css`; token/hierarchy ideas retained, responsive implementation independently authored, no copied code/assets under the unresolved upstream license.

See [display-density.md](display-density.md) for provisioning and architectural details. Before/after evidence is under `docs/evidence/readability/`. Physical Classic 10 readability/browser/animation acceptance remains pending M6. No hardware writes, deployments, provider changes or new dependencies.

Validation: `pnpm check`, `pnpm lint`, `pnpm test` (35 passed), `pnpm build`, and `pnpm exec playwright test` (57 passed; 3 intentionally skipped duplicate viewport sweeps outside Chromium). Visually inspected both 1280 × 800 presets, 1440 × 900 Standard, iPhone Standard, and the freezing/full-rain Large scenario. Automated checks confirm no target-viewport scroll, no horizontal phone overflow, separated curve labels, 44px minimum navigation targets, animation/reduced-motion behavior and preference precedence/persistence. Contrast calculations use the conservative white-under-panel composite: secondary text approximately 10:1 and chart blue over 9.4:1.

### M2 icon clipping fix

The overcast icon's animated foreground cloud crosses its nested SVG symbol view box at the leftmost translation. UnoCSS now receives a copied Meteocons collection with `overflow="visible"` on nested symbols; the outer canvas, icon dimensions, mappings, animation and reduced-motion processing are unchanged. This also protects hourly icons and other cloud variants. The original cached module is not mutated. Upstream remains the reviewed `e97c50ba459c49ea8237259f69b95cd28054b628` (`dashboard/css/views/home.css`); its inline stroked icons are intentionally not adopted. No upstream code/assets copied.

Validation: type checks, lint, 35 unit tests and build passed. All 24 foundation browser checks passed across Chromium, Firefox, WebKit and iPhone emulation, including deterministic SVG snapshots at 0s/3s and animated/reduced-motion switching. Leftmost cloud snapshot: `docs/evidence/readability/overcast-leftmost.png`.
