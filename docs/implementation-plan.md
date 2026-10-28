# Dayframe: Implementation Plan

**27 October 2026 audit:** [Feature coverage and separate-chat implementation plans](backlog/README.md)
provide the current backlog entry point. The audit distinguishes missing behavior,
implemented features awaiting acceptance, and optional enhancements. F01 freshness and F02 future forecast browsing are deployed as of 28 October;
see the delivery record at the end. F03 quiet display is deployed as of 28 October; its release record is at the end.
The audit itself changed no product behavior or deployment; existing hardware/security
deferrals remain in force.
Historical milestone headers and execution records below retain their dated scope.

**Status:** M1–M2 delivered; M3/M4 production active with deferred live acceptance; M5 and icon timing repair deployed at `ca922ad`; short Classic 10 checks passed; H5 manifest deployed at `3763694`, Rootless trial and standalone layout measured; physical fullscreen return passed; normal-reboot cookie failure recovered with the existing key and Firefox restart persistence passed; cold power reproduced cookie expiry with Firefox-before-clock-correction logs; physical post-cold fullscreen passed but photos needed access; the approved browser preference trial retained the future cookie expiry through another cold cycle; physical fullscreen/private Photos passed without key entry; H5 manual-fullscreen acceptance is complete, with prior skips deferred; full H4/M4/M5/M6 acceptance remains open
**Date:** 16 October 2026  
**Requirements:** [Family Dashboard: Technical Specification](technical-specification.md)  
**Primary upstream:** [Wes Bos — photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)

> **Start here, including implementation agents:** Dayframe is based on Wes Bos's dashboard and photo-frame work. Inspect the relevant upstream implementation and research before starting a related task. Preserve attribution, record reuse and deliberate differences, and verify hardware assumptions on our actual device. The local specification remains the authority for Dayframe's requirements.

**Current handoff (reviewed 18 October 2026):** [Project status, skipped validation and next step](status.md). This dated summary supersedes historical “local only / not pushed” statements below; execution records retain their original context.

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

**F10 selected, 28 October 2026:** [Touch navigation, photo history and screen
continuity](backlog/F10-touch-navigation.md) now has a web implementation: horizontal
screen swipes, photo tap history/restoration and bounded live transitions. It uses
the recommended non-wrapping Morning ↔ Photos ↔ Night order. The delivery record
at the end tracks verification and rollout; actual-frame touch/performance
acceptance remains separate.

Deliver one demonstrable slice at a time. Keep task IDs in commits/PRs and update this document with validation evidence. M1 is delivered with local and Workers Free acceptance evidence below. M2 is publicly deployed (see its deployment follow-up below). M3 has local acceptance evidence and production authentication/KV activation below; household upload/delete testing and second-admin setup remain pending. M4 is deployed with the explicit live acceptance gaps recorded below. M5 has local synthetic acceptance evidence below and is committed/pushed; the latest deployment state is recorded in the [current handoff](status.md). M6 physical acceptance remains pending. A task is done only when its acceptance evidence exists; a mock or desktop-only test must be labeled as such.

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

**Follow-up proposed 22 October, implemented locally 27 October 2026:** [weather freshness and recovery](weather-freshness.md)
as one M2/M5 slice: timestamp-based retry deadlines, bounded recovery for stale
HTTP 200 responses, and dated stale-weather copy in Photos and Conseil du jour.
Implementation, request-budget update and local acceptance evidence are recorded
in the F01/F02 delivery entry below. Production rollout remains separate.

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

**Privacy boundary clarified, 17 October 2026:** Keep the dashboard shell public. Protect every private resource at the Worker, including photos, thumbnails/catalog metadata, household configuration and future calendar entries. Verify an authenticated admin can view private content on the ordinary dashboard off-network; a display needs both its credential and the approved home network; anonymous visitors receive only public defaults/placeholders even at home. Public HTML/assets must contain no private data. Dashboard-page gating and widening the `/api` display cookie are not required. See the specification's dashboard access matrix. Calendar implementation remains future work.

**Activation scope clarified, 17 October 2026:** The owner deferred adding the second administrator. Proceed with production activation and live checks using the existing approved administrator; the second identity's independent production acceptance remains pending and must not block that activation slice. Verified home-network configuration, Free-plan validation and live authorization/provisioning checks remain required.

## 7. M5 — Scheduling and offline display

1. Implement a pure mode resolver using the configured IANA timezone and local wall-clock schedule. Define half-open intervals, overnight ranges, DST gaps/repeated hours, and invalid-config fallback. Use injected time in tests.
2. Add per-display manual overrides and inactivity expiry, hidden touch navigation, Morning/Photos/Home/Night views, and visible recovery controls that do not expose admin tools. Keep Home a placeholder initially.
3. Recompute scheduled mode on startup, resume, configuration refresh, and time changes. Avoid duplicate timers/listeners across mode transitions.
4. Implement bounded offline photo caching only after deciding what can remain readable on a compromised/revoked offline frame. The current in-memory/current-image continuity remains the baseline. The owner selected a navigation-only service worker and standalone offline slideshow on 22 October 2026; persistent photos follow the accepted retention and clearing policy in [ADR 0009](decisions/0009-offline-photo-fallback.md). Follow the phased extension below; actual GeckoView support remains a device gate.
5. Add dimmed Night rendering; record hardware brightness/screen-off as a separate M6 capability rather than assuming CSS controls the backlight.

**Exit:** Tests cover every schedule boundary, DST transitions, overnight intervals, manual override expiry, resume, invalid configuration, and routine outages. Browser flows cover touch, reduced motion, all four modes, mobile admin, and no kiosk scrolling.

### M5 offline extension — 22 October 2026

The owner selected a small web fallback rather than a cached full dashboard. Online
navigation loads the live application normally; offline startup serves a minimal
slideshow using automatically retained private photos from authorized reads. Weather, vigilance, appointments
and the full dashboard are not precached. [ADR 0009](decisions/0009-offline-photo-fallback.md)
controls the architecture, privacy boundaries, upstream provenance and accepted policies.
The owner accepted seven-day retention since the last authenticated photo/catalog
response, a 100-photo/100 MB limit (whichever comes first), and photos at all hours
while offline. No offline Night screen or saved Night schedule is needed.
Existing M5 behavior/acceptance remains historical evidence; these phases are additional
work, not retroactively completed by earlier offline tests.

| Phase                          | Reviewable slice                                                                                                                                                                                                                                                                                                                              | Acceptance gate / status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M5.O1 — Contract               | Write ADR 0009, record selected architecture, retention/clearing boundaries, failure states and this sequence.                                                                                                                                                                                                                                | **Complete, including owner policy acceptance on 22 October 2026.** No policy decisions remain before phase 2. Original five-minute baseline is now superseded for authorized Photos browsers; O3/O4 local evidence follows below and O5 remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| M5.O2 — Persistent photos      | Shared IndexedDB module; automatic authorized-browser persistence; bounded gradual downloads; live slideshow reads saved photos during outages and mode changes. Preserve two decoded images, catalog pagination, authorization denial and local invalidation.                                                                                | **Complete locally, 22 October 2026.** Shared store, automatic persistence in authorized browsers, incremental bounded persistence and live outage/mode-return playback. Browser acceptance and limits are recorded in the O2 execution record below. No service worker, cold-start, deployment or device claim.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| M5.O3 — Standalone fallback    | One self-contained offline HTML document using the same photo store, lease and playback preferences; empty/expired state, photos at all hours offline, manual/automatic reconnection. No external runtime assets or private data embedded in the public artifact.                                                                             | **Complete locally.** Standalone document, shared store/lease, all-hours playback and bounded recovery; 20 four-engine fixture checks and generated CSP inspection are recorded below. No device acceptance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| M5.O4 — Navigation fallback    | Stable small worker; allowlisted dashboard navigation only; bounded network-first attempt with saved fallback. All other requests retain ordinary handling. Cover partial dashboard startup failure without a new forbidden kiosk URL. Version only the public fallback, with compatible storage and explicit activation/retirement behavior. | **Complete locally, 22 October 2026.** Navigation-only worker, partial-startup guard, build detection and explicit lifecycle/retirement. Local/PR builds default disabled. Owner-authorized enabled production rollout passed online checks on 23 October after native 0.1.5 installation; full device outage/update/storage acceptance remains O5.                                                                                                                                                                                                                                                                                                                                                                                                   |
| M5.O5 — Classic 10 integration | Refresh upstream device research and actual device identity/browser; teach the kiosk heartbeat/recovery policy to distinguish healthy offline playback and empty/expired retry states from faults. Preserve address/TLS restrictions, clock gate and maintenance paths.                                                                       | **Installed/enabled deployed; online checks passed, 23 October 2026.** Actual Classic private Photos, online restart, worker registration/public fallback cache and initial storage passed. [Rollout and evidence](hardware/m5-offline.md). Owner desk checks subsequently passed physical maintenance, short Wi-Fi disconnect, offline app restart and immediate reconnection without key entry. Update recovery, destructive storage/expiry, measured sustained offline playback and overnight acceptance remain open. Subsequent offline cold-power observation was clock-gated; network-assisted recovery passed in about 45 seconds, with offline cold startup retained as a limitation. Storage is subject to eviction; prior deferrals remain. |

**O4 deployment update detection (implemented locally 22 October; production activation authorized 23 October 2026):**
Publish a small public `/version.json` with an opaque build ID, shipped with the
matching application assets; embed that same ID in the running app. Check every
30 minutes and when connectivity returns, using `cache: 'no-store'` and one
in-flight check. The navigation worker must leave this request to the network.
Failed, malformed or unchanged checks leave the current display running and retry
on the normal interval. A changed ID schedules one controlled dashboard reload:
at the next slide transition in Photos, or after the current render in other
display modes. Preserve display preferences and any unexpired manual mode override;
retain valid photo access and the bounded offline photo store. Admin/setup pages
must not auto-reload. Weather and settings keep their independent refresh cycles.

O4 acceptance must cover new-version detection, unchanged/failed checks, offline
playback during checks, reconnection, and coordinated application/fallback updates.
Confirm the loaded build ID after reload. Persist the attempted target ID before
reloading; if an older cached page returns, suppress further automatic reloads for
that target rather than looping. Interrupted updates must preserve a usable
fallback and compatible photo storage. This adds deployment metadata, not full
dashboard precaching, private data in public assets, or a new service/billing plan.
O5 must verify the update/reload path on the actual Classic 10 GeckoView profile,
including watchdog behavior, valid authorization, preferences, offline continuity
and recovery without repeated reloads, under its existing hardware authorization
and readiness gates.

Each phase is one reviewable slice. O2 can deliver disconnect resilience before O3/O4
add offline navigation. O4 may be prepared and browser-tested before native integration,
but exposing it to the active frame requires O5 readiness so a valid fallback does not
trigger the existing dashboard-only watchdog. Hardware tests/changes need their own
specific authorization. No new billing, native photo bridge, deployment or device
change is included in O1.

**O1 evidence:** reviewed current photo/privacy implementation, Worker health routing,
native address policy and heartbeat, earlier ADRs and the specification. Re-inspected
upstream slideshow/Photos/kiosk docs and MIT license in the saved checkout at
`f1e0820918c926396e0ccafb4839568825f63edc`; ADR 0009 records adopted ideas and
deliberate differences. Documentation only; implementation and physical acceptance
remain pending. Owner policy decisions were explicitly accepted on 22 October 2026
and are recorded in ADR 0009; O1 is complete. No phase 2 implementation is included.

## 8. M6 — Dragon Touch Classic 10

Read current upstream hardware guidance before this phase. Identify the real model, board, firmware, Android build, RAM, browser/WebView, and recovery options without modifying the device. Keep private identifiers, dumps, keys, and diagnostics out of Git; publish only sanitized observations, clearly separated from assumptions, in the [Classic 10 inventory](hardware/dragon-touch-classic10.md). The [hardware documentation](hardware/README.md) and [H1–H8 stage plan](hardware/implementation-plan.md) provide the detailed M6 breakdown, exact future discovery commands, backup/verification gates, Firefox trial, optional GeckoView shell and security plan.

- Verify browser installation/support, HTTPS, WebP/SVG, timezone behavior, touch, authenticated images, and available memory. The provisional Firefox/GeckoView baseline must be tested rather than assumed.
- Prefer a working browser kiosk. Evaluate Wes's existing wrapper only if needed and compatible; adopting it requires a recorded decision because native app development is outside the initial product scope.
- Before any firmware/system modification, establish a verified backup and recovery route and obtain authorization for the specific change. Match device identities exactly; do not apply Modern10 Charm or BIUFRAME scripts by brand similarity.
- Verify physical access back to Settings and a recovery route before disabling vendor navigation or replacing launch behavior.
- Test cold boot, kiosk launch/manual fallback, Wi-Fi loss/recovery, sleep/resume, credential persistence, and a proposed minimum 48-hour run. Record crashes, memory growth, image failures, and recovery behavior.

**Planning evidence (16 October 2026):** Owner-supplied Classic 10 diagnostics recorded; upstream reviewed at `e97c50ba459c49ea8237259f69b95cd28054b628`, including Modern10 follow-up and relevant open discussions. Official Firefox APK hash/manifest/ABI verified on the Mac; signature check remains a pre-installation gate. [Research provenance](hardware/sources.md) records adopted ideas, intentional differences, licensing and missing GeckoView source. At initial planning H1 was partial and no device contact occurred. H1 has since completed; see the execution record below. H2 has since been accepted with documented owner exceptions; H3–H8 and M6 acceptance remain pending. The initial H2 planning prerequisites and subsequent results are recorded in the execution records below.

**Exit:** Actual-device evidence supports the M6 criteria. If unsupported, document the blocker and retain the working web application; do not claim desktop emulation establishes frame compatibility.

## 9. M7 — Optional integrations

Start only after the core display is usable. Create a small separate proposal for each addition, with a threat model, authentication transport, outage behavior, compatibility checks, current terms, and €0-cost evidence.

- iOS Shortcut: scoped revocable upload token or authenticated handoff; reuse validation/optimization requirements without assuming browser cookies are available.
  Start with the [iPhone Share Sheet feasibility plan](ios-share-sheet-feasibility.md)
  to prove on-device processing and photo handoff before adding authentication or endpoints.
  The local-only **Dayframe-Photo-Check** diagnostic and synthetic fixtures are
  prepared for the owner's iPhone 17 / iOS 27.0.1. The owner’s single-JPEG test
  passed input/report/upright preview on 24 October; reported size differs from
  source, with cause unestablished. A subsequent three-item report passed with
  full dimensions, including the large JPEG; the HEIC-source portrait reports
  PNG, so direct HEIC coverage is unproven. The owner confirmed browsing all three
  previews and saving fixtures through ChatGPT, a possible conversion step.
  Full sharing-route acceptance remains pending. No upload or
  production endpoint has been added.
  Owner selected testing the Paste compromise on 25 October and keeps helper apps
  as a last resort. The clipboard diagnostic page/Shortcut are prepared with
  temporary isolated HTTPS hosting; 16 simulated-clipboard browser checks passed.
  Actual iPhone manual paste passed for one and three synthetic photos, including
  local WebP conversion. The owner clarified the button opens the native Paste
  control; that path retrieved only B (1/3), while manual paste retrieved 3/3.
  Manual-paste feasibility is established for the tested inputs. Keep native
  paste as a fallback, with count/preview checks and existing admin auth/upload
  behavior. Temporary hosting was stopped after
  the initial test. On owner request, reopened the isolated test for a focused
  button investigation: visible item/type diagnostics and separately named mixed
  input versus per-image PNG Shortcuts. Native Mac editor confirms PNG/Repeat
  Results bindings. Actual iPhone mixed test returned 3 items but only the middle
  item exposed `image/png`; PNG normalization returned 3 `image/png` items and
  all 3 converted locally to WebP (owner screenshots 09:44/09:46). The button
  route is viable for this synthetic batch. Full preview acceptance, representative
  camera originals, intermediate size/memory, metadata and cross-route duplicate
  identity remain open before authenticated upload integration. No production
  upload changes, server-side conversion or helper installation is included.
- Hue and other LAN devices: prove a secure connectivity path before adding controls; a hosted Worker cannot directly reach a private LAN bridge.
- Calendar, alerts, or additional widgets: preserve the primary display's hierarchy and minimize private data held on the frame.

### Future weather browsing — recorded 24 October 2026

Owner requested the ability to see future weather beyond the current Morning
forecast. Add an on-demand way to view upcoming days, keeping the everyday display
uncluttered and providing a clear return to the current view. This expands the
specification's later short multi-day forecast idea.

Before implementation, decide the forecast horizon, daily versus hourly detail,
and how viewers open the forecast on the frame and other browsers. Reuse the
existing weather provider and cache where practical, preserve the €0 recurring-cost
requirement, and distinguish stale or unavailable forecasts. Implemented locally on 27 October as F02: a seven-day Morning dialog with daily
summaries and returned hourly coverage from the shared response. See the delivery
record below; production and physical acceptance remain separate.

### Deferred UI simplification — recorded 23 October 2026

Owner requested a future review to simplify the everyday display UI, including
photo synchronization/storage messaging. The persistent « Stockage soumis à
éviction · synchronisation progressive » notice exposes technical details without
helping the viewer decide what to do. Review other routine status text and controls
in the same pass, retaining the controls the household uses.

Proposed acceptance: normal photo playback stays visually quiet; detailed storage
persistence and synchronization diagnostics remain available in maintenance or
administration. Show concise French messages on the display when they explain an
actual interruption or a useful action, including offline playback, unavailable
photos and retry. Do not imply that storage is permanent or all photos are saved
unless verified. Review the resulting normal, offline, syncing and failure states
on the frame. Implemented as the F03 web slice on 28 October; see the delivery
record below. Physical-frame visual acceptance remains separate.

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

**Next implementation slice:** verify the already-triggered M5 deployment result, then review/deploy the local collection-wide SVG timing repair recorded below. The repair restores the animated current icon; hourly icons remain static. Follow with a short actual-frame M5 check on the exact deployed revision before fullscreen/startup work or a later 48-hour run. Keep skipped/deferred checks explicit in the [validation register](status.md#validation-register). The owner deferred the second administrator, standalone revocation and other live M4 gaps recorded below. This document authorizes no hardware changes or paid infrastructure.

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

## M3 implementation record — 16 October 2026

**Status: implemented with local synthetic acceptance. Production photo activation is pending; the checked-in production configuration keeps every photo/session API disabled. No private images, household identities, paid services, deployment, or hardware changes were introduced.**

| Task | Evidence / status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M3.0 | Selected Cloudflare Access Free for independent admin identities, with RS256 issuer/audience/expiry/age validation and a Worker email allowlist. Read-only display bearer exchange establishes a scoped Secure/HttpOnly cookie. Local HTTPS prototypes test real signatures, cookie image delivery and both synthetic admins in Chromium, Firefox, WebKit and iPhone emulation. Auth/storage decisions and current official sources are in [ADR 0002](decisions/0002-protected-photos.md); household Access setup and live verification remain activation work.                                        |
| M3.1 | `worker/photos.ts` defines the KV contract, metadata listing and cursor continuation, including empty intermediate pages. One binary value plus its associated listable key metadata eliminates cross-key partial writes/deletes. IDs derive from original-byte SHA-256; no transactional/concurrent uniqueness claim. Tests use Wrangler's real local KV; provenance/recovery details are in the ADR.                                                                                                                                                                                                 |
| M3.2 | Worker catalog/image/upload/delete routes authorize every request. Tests reject anonymous/forged/expired/wrong-issuer/wrong-audience/non-admin identities, display mutations, wrong origins, missing mutation headers, invalid fingerprints/MIME/dimensions and oversized bodies. Worker validates WebP chunk structure and dimensions without decoding, strips no data server-side, and rejects animation/metadata chunks. Private responses are no-store; corrupt records and storage failures fail closed. Trusted uploader attribution comes from verified identity.                               |
| M3.3 | Sequential browser processing computes source SHA-256, orientation-aware sRGB pixels, 64-bit dHash, no-upscale 1,600px resize and WebP quality 0.82. Native MIME checks revealed Safari's absent encoder; a locally bundled jSquash/libwebp worker supplies the fallback and terminates after each image/timeout. Removes EXIF/XMP/ICC, including Chromium's automatic colour profile. Browser tests verify synthetic orientation-6 JPEG pixel placement, portrait dimensions, no upscaling, output MIME/metadata and unsupported-format feedback. Physical iPhone/household examples remain untested. |
| M3.4 | Exact duplicates are skipped; server retries acknowledge the same ID without rewriting a visible record. Human keep/skip review uses configurable 0–16 Hamming distance, default 6. Browser checks verify explicit review, exact duplicates, retry identity and per-file failures. Concurrent writers remain last-write-wins and visibility is eventually consistent.                                                                                                                                                                                                                                  |
| M3.5 | Responsive admin catalog uses lazy authenticated thumbnails, dimensions/size/date, native delete confirmation and approximate storage accounting with a 700 Mo warning. Tests cover both synthetic admins, cancelled/confirmed delete, transient quota failure/retry, expired-access preview clearing and mobile overflow. Successful changes receive a session-local metadata overlay during KV propagation. No hot shared counter or automatic eviction.                                                                                                                                             |
| M3.6 | Fullscreen shuffled slideshow defaults to contain and ~20 seconds, supports cover/next, polls every five minutes, and holds at most current plus one upcoming decoded image. Keeps current pixels during ordinary failures, clears on observed authorization failure and releases object URLs on replacement/hide/mode exit. Browser checks verify additions appear after polling, fit modes, cookie reads, read-only mutations, failure continuity and bounded URLs. Persisted offline storage and scheduling remain M5.                                                                              |

Verification: `pnpm verify` runs strict Astro/TypeScript checks (42 files), XO/Prettier, **48 unit/integration tests**, production build and the complete browser matrix (**85 passed, 3 existing duplicate viewport sweeps skipped**). XO has no errors and two complexity warnings in the catalog/slideshow orchestration functions; binary format validation has an explained local complexity exception. Runtime `pnpm audit --prod` reports no known vulnerabilities. Browser tests run serialized because they share an isolated local KV namespace; existing weather, density and fail-closed routing checks remain covered. A production Worker packaging dry-run succeeds with only ASSETS and the public stage binding, approximately 50 KiB uncompressed / 14 KiB gzip; no photo-enabled deployment is claimed. `git diff --check` passes.

Visual QA: inspected the [mobile admin](evidence/m3/admin-mobile.png), [1280×800 slideshow](evidence/m3/slideshow-chromium.png) and desktop/mobile browser evidence under `docs/evidence/m3/`. Corrected an empty status pill and captured completed transitions. All displayed images are original synthetic canvas landscapes; no private family photos or credentials are in the screenshots.

Upstream review refreshed at `e97c50ba459c49ea8237259f69b95cd28054b628`: README, `dashboard/js/slideshow.js`, `dashboard/js/views/photos.js`, `dashboard/css/views/photos.css`, photo fixtures in `dashboard/js/data.js`, and image sourcing in `dashboard/js/app.js`. Adopted fullscreen/fit/shuffle concepts, independently authored all implementation, and deferred collage/favorites/captions. No upstream license file found; no upstream source/assets copied. New package license notices ship under `public/licenses/` and are identified in [third-party notices](../THIRD_PARTY_NOTICES.md).

Activation and remaining limits: [photo operations](photos.md) documents the dedicated KV binding, explicit Free-plan verification, private Access configuration and both household identities, production smoke changes, measured CPU acceptance, and optional display prototype. These are not provisioned by this local change. M4 supplies final provisioning/recovery/IP restrictions and M6 verifies Classic 10; desktop engines and iPhone emulation do not establish physical compatibility. HEIC depends on browser decoding and provides JPEG-export recovery; calibrate perceptual similarity against real household examples before relying on it. No automatic paid fallback exists.

### M3 production activation — 16 October 2026

Activated one owner-approved administrator on Workers Free plus Zero Trust Free. The owner completed the Free signup payment/terms step personally; no paid plan/add-on was selected. Provisioned a dedicated KV namespace and installed the Access issuer/audience, private admin allowlist and activation toggle as Worker secrets. Access protects `/admin/*` using an exact-email allow policy, one-hour sessions and HttpOnly hostname-scoped cookies. The display credential remains unprovisioned.

Confirmed anonymous catalog/image/session requests return 401, headerless upload returns 403, admin redirects to Access, and public dashboard/health still return 200. The actual approved Cloudflare identity signed in successfully: the Worker verified the token, enabled uploads, and read the empty production KV catalog. No private photo was uploaded or deleted during this activation; those manual product checks remain for the owner.

Automatic deployment now generates ignored production config from the pinned Wrangler parser and GitHub’s private namespace-ID secret, preserving `PHOTOS` on every upload without committing identifiers. Missing/invalid IDs stop deployment. Runtime identity settings remain Worker secrets, outside verification/build steps. Updated production smoke expectations and documented recovery in [photo operations](photos.md). Local `pnpm verify` passed: 50 unit/integration tests, 85 browser checks, 3 existing skips, types/lint/build (two existing complexity warnings). Production smoke passed all ten checks. No hardware changes; final display provisioning/IP restrictions and actual-device/CPU measurements remain M4/M6 work.

## M4 implementation record — 16 October 2026

**Status: implemented locally; production activation remains pending.** No deployment, production identity/network secret changes, private household photos, paid services or hardware changes were made for M4.

| Task | Implementation and acceptance evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M4.1 | Retained independently verified Cloudflare Access identities and one-hour JWT maximum age. Browser flows authenticate both synthetic admins, recover after expiry, preserve the failed and unattempted files in a selected batch, and retry with the same deterministic photo ID. Reconnect opens another tab so the source files remain in memory. Admin previews check sessions every 30 seconds. Production still has one activated identity; the second exact email is required for live acceptance.                                                                                                                                    |
| M4.2 | Protected admin key issuance/rotation/revocation at `/api/display`, public key-entry page `/setup`, 256-bit random credentials stored only as SHA-256 in a SQLite-backed `Administration` Durable Object. Scoped persistent HttpOnly/Secure/Strict cookies last at most one year. Real SQLite runtime-restart testing covers settings, credential persistence and durable revocation; browser context restoration covers authenticated image delivery without admin cookies. Future authorization checks reject old keys after acknowledged rotation/revocation, with no KV authorization cache; previously authorized requests can finish. |
| M4.3 | Every display read/exchange checks the privately configured `HOME_NETWORKS` secret against trusted `CF-Connecting-IP`. IPv4 must be exact; IPv6 supports exact addresses or /48–/128 prefixes. Missing/malformed configuration fails closed. Tests cover compressed/expanded/mapped IPv6, off-network rejection, changed-address rejection, and admin recovery off-network. Actual verified household addresses and live edge tests remain pending.                                                                                                                                                                                         |
| M4.4 | Admin settings form plus GET/PATCH `/api/config`; display-only GET `/api/config/display`. A shared whitelist validates timezone, place/coordinates, schedule, override duration, photo interval and fit. Unknown fields, invalid ranges, malformed/overlapping/zero-length schedules are rejected. Partial updates preserve existing values in a transaction; missing settings use public defaults. Authorized dashboard startup applies weather/clock location/timezone and slideshow interval/fit; schedule execution stays in M5. Both synthetic admins can save/read/export settings.                                                   |
| M4.5 | [Administration operations](administration.md) documents identity recovery, session expiry, reprovisioning, key replacement/revocation, changing home addresses, configuration export/restore and authenticated optimized-photo downloads. No persistent private-photo cache is introduced. Slideshow memory expires after five offline minutes; admin previews expire within five minutes plus their 30-second check interval. Denial and page/mode exit clear previews. Tests cover offline expiry, logout of revoked cookies, session recovery and exports.                                                                              |

The SQLite coordination service is justified and its Workers Free request/storage/failure budget is recorded in [ADR 0003](decisions/0003-administration.md). Photos stay in the existing KV namespace. Wrangler local/production bindings and the SQLite migration are preserved by the ignored production config generator. Miniflare is pinned to the same version already used by Wrangler, as a direct development dependency for genuine SQLite acceptance tests. No service subscription was changed.

Upstream review: checkout `e97c50ba459c49ea8237259f69b95cd28054b628`, README, `dashboard/js/data.js`, `dashboard/js/app.js` and `dashboard/js/slideshow.js`. Retained mode/timing ideas; independently authored private provisioning/settings/authentication. No applicable upstream private auth service or license file found; no upstream source/assets copied. Details in ADR 0003. Physical Classic 10 browser acceptance remains M6.

Production acceptance requires the second administrator's approved exact email, privately verified home IPv4/IPv6 configuration, Free-plan recheck, M4 deployment, live allowed/denied network checks and key/cookie restart/revocation checks. These are pending, not inferred from synthetic tests. No unqualified immediate KV revocation claim remains.

Local verification: `pnpm verify` passed strict Astro/TypeScript (55 files), XO/Prettier (no errors; the two existing photo orchestration complexity warnings), **59 unit/integration tests**, production build, and **101 browser checks** across Chromium, Firefox, WebKit and iPhone emulation, with three existing duplicate viewport sweeps skipped. A final saved-location greeting refinement then passed types/lint/build and all **eight focused administration browser checks**. Tests exercise actual workerd SQLite storage across runtime restarts, signed synthetic Access identities, persistent cookie image delivery in restored browser contexts, delayed-configuration navigation, upload-batch recovery and five-minute offline photo expiry. Desktop engines/emulation do not prove Classic 10 support.

Visual QA: inspected the [desktop settings](evidence/m4/settings-chromium.png), [mobile settings](evidence/m4/settings-mobile.png) and [mobile setup](evidence/m4/setup-mobile.png); only synthetic locations/identities/images are used and no key is visible. Historical M3 evidence was preserved. Worker production packaging dry-run passed at about 62 KiB uncompressed / 17.5 KiB gzip with the `ADMINISTRATION` binding; this is not a deployment. Browser assets contain no private deployment configuration names, and `git diff --check` passes. The private production configuration generator's tests confirm the object binding/migration and photo binding survive generation.

M4 completion audit follow-up: updated the production smoke contract from M3's `/api/config` 404 to M4's anonymous 401 and expanded it to 19 checks, including `/admin/settings` Access protection, public `/setup`, configuration/display reads, headerless mutations, and unknown API rejection. This prevents a valid M4 deployment from failing its old smoke expectations. Also strengthened the real SQLite restart check with concurrent independent partial settings updates; both persist alongside the credential and later revocation. Types, lint (same two existing warnings), all 59 unit/integration tests and `git diff --check` passed. Production smoke itself remains pending the M4 deployment and the requested private identity/network configuration.

## H1 execution record — 16 October 2026

Owner-authorized read-only Classic 10 inspection verified model/firmware, WebView 44.0.2403.119, vendor packages/permissions, root/SELinux state and internal MMC storage. Sysfs, blockdev and proc counts agree for the user area, both hardware boot areas and all 15 exposed partitions. Alias/mount resolution, parent bounds and non-overlap checks passed; exact ranges and raw diagnostics remain ignored and private. A generated binary stream passed; actual block-reader testing remains H2. See the [H1 findings and handoff](hardware/h1-discovery.md) for measured sizes, tools, limitations and upstream provenance.

**H1 complete; H2 accepted 17 October 2026:** software/storage checks and the owner’s visual physical inventory are recorded. [H2 capture](hardware/h2-backup.md) completed all required regions, persisted checksums/gzip readback, independent comparisons, offline structure/file-data review and final identity checks. A verified second physical copy was deleted at the owner’s request; the owner explicitly accepted keeping only the unencrypted external copy. Both retention and encryption exceptions are recorded privately and in the execution record. H3–H8 remain pending; M6 is not complete. No installation, settings change, reboot, deployment or billed service was performed. Recovery/USB/restore remain unverified; firmware/system changes remain blocked. Earlier documentation-only planning statements above describe that earlier session.

## H3 preflight — 17 October 2026

[H3 host/device preflight](hardware/h3-firefox.md) passed: official Mozilla APK and Android build-tools provenance, exact hash/ZIP/ARMv7/manifest checks, API 23 v1/v2 signature verification, actual Classic firmware/space and Firefox absence. The owner confirmed physical stock Home/Settings access. The standard install succeeded after a transfer timeout on its first five-minute attempt; no root-install fallback or private provisioning was used. Installed Firefox 143.0.4 renders the deployed public Dayframe frame profile; synthetic WebP/module/fetch/Intl/storage/CSS/SVG checks passed. Browser chrome leaves a 1280 × 744 viewport and clips the bottom controls. The temporary local test server was stopped. Final physical touch/exit/manual relaunch confirmation is pending; H3 remains incomplete. Upstream main remains `e97c50ba459c49ea8237259f69b95cd28054b628`; device notes and current issue/PR research refreshed, with no copied source/assets or launcher/system changes.

## M4 activation preflight — 17 October 2026

The owner authorized production preparation, push/deployment and live provisioning checks. Workers Free ($0, current plan) and Zero Trust Free ($0/month) were rechecked in the authenticated Cloudflare dashboard. The existing Access application covers `/admin/*`; the GitHub production Free-plan assertion remains enabled. No paid service or identity expansion was enabled.

The home Mac’s IPv4 egress independently matches the owner’s router screenshot. Installed the exact verified IPv4 as the private `HOME_NETWORKS` Worker secret; no address is recorded here. IPv6 connectivity exists on the Mac, but the frame’s IPv6 address/prefix remains unverified and no IPv6 entry was added. Such display requests fail closed. The frame responds at its owner-confirmed LAN address and its ADB TCP port is reachable, but the transport remains offline after the router restart, including after host-only reconnect/server restart. No frame settings or reboot were performed. Provisioning, actual-frame IPv6 and physical exit/relaunch acceptance remain pending.

Types/lint passed (the same two existing complexity warnings); 59 unit/integration tests and 101 browser checks passed with three existing skips. Integration/browser checks required host localhost permissions after the sandbox blocked listeners. Test-generated screenshots were restored to preserve historical evidence. Production packaging dry-run passed at 62.04 KiB / 17.47 KiB gzip, preserving `PHOTOS`, `ADMINISTRATION` and its SQLite migration. Deployment and live acceptance are not established by this preflight.

## M4 production activation follow-up — 17 October 2026

Pushed through `a98730a`; independent GitHub checks passed. The production workflow uploaded M4, including its SQLite administration migration, and the existing admin session successfully loaded settings and decoded a protected household photo in the ordinary dashboard. No photo upload/deletion, settings save, display-key issuance or frame provisioning was performed in this follow-up. These reads on the home Mac do not establish off-home admin acceptance.

The home LAN IPv6 /64 was subsequently verified independently: it is advertised by the router on the Mac’s default IPv6 interface, contains the router address supplied by the owner, and matches the Mac’s public IPv6 egress observed by Cloudflare. Added only that verified prefix alongside the exact IPv4 to the private `HOME_NETWORKS` secret. This supersedes the initial IPv4-only preflight; the frame’s own IPv6 path remains untested. All address/route evidence stays ignored and private. Anonymous photo/config reads were denied over both IPv4 and IPv6.

The first deployment workflow failed its post-upload smoke check because `/setup` returns Cloudflare Static Assets’ canonical 307 redirect to `/setup/`. Its exact homepage-build check passed after propagation, as did private API denial checks. Updated the smoke contract to verify the same-origin canonical redirect plus the public setup page (20 checks total), retaining exact build comparison and all authorization assertions. The corrected workflow result will be recorded separately. Full M4 acceptance still needs live settings mutation/recovery, real off-home admin access, allowed/denied display-key reads, browser restart/revocation and actual-frame provisioning; the second administrator remains deferred. H3 physical exit/relaunch remains pending.

### H3 physical navigation follow-up — 17 October 2026

Owner confirmed Dayframe touch controls work but cannot find Android Home/Back controls on the frame. H3 remains incomplete until physical exit and manual Firefox return are demonstrated. No ADB targets are currently connected; reconnecting to the previously verified address timed out, so no live activity/window evidence was obtained. Owner tried edge gestures; neither revealed Android controls and one triggered browser refresh. The prior frame address no longer responds to ping or TCP 5555. Requested the current router device/address status to distinguish lost Wi-Fi from changed DHCP assignment before proposing a normal frame restart. No settings, launcher, reboot or system changes performed. See [H3 execution record](hardware/h3-firefox.md).

### H3 recovery restart evidence — 17 October 2026

Owner confirmed the router listed the frame as disconnected, then explicitly approved and performed one normal Restart using the Power menu. Boot returned to stock photo-frame Home/Settings; Wi-Fi reconnected at the same private address. After a target-specific Mac ADB disconnect/connect, Classic identity/root shell and retained Firefox 143.0.4 were verified. No further reboot or Android setting/launcher/system change was performed. Stock SystemUI has a zero-height status bar and no navigation-bar window; an offline framework-resource read confirms `status_bar_height=0dp` despite `config_showNavigationBar=true`. Physical exit/manual Firefox return remain unresolved; inspection of visible stock Settings/About found no app-list/Firefox-launch entry. Left stock Home accessible; no app/system settings or launcher changed. H3/M6 remain incomplete; this single recovery boot is not H5 acceptance.

### H3 follow-up ownership

The owner confirmed that stock Settings offers only photo-frame settings. The remaining exit/manual relaunch blocker is tracked as [H3.1 — Physical maintenance and manual Firefox relaunch](hardware/implementation-plan.md#h31--physical-maintenance-and-manual-firefox-relaunch-accepted). H3 stays incomplete until the physical round trip passes; H3.1 includes solution/scope review and specific device-action authorization. Fullscreen and boot automation remain later stages.

### H3.1 host implementation — 17 October 2026

Committed the remaining H3 navigation/recovery evidence as `4a32346`. Reidentified the connected Classic10 read-only (expected firmware/API/ARMv7/root), retained Firefox 143.0.4 and confirmed the proposed helper package is absent. No package, permission, launcher, Android setting or firmware change was performed.

Prepared an original MIT-licensed API 23 maintenance helper under `hardware/maintenance/`: one floating DF button opens explicit stock Home/Settings and existing Firefox launch actions. Only overlay permission is requested; no accessibility service, web engine or boot receiver. [ADR 0004](decisions/0004-frame-maintenance-helper.md) proposes the required native scope exception; the [exact trial/undo and artifact evidence](hardware/h31-maintenance.md) are ready for review. API 23 compilation, D8 desugaring, ZIP/alignment and v1/v2/v3 signature checks passed. This is host preparation; device authorization and repeated owner touch round trips remain pending, so H3/H3.1 stay open.

Upstream main remains `e97c50ba459c49ea8237259f69b95cd28054b628`; refreshed device/kiosk source and current open issues/PRs, including newly relevant #165/#166. The latter reports the same Classic firmware with different WebView/system changes; those are not adopted. No upstream code/assets copied; provenance and intentional differences are in ADR 0004.

### H3.1 approved trial installation — 17 October 2026

The owner explicitly approved ADR 0004's narrow native-maintenance exception and the reviewed APK/normal UI overlay consent/physical trial. Reverified exact Classic identity and retained external H2 backup availability, then installed `dev.dayframe.maintenance` 0.1.0/1 using standard ADB. Installed APK readback matches the reviewed hash and size. The owner enabled its sole overlay permission in the normal Android per-app UI; read-only app-op verification confirms `allow`. Returned once to the helper menu for setup as approved. Physical DF/Firefox and repeated Home/Settings round-trip confirmation remain pending; H3/H3.1 stay open. No launcher/system/accessibility changes, reboot or private provisioning. See the [execution record](hardware/h31-maintenance.md#approved-device-execution--17-october-2026).

### H3/H3.1 acceptance — 17 October 2026

Owner physical testing closes H3.1 and H3: DF works from Firefox; the requested repeated stock Home/Firefox round trips passed; stock Settings through Home → DF → Firefox/Dayframe passed separately. The direct Settings shortcut is unavailable because the vendor activity is not exported (read-only ActivityManager evidence); use stock Home's visible Settings control. The owner completed Firefox onboarding and manually reopened Dayframe from Jump back in when Firefox Home appeared. Browser toolbar remains visible, and neither direct URL reopening nor unattended recovery is claimed.

[Acceptance evidence, exact artifact, permissions and undo](hardware/h31-maintenance.md#acceptance-and-operating-limits) are recorded. Helper 0.1.0 remains installed with overlay permission and DF running; no additional grant, launcher change, system write, reboot or private provisioning followed the approved trial. Source/build checks and installed APK readback passed; final documentation formatting/link/diff checks passed. This closes the requested H3.1 slice only. H4 performance/soak, H5 fullscreen, H6 optional startup/recovery, M4 private display acceptance and overall M6 remain pending under their existing gates.

### H4 preparation and M4 display checks — 17 October 2026

Owner authorized measurement tools/runbook preparation, then M4 display checks and a short baseline before M5. Added independent read-only Python sampler, summary tool and six host tests under `hardware/h4/`; [H4 runbook](hardware/h4-performance.md) records exact use, privacy/failure behavior, test sequence and outstanding acceptance. Refreshed upstream HEAD `e97c50ba459c49ea8237259f69b95cd28054b628`, device index/Modern10 follow-up and animation discussion; no upstream source/assets copied. Actual Classic10/firmware/board/Android/Firefox identity rechecked and two private samples successfully include main, content, GPU and crashhelper processes. This is collection validation only, not stability or a 48-hour result.

Production administrator sign-in and saving existing settings succeeded; anonymous display configuration reads denied over real IPv4 and IPv6. Production smoke passed 19 route checks but failed the exact HTML comparison: local/public HTML differs only by stylesheet fingerprint, with equal stylesheet token multisets and different declaration ordering. Strict comparison remains unchanged; no deployment made. Owner approved read-only display-key creation and physical setup entry, but browser confirmation automation did not complete issuance; physical handoff and all credential/device/off-home acceptance remain pending. [Detailed result table](hardware/h4-performance.md#provenance-and-execution-evidence--17-october-2026).

Six Python tests, production build, lint (two existing photo complexity warnings), Markdown formatting and diff whitespace checks passed. No package/settings/launcher/system change or reboot on the frame, no paid service, no baseline/soak left running, and no M5 implementation in this slice.

### M4 actual-frame provisioning follow-up — 17 October 2026

The owner created the read-only display key, entered it physically on `/setup/`, returned to Dayframe and selected Photos; protected photos now display on the actual Classic 10. Provisioning/image delivery accepted from owner observation. The long key entry is a recorded usability issue; no credential strength or network policy changed.

Executed the planned Firefox-only persistence test after rechecking identity: recorded pre-restart processes, force-stopped only Firefox, verified all Firefox processes absent, then launched the existing Firefox with an explicit HTTPS Dayframe intent. Main PID changed. The immediate private screen capture showed DF maintenance rather than photo evidence; the owner subsequently confirmed that protected photos still display without re-entering the key, completing actual-browser restart persistence. No data clearing or frame reboot. Role denial, rotation/revocation, off-home/dual-stack credential checks, metrics and H4 baseline remain pending. See the [H4 execution record](hardware/h4-performance.md#provisioning-and-firefox-restart-follow-up--17-october-2026).

The owner subsequently replaced the key and confirmed that the frame's old credential is denied and private photos clear on the next mode/reload request. Rotation invalidation and private-pixel denial cleanup pass on the actual frame. Replacement entry is handed to the owner; final reprovisioning, standalone DELETE revocation, display-role denial, off-home/dual-stack paths and metrics remain pending. Do not equate rotation testing with independent DELETE endpoint acceptance.

### M4 non-disruptive acceptance and H4 baseline start — 17 October 2026

The owner confirmed cellular administrator sign-in/private dashboard photos, authorized remaining checks and baseline start, and required preserving the current key. Saved settings reread correctly. Actual Classic/Firefox identity rechecked; frame session returned role `display`, and its authenticated `/api/config` read returned `FORBIDDEN`. Separate credential-management GET evidence was inconclusive because navigation returned anonymous/malformed-route results; no mutation-role production acceptance is inferred. No cookie/profile extraction, rotation/revocation, network interruption, installation, system change or frame reboot.

Rechecked Workers Free $0 current and observed low-volume Worker CPU/errors, Administration request/duration/SQL and photo KV usage below displayed Free limits. The active version matches successful [deployment run 39025857342](https://github.com/codyzu/dayframe/actions/runs/39025857342), whose own 20-route exact-artifact smoke passed. Earlier local-vs-production fingerprint failure is a separate build-reproducibility follow-up; strict smoke remains unchanged. No deployment or billed service was performed.

Started the owner-authorized one-hour preliminary production Photos baseline with once-minute read-only sampling and private evidence/summary. First sample succeeded; no completed-baseline or H4/M6 acceptance claim. It preserves the actual four-tab/browser-chrome environment rather than claiming a controlled synthetic benchmark. Temporary host idle-sleep prevention lasts only for the sampler process. [Current execution details and limits](hardware/h4-performance.md#remaining-non-disruptive-checks-and-preliminary-baseline--17-october-2026). Standalone revocation and second identity are deferred; credentialed off-home/dual-stack and remaining real-frame role checks remain unproven. M5 has not started.

### H4 Photos collection result — 18 October 2026

The 17 October one-hour preliminary Photos run completed at 22:22:26 Paris: 61/61 samples OK, stable observed Firefox PID/process set, final PSS lower than initial. This is collection/process evidence, not continuous visual/touch or H4/M6 acceptance. One CPU result exceeds 100% with CPU hotplug and inconsistent aggregate/process tick deltas; raw evidence is preserved and CPU conclusions require measurement review. Next: preliminary weather hour and later paired motion test; full 48-hour acceptance follows stable M5 behavior. M5 has not been implemented by this chat. See [morning review](hardware/h4-performance.md#morning-review--18-october-2026).

## M5 local implementation record — 18 October 2026

**Status: M5 complete locally with synthetic acceptance; not deployed or pushed. M6 and 48-hour hardware acceptance remain pending.** Existing uncommitted H4 tools, execution records and documentation were preserved. No frame, network, browser/settings, credential, production or paid-service operation occurred during M5.

| Requirement                         | Implementation and authoritative local evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M5.1: schedule resolver             | `src/lib/dashboard/schedule.ts` compiles validated configuration into a pure instant → mode resolver. Configured IANA wall time, half-open boundaries, overnight/midnight periods, spring gaps, repeated autumn minutes, schedule gaps and invalid configuration/time fallback are covered in `tests/schedule.test.ts`. Morning is the documented resolver fallback. Malformed refresh data retains the last validated configuration; first-load failure uses public defaults.                                                                                                                                                                                         |
| M5.2: modes and temporary overrides | Morning, Photos, placeholder Home and dimmed Night resolve from the schedule. Overrides remain per-page memory only, reset on reload, renew on pointer/key activity and expire at the configured inactivity boundary. Both wall and monotonic time count inactivity. Navigation and photo controls hide after 15 seconds and wake on touch/keyboard. A connection retry button exposes no admin tools. Unit tests cover independent displays, exact expiry, touch renewal, sleep and shortened configuration timeout; `tests/e2e/scheduling.spec.ts` covers all modes, reload clearing, actual emulated touch, keyboard reveal and layout.                             |
| M5.3: recomputation/lifecycle       | Startup and one-second ticks resolve current time; pageshow/visibility return, configuration refresh and clock corrections recompute immediately or by the next tick. One display timeout chain and one in-flight configuration request; five-minute refresh, one-minute retry, immediate resume/online/manual recovery. Repeated lifecycle tests prove one recurring settings refresh after wakes. Weather configuration changes dispose old service/listeners before replacement. Browser tests cover forward/backward clock changes, pagehide/pageshow, visibility return, periodic schedule/timezone/location/fit refresh, malformed settings and outage/recovery. |
| M5.4: offline/private photos        | Existing current-plus-next memory bound and five-minute authorized-photo lease retained. Wall/monotonic deadline checks add clock-correction protection; mode/page exit and observed authorization denial release blobs. Browser tests keep Photos active beyond five offline minutes with a backward wall correction, prove pixels expire, then recover online. Separate checks deny configuration while a private image is already painted, observe cleanup, restore synthetic authorization and recover. No private-photo localStorage, Cache Storage, service worker or IndexedDB added. Existing stale weather/offline reload and retry checks pass.              |
| M5.5: Night                         | Near-black rendered background, subdued content and hidden branding; controls hide after inactivity. Screenshots show rendered behavior only. CSS does not change physical brightness/backlight or turn the screen off.                                                                                                                                                                                                                                                                                                                                                                                                                                                |

Final **`pnpm verify` passed** on 18 October: strict Astro/TypeScript checks (**58 files**, zero diagnostics), XO/Prettier (no errors; the same two existing photo orchestration complexity warnings), **79 unit/integration tests**, production build and **109 Playwright checks passed**, with **3 existing duplicate viewport sweeps skipped**. The browser matrix includes Chromium, Firefox, WebKit and iPhone 13 emulation, local HTTPS/SQLite/KV, synthetic photos/weather/settings/identities, existing mobile administration and reduced-motion behavior. Local test servers required loopback permission outside the filesystem sandbox; no production endpoint was used. `git diff --check` and documentation formatting passed. The superseded initial browser run exposed hidden-navigation assumptions in old weather tests and an early request-count assertion; the tests now reveal controls and wait for applied configuration. Final checks above ran after those corrections.

Synthetic visual evidence was inspected and saved separately under `docs/evidence/m5/`: [Morning 1280×800](evidence/m5/morning-1280x800.png), [Photos empty state](evidence/m5/photos-1280x800.png), [synthetic slideshow](evidence/m5/photos-synthetic-1280x800.png), [Home](evidence/m5/home-1280x800.png), [Night with controls](evidence/m5/night-1280x800.png), [Night after inactivity](evidence/m5/night-hidden-1280x800.png), [stale weather](evidence/m5/weather-stale-1280x800.png), [desktop settings](evidence/m5/settings-1280x800.png), [mobile Morning](evidence/m5/morning-mobile.png), [mobile settings](evidence/m5/settings-mobile.png) and [mobile photo admin](evidence/m5/photos-admin-mobile.png). Target frame layouts have no scrolling; mobile has no horizontal overflow. Historical M1–M4/readability/hardware screenshots were preserved; browser tests now write transient artifacts to their own output paths instead of replacing historical M3/M4 files.

Upstream review used the pinned checkout revision **`e97c50ba459c49ea8237259f69b95cd28054b628`**, inspecting `dashboard/js/app.js`, `dashboard/js/system.js` and `dashboard/js/slideshow.js` plus the existing README/manifest/license audit. Retained small mode modules, pointer activity and slideshow start/stop ideas; independently authored IANA scheduling, inactivity/lifecycle and private-memory recovery. Did not adopt demo time, host-local hard-coded night hours, hidden demo drawer, remote demo images, scaling or retained slide history. No upstream license grant found and no upstream source/assets copied. [ADR 0005](decisions/0005-display-scheduling.md) records exact semantics, source links, reuse decisions, retention and browser limits.

Remaining physical acceptance: separately pin an approved future M5 deployment, verify Classic 10 schedule transitions and configured timezone/DST behavior, touch/inactivity/readability, Night pixels versus actual backlight, suspend/clock corrections, Wi-Fi outages/recovery and private-pixel expiry while observing actual painted content. Preserve the current deployed M4 build for pending H4 weather and paired-motion baselines; review the CPU sample over 100% before interpreting CPU comparisons. H4/H5/H6, deferred live M4 checks and the continuous ≥48-hour fixed-build M6 run are not closed by these desktop tests. Cold offline navigation/reload still requires the public shell/assets to be available through normal browser caching; in-page continuity is implemented without a service worker or persistent private-photo storage.

### Remaining H4 work excluding 48 hours — 18 October 2026

Revalidated Classic10/firmware/Firefox identity and unchanged served M4 shell artifact, selected Morning and started the one-hour preliminary weather sampler. Owner unavailable for physical checks; no physical acceptance claimed. Reviewed completed Photos raw CPU evidence: 13/60 intervals have aggregate counter regression and 39/60 change online sets (overlap); the original aggregate CPU summary is unsuitable for comparisons. Added device-verified tick-rate/per-process elapsed-time core equivalents and guarded legacy diagnostics; 11 host tests pass. No application/deployment/settings/credential/network changes. [Detailed evidence and remaining-task matrix](hardware/h4-performance.md#remaining-h4-execution--18-october-2026) records the active collection and unresolved physical, paired-motion, fixture and outage gates. The requested 48-hour exclusion does not close full H4/M6 acceptance.

H4 follow-up: the actual-frame 15-minute weather capture shows advancing clock/chart and automatic weather refresh; 16/16 interim samples OK, no observed process churn. Prepared three synthetic WebPs and a private isolated harness using the exact cached public M4 assets; desktop Firefox verified day/night/rain, all dimensions and fit/Next, without page errors. The temporary host test server was stopped. Actual-frame fixture trials follow the still-running weather hour; a specific built-in reduced-motion preference trial awaits owner agreement and editor availability. Read-only router inspection found guest access only, so outage controls/rollback remain unverified; no network change occurred.

H4 weather hour completed: collector/observer exit 0, 61/61 samples OK, no observed process churn; painted clock/chart and weather refresh captured at checkpoints. Exact kernel-sample span 3598.92 s; separately recorded unchanged visible phase exceeds one hour. Median whole-browser CPU 1.535 cores and PSS ended lower, with paging limits explicit. Owner flagged accumulated VIEW-intent tabs: prior hours retain four-tab stress/functional labels, duplicate test tabs closed, one retained tab verified and Refresh used thereafter. Single-tab synthetic rendering is underway; no deployment, production settings/credential, Android setting or router change. See [final hour evidence and tab correction](hardware/h4-performance.md#weather-hour-result-and-single-tab-correction--18-october-2026).

**18 October accelerated H4 closeout (owner request to conserve credits):** retained the completed four-tab preliminary Photos/weather hours and shortened one-tab synthetic Photos run (10 samples / 539.73 s). Actual frame decoded all three WebPs with peak two instrumented Blob URLs; sustained rain animation **FAIL** from broken SVG timing references. Remaining duration, motion pair, HTTP-failure/lease/recovery, router-outage and unavailable physical checks were explicitly **skipped**, not passed; existing M4 deferrals and 48-hour exclusion remain. No H4/M6 acceptance. See [completed, failed and skipped checks](hardware/h4-performance.md#owner-requested-accelerated-closeout--18-october-2026).

### M2 current-only icon motion — 18 October 2026

Owner requested animation only on the large current-conditions icon. Hourly chart icons now always select the existing bundled static SVGs; the large icon remains animated unless reduced motion is requested. This supersedes the hourly-animation behavior in the earlier icon follow-up. No dependency, external asset or service added.

Re-inspected upstream checkout `e97c50ba459c49ea8237259f69b95cd28054b628`: `dashboard/js/app.js` (`App.icon`), `dashboard/js/views/home.js` (60px current / 22px hourly hierarchy), and `dashboard/css/views/home.css`. Retained the large-current/small-hourly hierarchy; Dayframe independently uses animated Meteocons only for current conditions rather than upstream's inline stroked SVGs. No upstream license file found; no upstream code/assets copied. Existing Meteocons MIT notices apply.

Validation passed: Astro/TypeScript checks, lint (the two existing photo complexity warnings), production build, and all four targeted browser checks (Chromium, Firefox, WebKit and iPhone emulation). Updated motion coverage asserts animated current/static hourly icons, visible static precipitation paths, and live reduced-motion switching. Browser servers required loopback access outside the sandbox. Documentation formatting and `git diff --check` passed. Local change only; actual-frame performance and deployment remain separate.

### M2 collection-wide icon timing repair — 18 October 2026

Owner requested a local fix durable across other icons with the same defect. The collection loader now runs the independently authored `src/lib/weather/icon-timing.ts` before UnoCSS image generation. The installed `@iconify-json/meteocons` 1.2.4 contains 450 icons, 158 with dangling restart references. The transform derives legacy → existing ID mappings from the known numeric-start/self-end pattern, preserving starts, delays and durations, existing valid references, independent loops and original artwork. Shared restart events (including wind-snow and smoke) use the same mapping; conflicting starts/durations or remaining unknown references fail the build. Correct/already-repaired bodies are unchanged. No dependency patch, hard-coded generated-ID list, runtime DOM processing, external asset or paid service was added. Current-only animation, static hourly icons and reduced-motion behavior remain in place.

Re-read the local specification and upstream foundation section; inspected upstream checkout `e97c50ba459c49ea8237259f69b95cd28054b628`, `dashboard/js/app.js` (`App.icon`) and `dashboard/js/views/home.js` (current/hourly hierarchy). Upstream uses inline stroked icons and supplies no Meteocons timing repair; no upstream code/assets copied. Earlier source comparison verified intact `x1`/`y1` timing in the [original Meteocons rain SVG](https://github.com/basmilius/meteocons/blob/f4266e16268d645f0f47692ba5ffe0c8f0198745/production/fill/svg/partly-cloudy-day-rain.svg) versus renamed IDs/stale references in the installed Iconify JSON. The local transform operates on the already-bundled MIT artwork; notices were updated to describe all modifications.

Validation passed: strict Astro/TypeScript checks (60 files, zero diagnostics), XO/Prettier (only the two existing photo complexity warnings), production build, 28 focused weather/icon unit tests and all 12 focused browser checks across Chromium, Firefox, WebKit and iPhone emulation. Documentation formatting and `git diff --check` passed. Structural coverage checks all installed icons, idempotency, valid links, shared events and unsupported/ambiguous input. The browser regression consumes the exact production CSS SVG, inlined only for deterministic SMIL seeking, and checks day/night drizzle, sleet, rain, snow, showers, lightning and hail after three and ten cycles. A probe against the old build failed on disappeared droplets as expected. During test development, fixture caches and SVG sampling were made explicit, using fresh timelines per sample to avoid WebKit seeking-history artifacts; superseded browser failures are not the final result.

Not run for this slice: full `pnpm verify`/unrelated photo/admin/scheduling suites, production deployment/smoke, actual Classic 10 repeated playback, motion cost or physical acceptance, real outages and the 48-hour soak. Existing M4/H4/M6 deferrals remain; the historical frame rain failure is not closed by desktop playback. This change remains local and uncommitted; no frame/browser/network/settings/credential changes were performed.

### H5 readiness after short actual-frame checks — 18 October 2026

Confirmed [production run 39125002690](https://github.com/codyzu/dayframe/actions/runs/39125002690) successfully verified, uploaded and smoke-tested revision `ca922ad930bc65556b163f709aaaae5d03776608`. This supersedes historical local-only/uncommitted repair and in-progress deployment statements. The successful workflow recorded 84 unit/integration tests, 113 browser passes and the same three intentional skips.

Reverified Classic10 identity/firmware/Firefox and one retained tab. Production protected photos and Night/Morning navigation worked; current-build synthetic actual-frame tests passed repeated rain playback with static hourly icons, one Europe/Paris real-clock Morning → Night boundary, Photos override/30-second inactivity expiry, zero retained Blob URLs/photo elements after mode exit, and Home/Night rendering. Browser toolbar clipping remains H5 work. [Detailed execution, provenance and limits](hardware/h4-performance.md#short-fixed-build-checks-and-h5-handoff--18-october-2026).

The owner authorized moving to H5 with all previously skipped checks kept deferred. H5 may now begin with manifest/existing-launcher shortcut evaluation and the accepted H3.1 maintenance route; no H5 device action is claimed. Full H4/M4/M5/M6 acceptance, the live security matrix, motion performance, failure/outage/recovery cases, physical observations, broader lifecycle/DST and the 48-hour run remain open. No household configuration, credentials, network, Android/browser settings, packages or firmware changed.

### H5 fullscreen implementation in progress — 18 October 2026

Added dashboard-only fullscreen/landscape manifest with a stable `/?display=frame` start URL and two PNG launcher icons derived from original Dayframe artwork. No service worker, private cache, authentication or controller change. `pnpm verify` passed (84 unit/integration tests, 113 browser passes / three existing skips); final build metadata/icon checks passed. Commit `3763694` deployed successfully in [run 39126495363](https://github.com/codyzu/dayframe/actions/runs/39126495363), and served manifest/icons match the committed files.

After the stock launcher failed the manifest recheck, the owner-approved verified Rootless 3.9.1 trial succeeded, retaining Home preferences and leaving phone/storage ungranted. Firefox restart exposed the normal install prompt; Rootless was chosen **Just once**. The resulting shortcut opens Firefox’s standalone activity with protected photos and all four modes at a measured native 1280 × 800 surface, no toolbar and no reported scrolling. Existing DF → Firefox returns ordinary chrome, so a same-permission 0.2.0 maintenance update adds shortcut-launcher access. The owner approved that exact APK update and both boot checks; installation/version/readback hash and restored DF passed. Physical full round trips and execution of the approved boot checks remain pending. [H5 execution record](hardware/h5-fullscreen.md) preserves provenance, checks, artifacts and undo. All earlier skipped checks remain deferred; H4/M4/M5/M6 full acceptance is not closed.

### H5 normal reboot follow-up — 18 October 2026

Owner-approved maintenance 0.2.0 installed with matching installed APK hash, retained overlay grant and restored DF. The owner passed two physical fullscreen → DF → stock Home/Settings → shortcut → fullscreen/private-photo round trips. One separately approved normal reboot completed on the verified Classic10; Home chooser was foreground, DF did not auto-start, and Home preferences/overlay grant were retained. The owner restarted DF physically, then requested remote completion after leaving home. The retained Dayframe shortcut was found on the second launcher page and reopened fullscreen, but protected photos showed **Accès privé requis**: post-reboot authentication is a failure, not acceptance. Both current global IPv6 addresses match the privately configured home ranges; the exact auth cause remains unproven.

Automatic approval review rejected the planned existing-profile `/api/session` diagnostic pending specific permission to send the existing cookie to the deployment; no command in that rejected call ran, and no workaround/credential rotation/allowlist change was performed. The owner subsequently approved the exact diagnostic; ordinary Firefox also returns `UNAUTHORIZED`, so the failure is not confined to the standalone activity. Clock inspection matches current UTC; no credential value was read or changed. The underlying cookie/backend/network cause remains unresolved. The approved cold cycle remains unexecuted until physical owner availability. [Detailed H5 evidence](hardware/h5-fullscreen.md). All earlier skipped checks remain deferred.

The approved session diagnostic found ordinary Firefox also unauthorized. Read-only, value-free cookie metadata then established schema 16 and an expiry of 5 February 1971, with near-epoch creation/access timestamps. Current UTC and actual Firefox IPv6 home-range checks pass. A boot-clock race is a supported hypothesis, not a captured sequence. Existing-key reconnect through normal setup is prepared but unexecuted pending scoped credential-use authorization; no rotation, cookie database edit or allowlist change is proposed. [Diagnostic, source references and recovery scope](hardware/h5-fullscreen.md#approved-session-diagnostic-and-expired-cookie-finding). H5 remains incomplete; earlier skips stay deferred.

### H5 existing-key recovery — 18 October 2026

The owner explicitly approved the prepared existing-key reconnect. The reviewed hash-matched temporary API 23 diagnostic read the exact existing display-cookie value only on the frame and entered it locally into verified normal HTTPS setup. No key returned to the Mac, appeared in a URL/log or was rotated; no new app/system setting/default Home/device reboot was involved. Normal setup accepted it and restored decoded protected-photo elements in ordinary and fullscreen Firefox. Metadata now has current creation/access timestamps and a future expiry of 17 October 2027. The approved **single Firefox-only restart** with the clock correct retained that expiry and restored protected photos in both contexts without key re-entry; one ordinary tab and the original Home preferences remain. The frame is left fullscreen with private photos and DF available. The first post-restart UI check preceded control readiness; its follow-up passed without another restart. [Execution and limits](hardware/h5-fullscreen.md#owner-approved-existing-key-reconnect).

This repairs the running profile, not the suspected early-boot clock race. H5 remains incomplete pending its device-boot/cold-power acceptance; cold power still needs the owner physically present. Home chooser/DF startup and clock readiness justify H6 evaluation, with no H6 change implemented here. Every previously skipped check remains deferred.

### H5 cold-power observation — 18 October 2026

The owner returned home, requested the cold-power check and reported reconnecting after the unplug/wait/reconnect instruction. Changed boot ID, completed boot, matching identity, correct current UTC, retained overlay grant and unchanged Home preferences were verified. Startup stopped at Android Home chooser; DF/maintenance did not start, while Firefox was already running. The bounded observer had ended before that reconnect, so its early sampling is not claimed; direct observations began around 105 seconds and retained logs supplied the early ordering. The owner was directed to **Rootless → Just once**, maintenance/DF and the existing second-page shortcut; the physical Photos result is pending.

Read-only metadata shows the exact cookie again expired in February 1971, with near-epoch creation/access timestamps. Fresh event logs identify Firefox’s `RescheduleReceiver` launching the main process on 1 January 1970, followed by Gecko, before the later kernel clock-change notification. Package inspection confirms the receiver’s boot/time filters and enabled state; no receiver, setting, permission, profile or key was altered. No additional power cycle was requested. [Cold execution and limits](hardware/h5-fullscreen.md#owner-performed-cold-power-execution--18-october-2026). The original correct-clock browser-restart pass remains valid within its scope; device-boot authentication does not pass. Earlier skipped checks remain deferred.

The owner confirmed **Fullscreen returned, but photos need access** for the physical cold-start route. The existing approved on-frame normal-setup reconnect restored ordinary and fullscreen photos with DF and a future expiry; no extra Firefox restart, power action, key rotation or Home preference change occurred. Installed-APK source provenance then identified Firefox revision `08388fb6b18c61dbb3d0baa9bee4e7440b85f671`; its persisted-cookie validation clamps expiry to current time + the default 400-day client cap. A [concrete reversible `network.cookie.maxageCap=0` trial](hardware/h5-fullscreen.md#prepared-firefox-cookie-cap-trial--approval-pending) is prepared with exact payload/script hashes, absent-override baseline and undo. It has not run; it needs separate profile-change and additional-cold-cycle approval. Backend expiry/authorization stay enforced. Earlier skipped checks remain deferred; H5 is not marked complete on the failed cold-boot gate.

### H5 approved cookie-cap trial and cold retest — 18 October 2026

The owner approved the exact Firefox preference trial and one additional cold test. Only `network.cookie.maxageCap=0` was added to the dedicated profile; one Firefox restart loaded it and protected photos worked fullscreen with DF. The owner performed the additional cold cycle. Startup again reached the Home chooser without DF auto-start, but the preference and unchanged October 2027 cookie expiry survived despite early Firefox startup with a January 1970 clock. No key was entered/read, no cookie database was patched and Home preferences stayed unchanged. The owner’s physical fullscreen/Photos result without key entry remains pending; H5 is not complete. [Detailed execution, exact hashes and undo](hardware/h5-fullscreen.md#approved-trial-execution-and-cold-retest--18-october-2026). The disconnected backup disk does not block this reversible app-profile trial; no system/firmware write or restore is involved. All earlier skipped checks remain deferred. H6 is needed for unattended startup/recovery.

### H5 completed for manual fullscreen — 18 October 2026

The owner confirmed fullscreen/private Photos without key entry after the approved cookie-cap cold retest. Read-only final inspection showed the protected photo occupying 1280 × 800, Firefox's standalone activity without its toolbar, and DF present. The reported retry button is an unconditional manual retry control, not an error indicator. [Requirement-by-requirement acceptance audit](hardware/h5-fullscreen.md#final-physical-result-and-h5-completion-audit--18-october-2026) closes H5 for the documented manual route; earlier normal/cold failures remain recorded. The accepted preference remains applied with explicit profile-wide tradeoff and undo. H6 is needed for unattended startup/recovery because Home chooser and manual DF startup remain. All previously skipped checks stay deferred; full H4/M4/M5/M6 acceptance is open. No further boot or H6 action is authorized by this closure.

## H6 startup slice — 18 October 2026

Owner requested automatic Dayframe startup after a power cycle, retaining every prior skip as deferred. [ADR 0006](decisions/0006-firefox-boot-helper.md) selects a bounded helper 0.3.0 boot receiver using the installed Firefox fullscreen shortcut and existing profile; no new web engine or Home preference change. Read-only actual Classic identity/firmware/Firefox/helper/overlay and shortcut metadata were rechecked. Upstream HEAD remains `e97c50ba459c49ea8237259f69b95cd28054b628`; device/kiosk sources and current relevant reports were refreshed, with no source/assets copied.

API 23 compilation, ZIP/alignment, same-signer v1/v2/v3 verification and host clock/network/address checks passed. [Exact APK, proposed actions, limitations and undo](hardware/h6-startup.md). The owner approved the exact trial. 0.3.0 install/readback, retained overlay grant/Home preferences, normal-UI enablement and fullscreen/private-photo/DF checks passed. One normal reboot automatically returned to standalone Dayframe/DF (first observed at 59.62 seconds uptime, retained through 139.53 seconds), correctly showing scheduled Night. The owner-operated cold cycle retained fullscreen/private Photos/DF return, but the owner selected Rootless **Just once** during startup; hands-off cold startup remains unverified. All older skipped checks remain deferred and full H4/M4/M5/M6/broader H6 acceptance remains open.

**Additional untouched reboot:** owner approved one further normal restart with no taps for two minutes. Read-only observation verified the helper replacing the transient Home chooser: standalone first observed at 58.68 seconds uptime, retained through 137.91 seconds, with DF, correct clock and unchanged grant/Home XML. The retained startup log contains the helper PWA launch and no Rootless HOME selection. No source/APK/Home change was needed; the owner confirmed **Yes, no taps needed**, accepting hands-off normal-reboot startup. Strict hands-off cold startup remains unverified because the earlier cold trial included a chooser tap; all previous deferrals and broader recovery gates remain open.

**Final untouched cold-cycle acceptance:** owner performed the proposed unplug/wait/reconnect test and confirmed **Yes, it worked by not touching it!** The observer verified changed boot/identity, fullscreen Firefox/DF already present at 57.71 seconds uptime and retained through 148.12 seconds, protected photo capture, corrected clock, unchanged Home preferences and retained overlay grant. Logs show the helper PWA launch with no Rootless HOME selection; the observer performed no navigation/credential repair. This closes the requested H6 startup slice for normal reboot and cold power restoration. Leave the transient chooser untouched; no **Always** selection is needed. Broader H6 failure recovery and all previously deferred checks remain open. [Final evidence and operating instructions](hardware/h6-startup.md#final-untouched-cold-cycle--startup-slice-accepted).

## H6 remaining recovery implementation — 19 October 2026

Owner requested completing what is possible for H6 while keeping earlier skips deferred. Re-audited current source/stage gates and read-only actual Classic/firmware/Firefox/helper/Home state; refreshed required upstream HEAD/device/kiosk/clock/logging research, still at `e97c50ba459c49ea8237259f69b95cd28054b628`, with no source/assets copied. Existing startup acceptance remains valid.

Prepared the independently authored `dev.dayframe.kiosk` GeckoView 143 recovery package with a distinct persistent profile, strict origin/setup policy, clock-before-runtime gate, successful-stop plus isolated readiness signal, bounded jittered load/paint/renderer/session recovery, native DK/physical gesture controls and a separate process/UI supervisor with restart limits and independent maintenance. Official AAR/source/ARMv7/min-SDK/license and dependency graph/signing/permission/export checks passed; 21 Java and 5 JavaScript host tests, native release build and clean Android lint passed. [ADR 0007](decisions/0007-geckoview-recovery-trial.md) records the native scope, exact source/API, rights and deliberate differences.

The reviewed private APK is concrete; [staged device trial, rollback and requirement audit](hardware/h6-recovery.md) were explicitly approved by the owner on 19 October; execution is recorded there. No APK, key, cache or household evidence is committed; no device package, profile, permission, credential, process, boot/network or accepted-startup change was made during preparation. Full H6 remains incomplete: host tests do not prove actual recovery/paint/physical/auth behavior, and all prior deferrals remain deferred.

## Family morning UI iteration — 19 October 2026

Owner requested a substantial accessible warm-theme iteration alongside H6. Completed locally as an extension of delivered M2/M5, without device actions, deployment, new dependencies/services or changes to the H6 files. Re-reviewed upstream `dashboard/index.html`, `dashboard/css/tokens.css`, `dashboard/css/views/home.css` and `dashboard/js/views/home.js` at `e97c50ba459c49ea8237259f69b95cd28054b628`; independently authored implementation, no upstream code/assets copied. [ADR 0008](decisions/0008-family-morning.md) records provenance, theme tokens, fractional-hour forecasts, maximum-hourly rain bars, advice rules, private agenda boundary and saved photo framing behavior.

Delivered: centralized warm palette across views/admin/setup; large animated current Meteocon plus four animated checkpoint forecasts with reduced-motion stills; 06h–22h temperature trend/eight two-hour maximum-probability bars; deterministic concise clothing/rain advice; reusable three-entry agenda presentation with honest empty state; cover/fill photo defaults retaining explicit saved contain; compact centered navigation, existing density preferences and conditional retry. Fullscreen manifest identity/scope/launch behavior is preserved; only its theme/background metadata colors change.

Validation: `pnpm check` and build passed; 93 unit/integration tests passed; complete Playwright suite 120 passed/4 intentionally skipped across Chromium, Firefox, WebKit and mobile. Application XO passes with two existing photo complexity warnings. Full-repository lint still finds 215 formatting diagnostics in H6’s concurrent generated license JSON; left untouched. Both frame densities fit 1280 × 800 with no scroll; desktop/phone, stale/error and long-weather-condition states checked. [Reviewed synthetic previews and complete validation record](ui-redesign.md). No invented appointments or private household content added.

Remaining acceptance: family readability/brightness at mirror distance and actual Firefox 143/Classic 10 performance with five animated icons. No hardware, deployment or pre-existing M4–M6 acceptance is implied; all existing H6 deferrals remain unchanged.

## UI photo recovery CI correction — 19 October 2026

The first UI push failed Linux WebKit/mobile photo recovery tests before deployment upload. Fixed conditional retry to include the active slideshow’s explicit failure state; a successful configuration response can no longer hide a photo error. Kept navigation anchored independently of retry so recovery cannot move mode buttons between pointerdown and pointerup. Privacy checks, immediate private-photo clearing and retention limits are unchanged. A deterministic 401 regression failed before the fix, then passed with recovery and stable-navigation assertions in all four browser projects.

The exact `pnpm verify` pipeline passed in a clean snapshot excluding unfinished H6 files: type checks, full lint with two existing complexity warnings, 93 unit/integration tests, build, 124 browser tests passed/4 intentional skips. [Failure analysis and validation](ui-redesign.md#ci-recovery-correction--19-october-2026). The fix is committed/pushed separately from ongoing H6 recovery work; remote verification uses the existing Checks/deployment workflows.

## H6 staged recovery outcome — 19 October 2026

**H6 native recovery closeout — 19 October 2026:** reviewed 0.1.3/code 4 is installed with native startup/supervision enabled and old helper startup off. Current UI/load-stall recovery, protected-photo persistence, physical maintenance and normal reboot passed; the owner confirmed automatic cold startup without taps. The late host connection confirmed healthy fullscreen Night/DK and unchanged configuration, but cannot establish the cold two-minute timing. H6 is complete for the approved operational scope: the owner passed post-cold Photos without key entry and both maintenance paths. Isolated paint-reset recovery remains unverified with native reload/manual Firefox fallback; prior version-scoped recovery evidence is retained. No further power action is planned or authorized. Prior deferred checks remain deferred; full M6 remains open. [Current requirement audit and execution](hardware/h6-recovery.md#current-requirement-by-requirement-audit).

## Safari built-icon animation correction — 19 October 2026

The owner's iPhone report reproduced frozen partly-cloudy animation in the deployed SVG CSS background despite intact animation tags. A native-image workaround was intermittent and rejected. Build-time expansion of animated Meteocons symbol references into SVG groups preserves explicit view-box scaling, visible overflow and one animation timeline. Scoped IDs use underscores to retain Firefox repeating syncbase timing. No runtime work, dependency, provider/mapping or reduced-motion change. Existing upstream review and MIT provenance in [ADR 0008](decisions/0008-family-morning.md#safari-animation-correction--19-october-2026) apply; no upstream code/assets copied.

Clean `pnpm verify` passed: type checks, full lint with two existing photo complexity warnings, 96 unit/integration tests, build and 128 browser tests/4 intentional skips. New tests validate all 450 bundled icons and compare actual animated/still rendered frames in all four browser projects; long-cycle precipitation/lightning checks remain passing. [Validation and browser limits](ui-redesign.md#safari-animation-correction--19-october-2026). Physical iPhone/Classic 10 and family acceptance remain separate. H6 files/device state are outside this correction.

## Morning rain percentage labels — 19 October 2026

Owner requested readable rain percentages on the graph. Added a rem-sized 0/50/100% scale and one label above the first highest two-hour bar, including a dry-day 0%. Maximum-hourly aggregation semantics, eight bars, temperature curve and the 100px plot height remain. Reserved label space and adaptive current-time caption prevent overlap. Existing text-size preferences apply. Re-inspected upstream home JS/CSS at `e97c50ba459c49ea8237259f69b95cd28054b628`; independently authored chart changes, no upstream code/assets copied.

Clean `pnpm verify` passed: types, full lint with two existing photo complexity warnings, 96 unit/integration tests, build, 132 browser passes/4 intentional skips. Focused fixtures cover 0/65/100%, tied peaks, final-interval labels, non-overlap, readable Large labels and frame/phone bounds. Reviewed rendered 1280 × 800 and phone screenshots. [Presentation details and validation](ui-redesign.md#visible-rain-probabilities--19-october-2026). H6 work remains separate.

## M6 continuation and owner deferrals — 19 October 2026

Reconciled the request against accepted H1–H3.1, H5 and H6 operational evidence. The owner explicitly directed **do not implement hardening yet**; H7 is deferred and the uncommitted H7 host-tool/runbook draft was withdrawn. No router/device/ADB/credential change or live H7 probe occurred. Existing M4/H4/M5 and extended-stability deferrals remain deferred.

Added the [Classic 10 setup and operating guide](hardware/operating-guide.md), checked against current native menu/receiver/configuration source and acceptance records at `2f18c01`. It consolidates the current 0.1.3 installation, replacement setup gates, normal scheduled startup, DK/Settings maintenance, session/reload/auth recovery, Firefox rollback and a requirement-by-requirement M6 audit. README/status entry points now distinguish completed operational implementation from deferred full-M6 acceptance. H8 remains a separate device comparison awaiting delivery/own-unit inspection.

Validation is limited to Markdown formatting, local links and diff checks. No completed application/native/device test is repeated for this documentation slice. Full M6 remains open because missing actual network, performance, physical and extended-stability acceptance cannot be established from source or past narrower tests.

## M6 overnight observation — 19 October 2026

Owner authorized unattended work while sleeping. Began a ten-hour native 0.1.3 read-only observation at approximately 22:07 Paris with the first healthy sample recorded; expected end around 08:08 on 20 October. [Scope and active-run record](status.md#authorized-overnight-native-observation--19-october-2026). New bounded collector reuses H4 PSS/device-tick CPU accounting with explicit native-package selection and includes supervisor/renderer processes, reported health/foreground and continuity guards. Four focused native-observer checks and nine affected measurement checks passed. No boot/fault/web suite repeat, device/network/credential change or hardening. This opens overnight stability evidence only; the full 48-hour exclusion and unrelated acceptance deferrals remain.

Required upstream Modern10 device notes refreshed through GitHub on 19 October; same source baseline `e97c50ba459c49ea8237259f69b95cd28054b628`, with no fresh HEAD assertion and no copied code/assets. Independently authored observation tooling uses the existing Dayframe CPU accounting; upstream two-day claims are not Classic acceptance.

## iPhone framing, admin sessions and forecast motion — 20 October 2026

The owner's photo-framing report exposed a page-only selector overwritten by configuration refreshes. Explicit contain/cover choices now persist per browser in `dayframe.photo-fit.v1`, ahead of the household default; unavailable storage retains the choice for this page. No photos or credentials are stored. The four forecast checkpoints use the already bundled still SVGs; only current conditions animate, with the existing reduced-motion fallback retained.

The owner selected seven-day admin sessions. Changed the Worker's maximum token age from one hour to seven days while retaining signature, issuer, audience, allowlist, issued-time and signed-expiry validation. [ADR 0002](decisions/0002-protected-photos.md) records the longer direct-API revocation window. [Photo operations](photos.md) documents matching Access application/Allow-policy durations and the required fresh sign-in. On 20 October the owner explicitly requested the live Cloudflare change: saved application Session Duration as **1 week**, observed Cloudflare's success notification, then reopened the application and verified the persisted value. The existing administrator Allow policy already used **Same as application session duration**, so it needed no edit. The allowlist, destinations and other authentication settings were not changed. Code deployment and fresh-login acceptance remain pending; changing the Worker alone does not extend existing tokens.

Re-inspected upstream README, `dashboard/js/slideshow.js`, `dashboard/js/views/photos.js`, `dashboard/css/views/photos.css` and `dashboard/js/views/home.js` in the local checkout at `e97c50ba459c49ea8237259f69b95cd28054b628`. Retain fullscreen layout controls and a current/forecast weather hierarchy as reference; deliberately use persistent local framing and Dayframe's bundled Meteocons still/animated variants. The upstream license audit remains unchanged (no license file at that revision); no upstream code/assets copied. No service, dependency or hardware change.

Validation: Astro/Worker type checks, build, changed-file XO and 97 unit/integration tests passed. Twelve focused framing/settings/privacy browser cases passed across Chromium, Firefox, WebKit and iPhone emulation. The complete browser suite passed 136 tests with four existing intentional skips, including current-only animation/reduced-motion and persistent framing regressions. The initial `pnpm verify` attempt stopped at 215 existing formatting diagnostics in `hardware/kiosk/app/src/main/assets/licenses/runtime-artifacts.json`. Before the owner-requested push, normalized only that file’s indentation so CI/deployment can pass; parsed JSON equality against HEAD confirms unchanged license content. Physical iPhone acceptance and live seven-day login verification remain open.

## Offline Morning resource investigation — 20 October 2026

Completed the owner-requested analysis of the existing overnight evidence; see [per-process findings and comparison baseline](hardware/overnight-analysis-20261020.md). Revalidated 601 samples/600 CPU intervals. Sustained CPU rise near the scheduled 06:00 boundary is dominated by the GPU process; Morning memory growth is dominated by main-process unclassified private-dirty memory and includes a separate 07:31 step. Animation is a leading CPU hypothesis, not established memory causality. The owner is changing icons in another conversation. No device connection, new experiment, app change or deployment was performed. H4/M6 acceptance and all previous deferrals remain open.

Follow-up existing-log audit narrowed the 07:31 step to a main-process private-memory/page-fault burst already underway before that sample's memory dump, with system paging/reclaim changes and unchanged sampled app/native/window state. Saved counters cannot identify the internal operation or trigger; no overnight event-level logcat/maps/stacks were captured. See the report's focused audit and sanitized event detail. No device action or icon work performed; acceptance remains open.

### H6 maintenance visibility refinement — 20 October 2026

Owner requested hiding DK during normal display use while retaining the native two-finger hold and independent DK return from Android Settings. The 0.1.4/code 5 candidate removes only the Activity's permanent display button; gesture, failure-screen access and supervisor overlay are retained. Offline release/lint/signature checks, 35 Java tests, 6 probe tests and 21 host tests passed. Connected Classic identity and the exact installed 0.1.3 artifact were confirmed read-only. The owner confirmed retaining the verified backup and waived reconnect/reverification. The exact signed 0.1.4 artifact is now installed in place; protected Photos rendered without key entry and the display has no DK. Boot/supervision flags and Home preferences were retained. Settings → independent DK → kiosk passed in the same process/session, and the owner confirmed the physical two-finger menu opens and closes. The requested visibility slice is complete; evidence is recorded in the linked execution record. [Artifact, upstream review, acceptance steps and version-scoped tooling limits](hardware/h6-recovery.md#dk-visibility-update--20-october-2026). This slice changes no firmware/system settings or recurring services.

## Upstream comparison — 20 October 2026

Recorded the [current upstream comparison](upstream-comparison-20261020.md) against
`f1e0820918c926396e0ccafb4839568825f63edc`, including source paths, the new MIT license,
matching-firmware Classic10 report and deliberate architecture/privacy differences.
Prioritize cached formatters and changed-value rendering with module-local state;
animation measurement, diagnostics, USB investigation and integrations remain separate.
No source/assets copied, code/device changes or new acceptance claims in this documentation slice.

## Changed-value rendering — 20 October 2026

Implemented upstream comparison item 1 with module-local state: cached timezone-aware
clock/date/hour formatters; minute/timezone clock refresh with guarded text writes;
stable forecast/chart nodes until new data or a new local day; in-place time marker and
stale/advice updates; deferred weather DOM work outside visible Morning. Fetch/cache/backoff,
one-second schedule/privacy checks and animation policy remain intact. No new dependency,
service, native/device change or upstream code/assets copied. [Behavior](weather.md#changed-value-rendering--20-october-2026).

Type checks/build and changed-file XO passed. All 98 unit/integration tests passed; 43
focused browser tests passed across Chromium, Firefox, WebKit and mobile, with one existing
intentional skip. Regressions verify stable nodes, unchanged clock writes, inactive data
recovery and timezone-cache invalidation. No actual Classic CPU/memory gain or outstanding
hardware acceptance is claimed.

## Remove unused Home mode — 20 October 2026

Owner requested retiring the household-automation placeholder until useful integrations
exist. Removed the Home panel, navigation button, active mode type and schedule-editor
option. Default Photos now spans 10:00–21:00. Shared settings validation normalizes legacy
`home` periods to `photos`, retaining their times, other settings and credentials; reads
do not mutate storage, and the next ordinary save persists normalization. Unknown modes,
extra fields, invalid times and overlaps remain rejected. Updated current requirements,
status, [administration](administration.md#retired-home-mode--20-october-2026) and
[ADR 0005](decisions/0005-display-scheduling.md#home-removal--20-october-2026).

Full `pnpm verify` passed: type checks, lint (only the two existing photo-complexity
warnings), 99 unit/integration tests, build and 148 browser tests / 4 existing intentional
skips across Chromium, Firefox, WebKit and mobile. Tests cover persisted legacy reads/save,
credential preservation, old display configuration, retained schedule/DST/override behavior
and absence of Home in navigation/editor. Reviewed the synthetic 1280 × 800 Morning
preview with three-mode navigation and no scroll. The first full browser run exposed an
old animation-test assumption that hidden weather had already rendered; moved its data
assertion after entering Morning, preserving the actual animation/reduced-motion checks.
The corrected full pipeline passed. No dependencies, copied upstream code/assets, device
changes, deployment or new hardware acceptance. Existing installed native probes support
the three retained modes; no APK update is needed for this web slice.

## M7 Google Calendar slice — 20 October 2026

Owner requested administrator OAuth connection and Morning events from the shared
**Family** calendar. Added connect/reconnect, verified calendar selection and disconnect
in settings; one read-only Google connection and bounded client-rendered agenda. Existing
admin/display authentication, home-network restrictions and mutation-origin checks cover
all calendar routes. Tokens use encrypted private storage in the existing Administration
object; transactional revision checks prevent stale in-flight writes after disconnect.
No new binding, migration, package, hardware action or paid service. Existing M6 deferrals
retain their scope; this owner-requested web slice does not close them.

Reviewed upstream `dashboard/js/views/{home,calendar}.js` and MIT license in local checkout
`3969b453b9375f7cb63cf9931e983e2657f97852`. Adapt the short remaining-event hierarchy as an
idea; independently implement private live Google reads rather than mock/full-grid event
editing. No source/assets copied. [Design, security, setup and limits](calendar.md).

Google Cloud project and Web OAuth client created in the owner's browser after explicit
approval of API terms, enabling Calendar API and client creation. Downloaded client JSON
validated and copied to ignored owner-only private storage. Subsequent read-only billing
audit found Google had automatically linked the new project to an existing billing
account without a billing prompt. Owner explicitly approved disabling billing for this
new project only after the Google warning. The action succeeded and the linked-project
list no longer contains Dayframe; other project links were retained. No billable resource
was provisioned in this new project. Calendar consent is still pending.
Four runtime secrets are configured on the existing production Worker. Deployed version
`a9eedb35-5fd7-4aa4-9eaa-cc924345b1ac` (final privacy-link spacing correction;
initial integration version `e225a0ee-dad6-44f4-a55d-da9e4cb5be7f`) after full verification. The authenticated live admin
interface shows the enabled Google connection controls. After the owner explicitly
approved production publishing and read-only consent, Google confirmed **In production**.
The owner separately approved continuing through Google’s unverified-app warning.
Google read-only consent succeeded after correcting Workers’ unsupported `redirect: error`
mode to manual redirect handling (non-success status rejected). **Family** was selected
and saved in the live administrator interface; the persisted status reads “Agenda affiché : Family”. The dedicated public calendar privacy notice is deployed and
linked in admin and Google branding.

Full `pnpm verify` passed: types, lint (five complexity warnings, including three in the
extended auth/administration/calendar routers), 105 unit/integration tests, production
build and 156 browser tests / four existing intentional skips. Calendar cases cover real
workerd SQLite CAS persistence, roles/network/origin, PKCE/state replay, partial consent,
refresh/revocation, disconnected-race protection, DST and event filtering. Browser cases
cover selection, escaped titles, all-day/ongoing labels, no scrolling at 1280×800, and
clearing denied/offline data. The added static privacy page and admin link subsequently
passed focused lint, types and build. Wrangler production dry-run passed; production
smoke checks verify matching built public HTML, the privacy page, all anonymous calendar
reads denied (401), and calendar mutations denied (403). No long-lived token/actual-frame
acceptance is claimed yet.

Calendar live callback correction: deployed Worker version
`36e66ef7-5431-4647-8092-50c9cb6f7553`. A synthetic workerd probe reproduced the
unsupported redirect mode; a new complete OAuth/selection/agenda regression executes the
actual bundled Worker in workerd and confirms provider redirects are never followed.
All 106 unit/integration tests and type checks passed; changed-file lint passed with the
existing calendar-router complexity warning. No new permissions, secret values or paid
resources were introduced by this correction.

Live acceptance: authenticated Morning successfully loaded the selected Family calendar
and rendered “Aucun autre événement aujourd’hui.” (no remaining events today). No
household event titles or calendar IDs were copied into this evidence. Google publishing
status is In production; read-only consent and Family selection are complete. Billing
remains disabled. Token longevity and physical frame acceptance retain their stated limits.

Final pre-commit acceptance: the owner's new test appointment appeared at its expected
time on live Morning after refresh. Full `pnpm verify` passed again with 106
unit/integration tests and 156 browser tests / four intentional skips, zero type errors
and the five recorded complexity warnings. No household event title was recorded in Git.

## Display refinements — 20 October 2026

Owner requested Photos through 23:00, substantially larger Night typography, and a useful
clock/current outdoor temperature over Photos. Public defaults and the specification now
use Morning 06:00–10:00, Photos 10:00–23:00, Night 23:00–06:00. Photos reads the clock
from the dashboard's existing locale/timezone formatter and gets rounded current
temperature from the existing Open-Meteo service/cache; unavailable weather shows `—°`.
Night's supporting text, clock and heading now use the available display area. There is
still one schedule for every day: weekend forecasts have distinct content, but schedules
do not vary by weekday and vacations/holidays are not detected. No weekend/vacation time
segments were previously decided. Saved household settings override public defaults and
must be updated in Administration for the live frame to apply 23:00. The current upstream
comparison remains the source review: `f1e0820918c926396e0ccafb4839568825f63edc`,
including `dashboard/js/slideshow.js` and `dashboard/js/views/photos.js`; use the overlay
as a Dayframe addition. No upstream code/assets copied. No device action or deployment.

Read-only live check of the owner’s Classic 10 on 20 October: the connected device reports
`Classic10`, Android 6.0.1/API 23, ARMv7, and Dayframe kiosk 0.1.4/code 5. At 22:31 and
22:36 Paris, the frame showed the earlier small-text Night screen; it did not show the new
Photos overlay. The second observation followed five minutes without input from this
session. This confirms the requested web refinement is not yet present on the frame; the
23:00 transition has not been physically verified. Saved household settings can override
public defaults, and an outstanding manual mode override cannot be ruled out from the
screen alone. No frame input, reboot, setting/credential change or deployment occurred.

Final `pnpm verify` passed: Astro/TypeScript checks, lint (five existing complexity
warnings), 108 unit/integration tests, production build and 156 browser tests across
Chromium, Firefox, WebKit and mobile, with four existing intentional skips. Browser
checks assert the Photos clock and fixture temperature, larger Night heading, and the
23:00 Paris transition at 22:59:59/23:00. After validation, owner-requested commit
`bdd4e0a` was pushed to `main`; GitHub Actions deployment run
[39494412178](https://github.com/codyzu/dayframe/actions/runs/39494412178) passed its
verification, Cloudflare upload and live-deployment check on 20 October. The earlier
read-only frame observations at 22:31 and 22:36 Paris were made before this deployment;
they do not verify the new screen or the physical 23:00 transition. The live frame may
need a page reload, and saved household schedule settings may override the public default.

## Current weather icon contrast — 21 October 2026

Owner reported pale weather details blending into the white icon tile. A dark circular
preview improved clouds but obscured blue raindrops; the owner requested a transparent
alternative. The initial Astro markup and live weather renderer now remove the tile
and apply a subtle 1px slate drop shadow following the icon silhouette through literal
UnoCSS utilities. Icon size, original Meteocons colours, animation and reduced-motion
stills remain; forecast icons are unchanged.

Reviewed local upstream `f1e0820918c926396e0ccafb4839568825f63edc`,
`dashboard/js/views/home.js`, `dashboard/css/views/home.css` and its MIT license.
Retained the current/forecast hierarchy as a reference; the coloured Meteocons and shadow
are an independent Dayframe treatment rather than upstream's ink-coloured SVGs.
No upstream code/assets copied or new dependencies introduced.

Production build, changed-file XO checks and four existing day/night refresh browser
checks (Chromium, Firefox, WebKit and mobile) passed. Visually reviewed a synthetic rainy
1280×800 Large dashboard and six-condition preview (sun, cloud, rain, night, snow and fog)
with reduced motion. Computed styles confirm a transparent background and silhouette
shadow. Desktop evidence does not establish physical Classic 10 readability. No
deployment or device changes.

## Two-calendar Morning and unified CI — 21 October 2026

Owner requested a second shared massage calendar, red Family/violet Massages styling,
more useful bottom space and discreet weather notes. Existing Google authorization can
read both calendars (owner confirmed sharing). Admin settings now select Family and an
optional distinct massage calendar from Google's verified list, using the same encrypted
connection and existing authentication, cache invalidation and revision checks. Existing
single-calendar state remains Family without a migration. Each calendar independently
supplies up to three events; descriptions, locations and attendees remain excluded.

The wider lower-right panel has one chronological list beside weather advice on the
left. At the owner’s request, separate calendar columns were replaced with mixed events,
red/violet times and a small source legend. All-day entries come first, then events
from both sources sort by start time. Text retains adjustable rem sizes on mobile too.
Desktop navigation overlays on demand instead of reserving a blank row; attribution and
methodology links remain accessible in a quiet 10px footer. A first full-width stacked
arrangement overflowed Large mode and was replaced before acceptance. The final synthetic
[six-event 1280×800 preview](evidence/m7/two-calendars-1280x800.png) has no scrolling.

Re-inspected local upstream `f1e0820918c926396e0ccafb4839568825f63edc`, root `LICENSE`
(MIT, Copyright 2026 Wes Bos), `dashboard/js/views/home.js` (three-event person lanes)
and `dashboard/js/views/calendar.js` (coloured lanes). Adapted the idea of separate,
colour-labelled event groups; independently implemented two private Google selections
and the Astro/UnoCSS layout. No upstream code/assets copied, new dependency, service,
Google scope, hardware/native change, paid resource or billing change.

Consolidated `.github/workflows/ci.yml` and the removed `deploy.yml` into one `Checks`
workflow retaining the `checks` job name. A separate `deploy` job needs successful checks
and runs only for pushes to `refs/heads/main`. It restores the same run's verified static
assets, checks out the same commit and bundles the tested Worker source; it does not
repeat verification/browser installation. Production environment, Free-plan gate,
step-scoped credentials, public smoke check and non-cancelling production concurrency
remain. Check cancellation is job-scoped to avoid interrupting active deployments.
Manual dispatch now checks only; retry deployment by re-running the original push run.
[GitHub workflow semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)
reviewed; YAML parsing and the checks→deploy dependency passed locally. Hosted Actions
and live deployment remain unverified for this change.

Validation: all 109 unit/integration tests, types and production build passed. Eleven
focused Chromium calendar/density/Morning cases passed, including six-event frame fit,
long freezing-weather labels, all-day/ongoing events, escaped titles, both-calendar admin
selection and privacy clearing. The initial full `pnpm verify` passed 156 browser cases
with four existing skips. After the owner’s combined-list refinement, all 109 unit tests
passed again, as did 40 affected calendar/density/Morning browser cases across Chromium,
Firefox, WebKit and mobile, with four existing skips. Updated types/build and changed-file
XO passed. Final synthetic six-event capture measures exactly 1280×800 without overflow.
Existing five complexity warnings remain
(the extended calendar router's count increased); no lint errors. No deployment or live
massage selection has been performed; physical readability remains owner acceptance.

### Pastel calendar rows — 21 October 2026

Owner requested larger colour cues and normal text colour for household readability.
The merged chronological list now uses full-row pastel rose (`#f5dadd`) for Family and
lavender (`#e8def5`) for Massages, with dark `#182c35` times/titles and a visible calendar
name on every row. The owner requested dropping the now-redundant header legend. Per-row labels remain
available even when the colours are indistinguishable. Row height and event limits are
unchanged; titles retain truncation and full source/title tooltips.

Revisited upstream `dashboard/js/views/home.js` event lanes and MIT license at local
`f1e0820918c926396e0ccafb4839568825f63edc`. This is independently authored row styling;
no source/assets copied. No calendar connection, data, permission, service or device
change. Production build and changed-file XO passed. All eight calendar browser cases passed
across Chromium, Firefox, WebKit and mobile, including privacy clearing and six-event
frame fit after a 1px Firefox overflow was corrected with a slightly smaller row gap.
Dark text contrast calculates to 11.00:1 on rose and 11.17:1 on lavender. The synthetic
preview is 1280×800 with no scrolling; physical household readability is not established
by those checks. The subsequent legend removal reduces content height; build and the
preview were refreshed. No deployment or live selection change.

### Production acceptance — 21 October 2026

Owner approved commit/push and subsequent live massage-calendar selection. Pushed
`dbfc7199586cef7a6b243949c0700729e1514b64` to `main`. Unified Actions run
[39570330885](https://github.com/codyzu/dayframe/actions/runs/39570330885) passed both
`checks` and `deploy`, including the verified-assets handoff, Workers Free assertion,
Cloudflare upload and matching-build public smoke check. Hosted verification passed
109 unit/integration tests and the complete browser pipeline.

After deployment, used the authenticated production calendar settings to retain Family
and select the existing shared massage agenda through the existing Google grant. Save
confirmation and a subsequent full page reload verified both persisted selections.
Authenticated Morning loaded the merged agenda successfully; no remaining massage
appointments were displayed at acceptance time. No actual appointment title, calendar
ID, token or private screenshot is included in this public record. The live confirmation
screenshot remains temporary and private. No new OAuth consent, permission expansion,
service/billing change, device interaction or physical-frame acceptance is claimed.

## Photos current conditions — 21 October 2026

Owner requested current conditions alongside the Photos clock/temperature. Combined a
small Meteocons icon, rounded outdoor temperature and French condition in one row under
the clock. Icons follow the shared WMO/day-night mapping, using bundled still artwork
to keep the photo overlay calm. Existing weather service/cache supplies updates even
when Morning is hidden; failed/stale cached data gets a discreet “Dernier relevé” label,
and absent data shows “—° · Météo indisponible”. Changed-value guards avoid repeated
text/icon writes. Long descriptions wrap within the viewport.

Re-inspected local upstream `f1e0820918c926396e0ccafb4839568825f63edc`, root MIT
`LICENSE`, `dashboard/js/views/photos.js`, `dashboard/css/views/photos.css` and
`dashboard/js/views/home.js`. Retained fullscreen-photo priority and compact weather
hierarchy as ideas; the live weather overlay is an independently authored Dayframe
addition. No upstream source/assets copied, dependencies, services or device changes.

Type checks, production build and changed-file XO passed. Browser validation covers
existing clock/scheduling behavior plus Photos-only refresh, night icon selection,
long freezing-condition labels without horizontal overflow, cached data after network
failure and unavailable-data fallback. Reviewed the synthetic [1280×800 overlay
preview](evidence/m5/photos-weather-1280x800.png), using the empty photo state and fixture
weather; it contains no household photos. Deployment and physical-frame readability
remain unverified for this slice.

All eight focused browser cases passed across Chromium, Firefox, WebKit and mobile.
The first refresh test simulated every second of an hour and exceeded WebKit's test
budget; advancing directly to each refresh deadline preserves the refresh/outage checks
and passes across all four browsers.

## Day-specific planning and official days off — 21 October 2026

Owner requested different Wednesday routines, weekends starting at 08:00 and automatic
school-vacation/public-holiday awareness for Annecy. Confirmed skipping habitual
activities during vacations/holidays and Morning 08:00–11:00 on days off. The later
request places holidays/vacations in the upcoming-appointments panel alongside Google
events. Household names/routines remain private; the proposed household settings patch
is in ignored owner-only storage and has not been applied to production.

Added optional validated private day schedules and four weather checkpoints per profile,
admin editing, the existing schedule/DST/override behavior with day-off precedence,
minute interpolation, an authenticated official-calendar endpoint, bounded fixed-host
Ministry/DINUM reads, and daily dated caching in the existing Administration object.
The appointment panel can show both a holiday and a vacation without reducing the six
Google-event allowance. Existing settings retain their daily schedule until configured.
[Behavior, source research, security, cost and limits](day-planning.md).

Reviewed upstream root MIT license and `dashboard/js/views/{home,calendar}.js`,
`dashboard/js/system.js` at `f1e0820918c926396e0ccafb4839568825f63edc`; retain its
glanceable daily hierarchy while independently implementing private routines and real
French calendars. No source/assets copied, dependency/binding added, paid resource,
Google permission/event write, deployment or device change.

Owner clarified that activities remain in Family calendar: only the four weather
summary times vary on Wednesdays. Neutral private labels accompany the requested
times. No duplicate activity list or checkpoint durations.

Final `pnpm verify` passed: Astro/Worker types, lint with the five existing complexity
warning locations (no new warning locations), 120 unit/integration tests, production
build and 172 browser tests across Chromium, Firefox, WebKit and mobile, with four
existing intentional skips. New cases cover private profile editing/persistence,
quarter-hour weather, escaped labels, day-off/DST/override precedence, both official
observances beside six appointments, outage continuity, exclusive vacation end dates,
year rollover, authentication/network/mutation denial, bounded daily caching and
redirect/malformed-provider rejection. The first busy-layout test found 22px overflow;
conditional spacing fixed it, followed by a further Firefox 1px correction. Reviewed
the final [synthetic Firefox frame](evidence/m5/day-off-1280x800.png), with no scrolling.
The downloaded live Ministry JSON query returned 14 rows for the current/previous
academic years and normalized to 12 pupil periods; the public holiday JSON also loaded.
The Ministry's documented Zone A iCal download was subsequently confirmed outside the
network sandbox, correcting the initial in-sandbox DNS failure; JSON remains the simpler
application integration of the same official source. The private settings patch passes shared validation and is ignored by Git. Changed
Markdown links and `git diff --check` pass. No deployment, household settings update,
Google change or device interaction. Existing hardware, second-administrator and
long-term calendar-token acceptance limits remain.

### Hosted mobile administration correction — 21 October 2026

Owner authorized commit/push and production verification. Feature commit `9365177`
was pushed to `main`. [Actions run 39657467166](https://github.com/codyzu/dayframe/actions/runs/39657467166)
passed types, lint, all 120 unit/integration tests, build and 171 browser cases, but
Linux WebKit's mobile administration check detected horizontal overflow. Deployment
was correctly skipped, preserving the previous production version. Downloaded the
synthetic failure screenshot; no household evidence was involved.

Constrained the new day-profile selector and its fieldset to the available width,
shortened the option to « Jours de repos » (the adjacent description explains which
days it covers), and clarified that only forecast times change while activities stay
in Family calendar. Added a populated-editor overflow check at 320px with diagnostics
for any offending node. This is a narrow responsive correction; schedule/privacy/API
behavior, dependencies, hardware and household settings are unchanged. The existing
upstream source/license review above retains its scope. The corrected commit must
pass the same hosted checks and deployment smoke gates; no deployment bypass.

Correction validation: changed-file XO, Astro/Worker types and production build passed;
all 20 affected administration/day-planning browser cases passed across Chromium,
Firefox, WebKit and mobile, including the new populated 320px editor check. The
120 unit/integration tests had passed in the hosted run; this correction changes only
markup/copy and browser coverage. Hosted Linux acceptance and automatic deployment
remain gated by the corrected commit's ordinary Actions run.

## Night copy, Morning vigilance and Photos readability — 21 October 2026

Owner requested removing the Night brightness implementation note, official weather
alerts on Morning, use of the empty bottom navigation strip, and larger Photos
clock/weather/icon. Removed the Night sentence. Added independently fetched
Météo-France vigilance via Meteoalarm's public France feed, a severity-coloured
Haute-Savoie banner with validity/issue times and expandable details, original-source
links, and distinct clear/unavailable/stale/unsupported-location behavior. The strongest
warning leads; all matching warnings remain available. [Source, attribution, caching,
coverage and cost limits](weather.md#official-vigilance--21-october-2026).

The Morning weather grid now assigns its four rows explicitly and lets the advice/
appointments row grow to the bottom metadata. Navigation remains overlaid and does
not move the cards when it disappears. When warnings are present, decorative branding
and spacing give way to the banner; forecast icon spacing tightens before primary
weather/calendar text. Unknown vigilance is a small neutral notice. The expanded
source details overlay rather than pushing appointments off the frame. Only visible
navigation controls receive pointer input, keeping bottom source links usable when
the floating menu appears. Photos now uses a 96px desktop clock (72px mobile), 80px icon (64px mobile), 36px temperature
(30px mobile) and 24px condition (20px mobile), preserving bundled still icons and
wrapping long descriptions. These are default rem-derived sizes, not fixed device
brightness or native changes.

Re-inspected the local Wes Bos source at
`f1e0820918c926396e0ccafb4839568825f63edc`, root MIT `LICENSE`,
`dashboard/js/views/home.js`, `dashboard/css/views/home.css`,
`dashboard/js/views/photos.js` and `dashboard/css/views/photos.css`. Retain its
glanceable weather/event hierarchy and photo priority as ideas. Official French warning fetching, namespace-aware parsing, protected-data
separation, Astro layout and larger photo overlay are independently authored;
no upstream source/assets copied. No dependency, new binding, paid service, household
settings/credentials, deployment or device change.

Final `pnpm verify` passed: Astro/Worker types, lint with the five existing
complexity warnings, all 126 unit/integration tests, production build and 188 browser
checks across Chromium, Firefox, WebKit and mobile, with four existing intentional
skips. Coverage includes fixed-host/redirect/body-limit/cache behavior, warning
severity/department/expiry/staleness, offline recovery, frame fit with six appointments
plus holiday/vacation, stable card geometry as navigation hides, source-link access,
Night copy and long-condition Photos sizing. Ordinary browser checks now stub the
national feed through a shared fixture instead of depending on live warnings.

Reviewed synthetic [expanded Morning](evidence/vigilance/morning-expanded-1280x800.png),
[warning banner](evidence/vigilance/morning-alert-1280x800.png),
[six-event Firefox frame](evidence/vigilance/morning-six-events-firefox.png),
[holiday/vacation with alerts](evidence/vigilance/morning-holiday-alert-firefox.png),
[larger Photos overlay](evidence/vigilance/photos-large-1280x800.png) (empty photo state),
and [Night](evidence/vigilance/night-1280x800.png). Captures are 1280×800 without
scrolling and contain no household events or photos. Deployment and physical-frame
readability remain unverified for this slice. Existing security and household-
administrator acceptance limits remain open.

### Production vigilance negotiation correction

Owner authorized commit, push and deployment. Feature commit `5b603ca` passed
[Actions run 39677427770](https://github.com/codyzu/dayframe/actions/runs/39677427770)
and deployed, including the Free-plan gate and public privacy/build smoke checks.
The served HTML matches the exact GitHub production-assets artifact (local macOS
and hosted Linux bundle hashes differ). Independent live validation caught a 503
from the new warning endpoint; the UI correctly presented unavailable vigilance.

A temporary Cloudflare remote preview without private bindings isolated the cause:
the feed publisher returns HTTP 406 for explicit Atom **and** XML Accept headers,
while `Accept: */*` returns HTTP 200 Atom XML from the same Workers runtime. The
adapter now negotiates generically and retains strict content-type, body-size,
redirect and namespace/schema validation. The regression check asserts this
external-request contract. No provider switch, secret, dependency, service binding,
paid resource, settings or device change. Corrected deployment/live acceptance is
recorded after the ordinary workflow succeeds; no check bypass.

The negotiation correction `76e9c6a` passed [Actions run
39678963131](https://github.com/codyzu/dayframe/actions/runs/39678963131), deployed
and returned HTTP 200 Atom XML with the expected two-minute cache headers. Live
inspection also exposed a freshness assumption: the canonical feed retained its
21:05 publication timestamp at 21:36 despite a successful current fetch. Treating
publication age as retrieval age made a valid unchanged snapshot unavailable for
most of the hour. The browser now tracks both: ten minutes without successful
retrieval expires cached vigilance, while a publication older than two hours or
more than five minutes ahead is rejected independently. CAP expiry and original
issue-time display remain unchanged. A browser regression covers a thirty-minute-
old, freshly retrieved snapshot and subsequent ten-minute outage expiry. This
correction changes no provider, permissions, service, settings or device behavior.

## Approved heavier Morning typography — 22 October 2026

Implemented the owner's approved heavier-font preview as a small extension of the
existing Morning UI. Morning inherits Manrope Bold (700), including weather details,
checkpoint labels, chart times, advice and agenda text. Its clock uses Semibold (600);
explicit previously semibold headings, temperature, rain labels and calendar source
labels use Bold. Existing bundled font faces, text sizes, density preference and
layout remain. Literal UnoCSS utilities and the existing clock shortcut implement
the change without additional CSS, dependencies or services.

Re-read the local specification and upstream foundation requirements; inspected
`dashboard/css/tokens.css`, `dashboard/css/views/home.css` and `LICENSE` in the
reviewed upstream checkout at `f1e0820918c926396e0ccafb4839568825f63edc`.
Retain its glanceable clock/weather hierarchy as an idea; deliberately retain
Dayframe's Manrope and responsive density system instead of upstream's Archivo/
Instrument Serif and fixed-size typography. The upstream MIT notice was checked;
no upstream code or assets copied.

[Reviewed synthetic implementation preview](evidence/typography/morning-heavier-1280x800.png)
matches the approved appearance and fits 1280 × 800 without scrolling. No private
calendar entries or photos are in this evidence. Validation results follow below.
Physical readability at the family's viewing distance remains an owner check;
this source change does not claim device acceptance or production deployment.

Validation passed: `pnpm check`, `pnpm lint` (five existing complexity warnings),
`pnpm build`, and focused Playwright Morning/density/vigilance/calendar suites:
60 passed, four existing intentional skips across Chromium, Firefox, WebKit and
mobile. Coverage includes both frame densities, mobile reflow, long conditions,
0/65/100% rain labels, six appointments with warnings, and unavailable/stale states.
`git diff --check` passed. Full unrelated suites were not repeated for this
presentation-only change; no deployment or device action was performed.

## Native weather templates — 22 October 2026

Owner selected Astro components, native HTML templates and browser TypeScript rather
than introducing React. `WeatherCheckpoints.astro` owns the repeated card template;
`WeatherChart.astro` owns the permanent SVG/chart shell and templates for rain bars,
time labels and accessible hourly rows. UnoCSS utilities remain literal in Astro,
including responsive time labels and peak/now-label placement. No custom CSS added;
data-dependent SVG coordinates and label offsets are set by the renderer.

`forecast-view.ts` clones templates with `document.importNode`, fills text with
`textContent` and sets attributes directly. An SVG wrapper in the rain-bar template
preserves the SVG namespace. Pure chart geometry lives in `chart.ts`. The weather
controller retains service/cache/retry behavior, private routine clearing, inactive
mode suspension and minute-level rendering guards. Chart paths now update in place
across successful refreshes. No weather HTML strings, manual HTML escaping or
`innerHTML` assignments remain in these renderers. Removed the weather controller
from UnoCSS's explicit TypeScript extraction list; condition/icon mappings remain.

Re-inspected the upstream checkout at `f1e0820918c926396e0ccafb4839568825f63edc`,
root MIT `LICENSE` and `dashboard/js/views/home.js`. Retain the glanceable weather
hierarchy and selective updates as ideas; deliberately replace string-based markup
with independently authored Astro templates. No upstream code/assets copied,
dependency/service/billing change, deployment or device action.

Validation passed: Astro/Worker type checks, production build, XO (the five
existing complexity warnings only), all 126 unit/integration tests and 116 distinct
affected browser checks across Chromium, Firefox, WebKit and mobile, with four
existing intentional skips. Browser coverage includes SVG namespace correctness,
repeated refreshes without duplicate cards/bars/table rows, updates to persistent
chart paths, escaped private labels, exhausted cached forecasts hiding/recovering
into the same shell, warning banners and mode switching. Reviewed synthetic
1280×800 standard and Firefox warning/six-event captures: layout and frame fit are
preserved. `git diff --check` passed. Physical Firefox/GeckoView 143 acceptance
remains a separate device check; this change is not deployed.

## Photo upload result template — 22 October 2026

Owner requested committing the completed weather-template slice first, then applying
the same conventions to upload result rows and committing/pushing/deploying the
result. Weather refactor committed as `33af469` before this slice.

The photo administration page now owns a native result-row template containing the
message and an initially hidden retry button, styled with literal UnoCSS utilities.
Each selected file clones one row with `document.importNode` and receives one retry
handler. Preparation, success, failure and waiting-for-reconnection update its text
and button visibility in place. This removes the two duplicated retry-button
construction paths and preserves the selected file, sequential processing,
reauthorization, duplicate review and upload identity across retries. No custom CSS,
dependency, API/authentication, photo retention or billing change.

Re-read the photo specification/M3 acceptance gates and inspected upstream
`dashboard/js/views/photos.js` and root MIT `LICENSE` at
`f1e0820918c926396e0ccafb4839568825f63edc`. Its slideshow controls do not implement
Dayframe's private upload-result workflow; this template is independently authored,
with no upstream source/assets copied.

Full browser verification also caught a scope regression from the weather
component extraction: checkpoint icons had lost their still-SVG override. Moved
that existing SVG-specific rule into `WeatherCheckpoints.astro`, where cloned nodes
retain its Astro scope. Warning-specific icon sizing and chart spacing now use
literal group-data/responsive UnoCSS utilities in their owning components instead
of parent-scoped selectors that cannot reach extracted markup.

Validation: types, lint (five existing complexity warnings only), all 126
unit/integration tests and production build passed. The full browser run passed
192 cases with four intentional skips and identified the four engine variants of
the checkpoint-animation regression above. After the correction, all 84 affected
foundation/Morning/warning/density cases passed, with four intentional skips.
Coverage includes repeated failed retries into the same row/button, literal
markup-like filenames and expired-session batch recovery. Reviewed synthetic
photo-administration and weather captures; `git diff --check` passed. Production
deployment uses the normal main-branch Checks workflow, verified-assets handoff,
Workers Free gate and live build/privacy smoke checks. No device action performed.

## M5.O2 — Persistent photos, 22 October 2026

Implemented `src/lib/photos/offline.ts` as the shared schema-1 IndexedDB store,
with the accepted seven-day lease, 100-photo/100,000,000-byte bounds, atomic
metadata/encoded-byte writes, complete-catalog deletion reconciliation, and
local-only eviction. The live slideshow saves its bounded shuffled subset gradually
through its existing sequential current/next fetches. It reuses encoded copies,
rotates them on network failure, and can return to Photos offline after a mode
change. It retains at most current/next decoded images and releases them on hide/
mode/page exit. No public HTML, settings, weather or calendar response is precached.

A frame URL exposes **Photos hors connexion**, requiring a separate explicit opt-in.
Storage persistence is requested/reported without blocking synchronization on a
permission prompt. The store persists only photo display fields, encoded bytes,
lease evidence and fit/interval. Invalidations fence pending writes synchronously,
clear loaded display/admin photos across tabs and retry failed deletion. Private-API
denial, frame/Access logout, reprovisioning, disablement, expiry and backward-clock
states fail closed. Admin generation guards also stop in-flight results from
restoring photos after local invalidation. The five-minute non-opted-in baseline
remains. Updated photo/admin operations and historical ADR behavior notes.

Re-read the local specification and M5/O1 gates; re-inspected the saved Wes Bos
checkout at `f1e0820918c926396e0ccafb4839568825f63edc`, root MIT `LICENSE`,
`dashboard/js/slideshow.js` and `dashboard/js/views/photos.js`. Retain fullscreen
priority, shuffle and explicit start/stop lifecycle as ideas; independently implement
authenticated durable storage and lease/invalidation. No upstream code/assets copied,
new dependencies, service/binding, billing, deployment or hardware changes. This is
a pinned local review, not a claim of current upstream HEAD.

Browser testing found Firefox storage permission requests can remain pending; the
request now runs independently of saving/playback. The local WebKit runtime rejected
IndexedDB Blob preparation; the shared store therefore writes WebP ArrayBuffers and
reconstructs one Blob at a time. Neither workaround expands decoded-image retention.
The first expiry test used a deadline a few milliseconds before the actual last
verification; browser coverage now advances beyond it, and a pure test checks the
exact seven-day boundary. An unrelated existing Markdown table formatting error in
`docs/weather-freshness.md` was normalized to allow the repository lint gate.

Validation and synthetic visual evidence are recorded after the final checks below.
O3 standalone fallback, O4 navigation interception and O5 actual GeckoView/native
integration remain open. No offline reload/cold-start or physical-frame acceptance
is claimed. Existing M4/M6/security/soak deferrals remain.

Final O2 validation passed: Astro/Worker types, production build, XO with four
existing complexity warnings and no errors, and all 128 unit/integration tests.
The full browser suite passed 240 checks with four existing intentional skips.
After adding an independent store expiry timer that survives pagehide, the final
48-case offline suite passed across Chromium, Firefox, WebKit and mobile. It covers
opt-in, gradual rotation/two-URL bounds, mode return, count/byte limits, metadata
projection, stale-write fencing, expiry/backward clocks across page restarts,
401/403/frame logout/reprovisioning across open tabs, Access logout, complete versus
partial pagination, transaction interruption/quota, unavailable/evicted storage,
corrupt images, cleanup failure/retry and expiry while display polling is paused.
The cross-tab fixture originally reinstalled the browser-context clock when opening
a second page, causing a real backward-clock denial; it now uses the single shared
clock, preserving the production clock checks.

Reviewed [synthetic Firefox frame](evidence/m5-o2/frame-firefox.png) and
[mobile WebKit controls](evidence/m5-o2/mobile-webkit.png); no household data is in
these captures. `git diff --check` and changed documentation link checks passed.
No deployment, service worker, device action or cold-start claim. M5.O2 is complete
as a local software slice; O3–O5 and the existing physical/security/soak gates remain.

## Automatic authorized-browser photo retention — 22 October 2026

Owner approved removing the opt-in and retaining photos in all authorized browsers,
including signed-in administrators. This supersedes the original explicit-enable
policy and the subsequent frame-only proposal. The private API already governs
access; the deployed API and its authorization rules remain unchanged. The live
Photos slideshow automatically initializes/reuses the store after a complete valid
catalog read, then saves its bounded shuffled subset as individual authorized
images arrive. No frame URL check, role field, role lookup or eligibility UI remains.
Ordinary `/` visits and administrator dashboards use the same behavior as frames.
Existing valid opt-in collections are compatible without a schema migration.

Removed the checkbox, expandable opt-in panel and its explanatory copy. A small
read-only storage status remains in the existing transient photo controls. Preserved
seven-day leases, 100-photo/100,000,000-byte limits, two decoded images, photo API
protection, logout/denial/reprovisioning clearing and deletion/quota/clock handling.
New automatic initialization is fenced against authorization that began before
local invalidation. The invalidation token remains stable when a valid collection
starts and rotates only on denial/clearing; another tab's successful initialization
does not clear current photos or admin previews. Administration does not purge an
otherwise valid collection; its own preview memory limits remain unchanged.

Re-read the local specification, M5 plan and ADR 0009. Re-inspected the pinned Wes
Bos checkout at `f1e0820918c926396e0ccafb4839568825f63edc`, root MIT `LICENSE`,
`dashboard/js/slideshow.js` and `dashboard/js/views/photos.js`. Retain fullscreen,
shuffle and explicit lifecycle ideas; authenticated browser persistence is authored
independently. No upstream source/assets copied. No new API request, dependency,
service, binding, paid resource, service worker or hardware action.

The preceding M5.O2 commit `bd92a72` deployed through [Checks run 39782350377](https://github.com/codyzu/dayframe/actions/runs/39782350377),
passing 128 unit/integration tests, 244 browser checks (four intentional skips),
the Workers Free gate, verified-build/privacy smoke checks and an independent live
anonymous-browser check. The revision in this section follows the same ordinary
main-push workflow; deployment and its final validation are reported after completion.
O3/O4 offline cold navigation and O5 device integration remain separate.

Validation passed: Astro/Worker types, production build, XO (the same four existing
complexity warnings), all 128 unit/integration tests, and the full browser suite:
268 passed with four existing intentional skips across Chromium, Firefox, WebKit
and mobile. Added actual authenticated-admin/API coverage at `/`, ordinary/frame
URL parity, anonymous denial, preservation of existing copies through admin visits,
automatic restoration after invalidation, pending-grant fencing and initialization
across open tabs. Existing seven-day/size/quota/clock/deletion/privacy checks remain.
Two initial test assumptions needed updating: a five-minute manual mode override
hid Photos during an age check, and an old assertion forbade the now-required local
control record. The corrected checks isolate retention from scheduling and permit
only the existing non-image control metadata.

Visual review caught new storage-status text crowding the retry button. Constrained
the existing control width and moved the Photos-only retry position below it.
All 68 focused offline browser cases passed after that presentation correction,
including explicit overlap/viewport assertions. Reviewed synthetic
[Firefox](evidence/m5-o2/automatic-firefox.png) and
[mobile](evidence/m5-o2/automatic-mobile.png) captures; no household data is present.
Changed documentation links and `git diff --check` passed. The owner authorized
commit/push and the ordinary production workflow; no device action or cold-start
acceptance is included in this slice.

## M5.O3 — Standalone offline document, 22 October 2026

Implemented a build-generated `offline.html`, with the existing schema-1 photo
store bundled into its inline script. No external runtime asset, full-dashboard
cache, private build content or offline weather/calendar/schedule is included.
Exact script/style hashes form its CSP; contain/cover uses a data attribute rather
than inline style permissions. Its small independent stylesheet intentionally
avoids the live application's reset, fonts and component styles. The esbuild
version already used by the toolchain is now an explicit pinned build dependency.

The document plays saved photos at all hours under the same seven-day lease,
checks clock/retention before display, skips corrupt images with a bounded decode,
retains at most current/next decoded images, and releases them on hide/page exit or
cross-tab invalidation. It restores fit/interval without saving household schedules.
Empty, expired and unavailable storage provide a useful retry state. Same-origin
health checks validate JSON, reject redirects/portals, time out after five seconds
and back off from 15 seconds to five minutes. Successful reachability can return to
the original URL, with a session deadline bounding repeated partial-startup returns;
health never renews private access. O4 supplies actual navigation interception.

Re-read the specification/ADR and inspected the pinned Wes Bos checkout at
`f1e0820918c926396e0ccafb4839568825f63edc`, root MIT `LICENSE`,
`dashboard/js/slideshow.js` and `dashboard/js/views/photos.js`. Preserve fullscreen
priority and explicit slideshow lifecycle as ideas; independently author the
self-contained authenticated-store fallback. No upstream code/assets copied.

Validation: standalone browser fixtures block all networking after delivering the
public document (local blob URLs remain usable). All 20 checks passed across
Chromium, Firefox, WebKit and mobile WebKit: ten simulated overnight hours,
rotation/fit/interval, two-URL bounds, expiry, missing/unavailable storage, corrupt
images, cross-tab denial, validated recovery/backoff and bounded return attempts.
A generated-document test verifies exact CSP hashes, absence of external runtime
references/private metadata, and the shared schema. Reviewed synthetic
[Firefox](evidence/m5-o3/standalone-firefox.png) and
[mobile](evidence/m5-o3/standalone-mobile.png) captures. Fast-forwarded time waits
for native decoding between advances; executing virtual hours during a native
image decode otherwise creates artificial decode timeouts. No physical overnight,
deployment, navigation interception or device acceptance is claimed in O3.

## M5.O4 — Navigation and deployment recovery, 22 October 2026

Implemented stable `/sw.js`, exact root/query navigation allowlisting, a five-second
network-first deadline including response bodies, and fallback-only Cache Storage.
HTTP/auth failures and redirects retain normal handling; assets/private APIs and
version checks are excluded. A fallback content hash binds install to the complete
matching public document. Successful installs activate/claim and retire old fallback
caches; failed installs preserve the active version and schema-1 photos. A retirement
build and local retirement message remove only fallback caches and unregister.

An independent inline startup guard covers successful HTML with failed critical
modules. It receives the installed public document over a message port and replaces
the failed document at the same URL. This narrow, documented trusted-document write
is required to execute its hash-authorized script without a forbidden kiosk path.
It does not introduce HTML-string rendering into weather/admin components. Health
and version checks never renew private photo leases. Partial-load return deadlines
persist exponential backoff across navigations; successful startup resets it.

Build-matched public version metadata supports startup/thirty-minute/connectivity
checks with one in-flight request. A new ID queues one reload at a Photos transition
or after the current render in other modes. Its persisted attempted target prevents
stale-page reload loops. Only an unexpired override's remaining lifetime transfers
through session storage; existing density/fit/auth/photo retention remains intact.
Admin/setup pages do not auto-reload. Resume restarts version checks.

Activation remains disabled in ordinary builds pending O5's native recovery work.
`pnpm verify` tests that ordinary artifact, then saves it while a separately enabled
build runs `playwright.offline.config.ts`; `finally` restores the exact original
`dist` for the existing CI artifact handoff. No enabled-worker build is uploaded by
this verification. Worker DOM typing has a separate TypeScript configuration;
ordinary browser and Workers API declarations stay separate.

Re-read the specification, offline phases and ADR 0009. Re-inspected pinned upstream
`f1e0820918c926396e0ccafb4839568825f63edc`, MIT `LICENSE`,
`dashboard/js/slideshow.js` and `dashboard/js/views/photos.js`. Its fullscreen and
lifecycle ideas remain; the fallback/store/navigation/update implementation is
independently authored. No upstream source/assets copied, new runtime dependency,
service/binding/billing change, push, deployment or hardware action. O5 and prior
physical/security/soak deferrals remain open. Final verification evidence follows.

Acceptance refinements: the standalone overnight fixture now waits for each newly
decoded image before advancing another virtual hour. Visibility alone could observe
the previous image and race the bounded decoder timeout. It also checks the full
saved 5–3600-second interval contract; the initial fallback's five-minute clamp was
corrected to match validated live settings. Connectivity recovery can itself advance
the live slideshow, so the update test observes real response → transition → unload
ordering instead of assuming no slide advances during an online event. No test-only
hooks or diagnostic logging are included in the production application.

The final lifecycle audit also exposed a pending-image gap: rapid hide/show could
outlive a native decode. The fallback now owns and cancels the pending image as
well as the displayed image, fences concurrent playback runs, and ignores cancelled
results without deleting valid copies. A delayed-decode/rapid-visibility browser
case checks immediate URL release, the two-image limit and preservation of all
three synthetic stored photos after the old decode timeouts. Session-storage denial
now permits a healthy manual return while preventing unfenced automatic reloads.

Final validation: `pnpm verify` passed Astro/Workers/service-worker types, XO,
all 131 unit/integration tests, production build, 300 ordinary browser checks
(with four existing intentional skips), and all 44 enabled-worker checks across
Chromium, Firefox, WebKit and mobile WebKit. A subsequent small fullscreen correction
sets images to block layout: direct measurement found a four-pixel inline baseline
at 1280×800 and mobile. The final generation check also runs after the last async
lease read before committing a decoded image. Regenerated CSP/build checks, eight
focused fullscreen/default-build cases, and all 28 final standalone cases passed
after these corrections. The storage-denial fixture waits for native IndexedDB
initialization before advancing its clock, so a late empty-state render cannot
race the recovery assertion. Final lint retains only the four existing complexity
warnings; the trusted-document write has its documented deprecation hint.

Reviewed synthetic Firefox/mobile evidence from O3; final tests assert no scrolling
at both frame and mobile viewports. No household data is in the evidence. Changed
local documentation links and `git diff --check` passed. An independent byte-for-byte
check confirmed ordinary assets were restored after a failed enabled trial; final
ordinary-build browser checks confirm matching build metadata and no registration.
M5.O3/O4 are complete as local software slices. Navigation/update activation remains
explicitly gated pending O5; no push, deployment or device action occurred.

## M5.O5 — Host integration and candidate preparation, 23 October 2026

Owner requested completing as much of M5.O as possible without intervention.
Implemented offline readiness in the isolated native heartbeat: visible decoded
photos or a rendered empty/expired/unavailable-storage retry screen. The generated
fallback publishes fixed readiness labels; no private metadata enters native
messages. Loading/background/failed decoding cannot count as readiness. Native
loads no longer wait for Android connectivity, allowing the installed worker to
serve the existing permitted HTTPS dashboard URL offline. Missing fallback and
real stalls retain bounded retries, and healthy reconnection does not force a
native reload. Clock/profile, TLS, address, maintenance, permissions and supervisor
protections remain.

Refreshed current upstream HEAD/listings and relevant #228/#216/#201; re-read
kiosk/device/Modern10 notes and MIT license at
`f1e0820918c926396e0ccafb4839568825f63edc`. Retain measured app readiness and clock
research; independently implement Dayframe's authenticated-store integration,
without bundled local serving, portal navigation or accessibility/system changes.
No upstream source/assets copied. [Full provenance and trial](hardware/m5-offline.md).

Read-only existing-transport inspection matched actual Classic10/exdroid/sun8i,
firmware `Classic10_A33M187_20250910-1617_V09`, Android 6.0.1/API 23, ARMv7,
installed native 0.1.4's exact accepted hash, Firefox 143.0.4/helper 0.3.0 and a
plausible clock. No reconnect, input, restart, network or persistent change.
Signed 0.1.5/code 6 candidate and source inventory are prepared privately; independent
full-hash/packaged-probe/source/same-signer checks passed. No installation.

Host verification: 37 Java tests, eight isolated probe tests, 24 Python observer/
fault-safety tests; strict offline dependency build, Android lint (no issues),
ABI/permissions/exports/engine/notices, alignment and API-23 v1/v2/v3 signatures.
The observer accepts an explicit exact-artifact manifest for read-only observation
without changing the old fault pin or inheriting fault acceptance. Type checks,
lint (four existing warnings), all 131 web unit/integration tests and 28 standalone
browser checks passed. Browser tests execute the packaged probe against the real
generated fallback DOM, including virtual overnight playback and empty/expired
retry; Android extension/native callbacks remain unverified.

Navigation verification first exposed a time-dependent fixture error: the generic
calendar 401 correctly invalidated seeded photos during Morning. The fault server
now models a disconnected authorized calendar separately from photo denial. It
also serves synthetic warnings itself rather than evaluating a page while a
controlled reload destroys its execution context. Production privacy logic is
unchanged. The corrected suite passed all 44 navigation/update checks across the
four browser engines. Exact tested enabled web build
`5ab0a6a7-2f8e-4394-9e48-7acbe8d015fd` is staged privately with a per-file hash
manifest under `private/m5-o5-release-20261023/`; an independent hash check passed.
The exact ordinary deployment assets were restored byte-for-byte after the trial.

Remaining O5 acceptance: specifically authorized native install/physical return,
enabled deployment/initial synchronization on the real GeckoView profile,
restart/offline/partial-load and update recovery, storage limits/eviction,
ten-hour offline playback and sustained native stability, plus a separately
approved cold-power case. A clock-reset cold start may correctly wait for time;
an offline process restart does not prove cold-power support. Ordinary deployment
activation stays disabled. No device mutation, push, deployment, outage or overnight
observation occurred. Prior H4/M4/M5/M6/security/48-hour deferrals remain open.

### M5.O5 authorized installation and enabled deployment — 23 October 2026

Owner explicitly authorized kiosk 0.1.5 installation, enabled web deployment and
checks without physical intervention, leaving outage, overnight and cold-power
work for later. Installed full hash/version matched the reviewed 0.1.5/code 6
artifact; retained native preferences, Home, boot/supervision and the prior backup
exception. No firmware/system, permission, network or credential change.

The first enabled upload exposed Workers Static Assets' `/offline.html → /offline`
canonical redirect, which correctly failed the worker's redirect-rejecting install.
Changed its public install fetch to `/offline`, retaining content-hash validation,
redirect rejection and logical cache key `/offline.html`. The fault server now
models that redirect, and production smoke verifies exact canonical fallback,
worker and version assets with bounded propagation retries. All 44 navigation/
update checks passed again; types and 131 web unit/integration tests passed.

Final live build `ae262aaf-c44c-4977-97df-23006ca4d373`, Cloudflare version
`1ff5939e-d73d-4ba4-a85b-9b408f6e4e93`. The earlier `5ab0a6a7` build/deployment
is superseded. Existing Free-plan assertion and bindings retained; no new service,
subscription or secret. Production route/privacy/exact-asset smoke passed. Fresh
online Chromium/Firefox profiles loaded that build with a controlling worker and
exact public-only fallback cache. Actual Classic Settings → independent DK →
ordinary online restart passed in 19.38 seconds with the same supervisor; protected
Photos rendered without key entry in the same healthy main/session afterward.
Native registration, matching public fallback cache and photo IndexedDB were
confirmed using public cache metadata; no private photo/credential database read.
Browser UI reports storage subject to eviction and progressive synchronization.

A main push previously uploaded the ordinary disabled artifact after verification.
Production CI now selects `DAYFRAME_RELEASE_ASSETS=1`: ordinary checks still run
first, and the enabled build is retained only after its own navigation suite passes.
Local/PR default and all failed trials restore the ordinary artifact. Three new
handoff tests pass for default, successful release and failed release paths. Final
release-mode pipeline evidence follows below.

No offline fault, network interruption, overnight collection or cold-power test
ran. Full O5 remains open on those deferred tests plus update/storage/expiry and
physical exact-version maintenance acceptance. Prior H4/M4/M6/security/48-hour
limits remain. [Sanitized rollout, provenance, artifacts and acceptance boundaries](hardware/m5-offline.md).

Final production-handoff gate: `DAYFRAME_RELEASE_ASSETS=1 pnpm verify` passed type
checks, XO (four existing complexity warnings), **134 unit/integration tests**,
production build, **300 ordinary browser passes / four existing skips**, and
**44 enabled navigation/update passes**. Independent inspection confirmed the
exact tested enabled `dist` and matching build metadata were retained for upload.
A first full run found a virtual-clock/native-decode race in an existing WebKit
photo fixture; explicit decode completion waits fixed the test, and its focused
case plus the complete rerun passed. No production photo code changed. Final
actual-frame inspection retained exact 0.1.5, HEALTHY, supervisor, native
configuration, Home and boot/supervision flags. Documentation links, private-artifact
ignore checks and `git diff --check` passed. The owner subsequently authorized
committing and pushing this verified slice. Actual-frame outage/overnight/cold-power
and other explicit acceptance deferrals remain open.

### M5.O5 owner desk observations — 23 October 2026

Owner confirmed physical two-finger maintenance and Settings → independent DK
return, continued saved-photo rotation with Wi-Fi off, one offline app restart
into the standalone slideshow, and immediate full-app recovery after restoring
Wi-Fi without key entry. Text size, mode and next-photo controls passed. Corrected
the desk checklist: no rotation interval control is exposed. Outage and restart
durations were not measured; no host telemetry was collected for these owner
observations. [Detailed evidence and remaining limits](hardware/m5-offline.md#owner-desk-observations--23-october-2026).
Update recovery, destructive storage/expiry/credentials, sustained overnight and
cold-power acceptance remain deferred; full O5 and M6 remain open.

### M5.O5 offline cold-power observation — 23 October 2026

Owner authorized and operated one offline power cycle. Startup remained at the
plausible-clock/profile gate for three minutes measured from the Rootless prompt;
no offline photos appeared. Restoring Wi-Fi and returning through DK recovered
private Photos in about 45 seconds, without reported key entry. Offline cold
photo startup therefore did not pass; network-assisted clock/profile recovery did.
The eviction/progressive synchronization notice remains consistent with the
previously observed storage policy. [Detailed observation](hardware/m5-offline.md#owner-offline-cold-power-observation--23-october-2026).
No clock/security bypass or storage clearing was performed. Overnight, measured
update recovery and destructive storage/expiry/credential checks remain deferred.

### Desk-record CI corrections — 23 October 2026

The documentation push initially failed XO/Prettier because the updated O5 table
needed column alignment. Formatting was corrected and full local lint passed
with the four existing complexity warnings. The next CI run passed types, lint,
all 134 unit/integration tests and build, then exposed a timing race in the
cross-tab offline invalidation browser test (299 passed, one failed, four skipped).
The test now returns focus to the slideshow because the native probe skips hidden
documents, and advances the virtual clock beyond the five-second heartbeat and
its animation-frame readiness sample. Retry state and privacy-clearing assertions
remain intact; production behavior is unchanged. Five repetitions in each of
Chromium, Firefox, WebKit and mobile WebKit passed (20/20). Full CI is rerun on push.

## M7 clipboard import slice — 25 October 2026

Owner confirmed correct PNG batch previews and requested integration. Added staged
clipboard intake to protected photo administration, explicit add confirmation,
count/type/size gates, native paste fallback and reuse of the existing authenticated
uploader, sequential WebP pipeline, duplicate review and retries. Same-tab staging
survives reconnect; access denial clears previews and blocks sending. No new
endpoint/token, helper, server conversion or deployment. Documented delivered-PNG
SHA identity and remaining representative-photo/iPhone rollout gates in
[photo operations](photos.md#clipboard-import--25-october-2026-local-implementation)
and the [feasibility record](ios-share-sheet-feasibility.md).

Upstream refreshed at `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`: README,
`dashboard/js/views/photos.js`, `dashboard/js/slideshow.js`, MIT LICENSE. Mock
slideshow research only; no code/assets copied. The completed diagnostic tunnel
and read-only server were stopped after owner preview confirmation.

Validation: type checks and production build passed; repository lint passed with
four existing complexity warnings. All 134 unit/Worker integration tests passed.
The 72 photo/clipboard browser checks passed across Chromium, Firefox, WebKit and
mobile WebKit. After the final count-lock and sequential 320px thumbnail changes,
all 12 clipboard integration checks passed again, including no upload before
confirmation, exact/similar duplicates, mismatch blocking, ignored HTML and
same-tab session recovery/page-exit cleanup. Reviewed staged mobile screenshot.
No production deployment or real-photo authenticated iPhone import is claimed.

Owner authorized production rollout and old test Shortcut cleanup. Installed
**Dayframe PNG** with the production admin handoff and verified native action/URL
bindings. Release verification is running; deployed release/actual iPhone upload
are not yet claimed. Cleanup of the five retired test Shortcuts is selected but
blocked by automatic approval review pending explicit named deletion confirmation.

### Clipboard release verification follow-up

The complete local `pnpm verify` passed: 134 unit/integration tests, 328 browser
passes with four existing intentional skips, and 44 navigation checks. First
release run [40181128280](https://github.com/codyzu/dayframe/actions/runs/40181128280)
failed only the existing Chromium cross-tab offline-fallback heartbeat assertion
(327 other browser cases passed), so deployment was skipped. The simulated clock
was advanced once before ordinary locator polling, which cannot deliver a later
scheduled heartbeat while paused. The test now verifies foreground/visible retry
UI and advances the clock inside a bounded poll of the real packaged probe.
Readiness/denial assertions remain intact; no application/native code or physical
frame setting changed. The focused case passed all 12 repetitions across four browsers before retrying
the full gated release.

### Clipboard production rollout completed — 25 October 2026

[Release 40182021955](https://github.com/codyzu/dayframe/actions/runs/40182021955)
succeeded for `52ed5f4`: type/lint/build, 134 unit/integration tests, 328 browser
passes with four existing skips, 44 navigation passes, deployment and live smoke.
Worker version `6d164a6a-9c9f-4665-9bf1-219d24b0ab08`, build
`38aa63f5-fe1a-45ce-b009-307186268407`. Independently verified the deployed
clipboard module matches the local build, signed-out admin redirects to Access
with the selected count, and anonymous photo catalog access remains denied.

**Dayframe PNG** is installed and native bindings/destination are verified. After
explicit owner confirmation of the exact five old names and iCloud deletion,
removed the five retired test Shortcuts; native UI/CLI verify only the replacement
Dayframe Shortcut remains. Copies of task test artifacts stay in ignored private
storage. Actual iPhone sync, first authenticated import and representative real
camera/HEIC/HDR acceptance remain owner follow-ups. No helper, new token, server
image conversion, paid service or device configuration was introduced.

## Clipboard large-batch recovery — 25 October 2026

Owner reports the authenticated iPhone flow works. A larger batch (roughly ten
photos) hit a limit, with exact count/40 MiB/100 MB cause unconfirmed because the
old error combined all three. Added precise limit messages and explicit two-photo
clipboard recovery without reselecting in Photos. Recovery preserves the full
Shortcut count (up to 100 source items), reads only the selected pair's image
representations, retains existing per-group guards, previews and confirmation,
and advances only when handed to the normal uploader. Existing failed rows remain
retryable; completed rows release source-retaining retry listeners. No backend,
credential, encoding-quality, service or cost change. Source/clipboard replacement
with identical counts still requires visual review; single-image 40 MiB failures
still require a smaller representation.

Upstream reviewed from the pinned cached `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`
README, MIT LICENSE, `dashboard/js/views/photos.js` and `dashboard/js/slideshow.js`.
Mock slideshow reference only; no upload/clipboard recovery code reused or copied.

Validation: type checks/build and repository lint passed (four existing complexity
warnings), with 134 passing unit/Worker integration tests. All 68 photo browser
cases passed; after the final retry-listener outcome refactor, all 32 focused
clipboard/recovery/retry cases passed across Chromium, Firefox, WebKit and mobile
WebKit. Reviewed the mobile recovery layout. Budget tests inflate Blob.size on
small synthetic images to test guards, not actual 100 MB memory performance.
Production release checks and actual iPhone recovery remain pending.

Release [40193181775](https://github.com/codyzu/dayframe/actions/runs/40193181775)
was blocked by four screenshot-write failures: the new recovery test used a
Mac-only temporary path on Linux. Recovery assertions reached the screenshot
successfully; 336 other cases passed, with four intentional skips. Replaced the
path with Playwright's per-test output directory and reran that complete recovery
case across all four browser projects: four passes. No application behavior
changed in this correction; full release verification must run again.

Recovery release [40194141441](https://github.com/codyzu/dayframe/actions/runs/40194141441)
succeeded for `0d8413d`: 134 unit/integration, 340 browser passes with four existing
skips, 44 navigation checks, deployment and live smoke. Worker version
`0b545288-2ab3-448d-bd7d-655079bc649a`, build
`1695d7c8-4818-4ece-8b84-c4e6fef03395`. Independently verified deployed recovery
asset equality, admin sign-in with selected-count preservation and anonymous
catalog denial. The owner confirmed the old error listed all limits, leaving its
exact cause unconfirmed. No Shortcut reinstall is needed; physical iPhone
small-group recovery and individually oversized-image handling remain open.

## Adaptive clipboard recovery groups — 25 October 2026

Owner requested trying groups based on total encoded size instead of fixed pairs.
Recovery now takes the next consecutive photos in original clipboard order, up to
ten images and 100,000,000 bytes per group. A single encoded lookahead may be read
to find the boundary, then excluded without advancing the cursor past it. The
staged range and size are visible; preview and Add confirmation remain required.
The button and native manual paste share the policy. Individual oversized or
unsupported items are deferred after a valid prefix and reported when first;
there is no silent skip or reordering. Existing source-count checks, per-image
40 MiB cap, auth, retry behavior and quality/fingerprints are retained. No Shortcut
change, new endpoint/service or cost. Actual peak memory is not benchmarked.

Read local spec upload constraints and upstream foundation sequencing. Re-reviewed
cached upstream README/MIT LICENSE/photo view/slideshow at
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`; no relevant uploader/grouping code
exists there and none is copied. Independent change to Dayframe's existing intake.

Adaptive validation: type checks, build and repository lint passed (four existing
complexity warnings); all 134 unit/integration tests and all 76 photo browser
checks passed across Chromium, Firefox, WebKit and mobile WebKit. Coverage includes
nine-plus-one packing for ten 11 MB inputs, exact 100 MB inclusion with native
paste parity, ten-image count cap, deferred single-image size rejection, unchanged
source-count checks and existing auth/retry/privacy behavior. The final smaller
count-only fixtures also passed on all four projects. Budget fixtures simulate
Blob.size; no real 100 MB memory benchmark or iPhone adaptive acceptance is claimed.
Mobile layout reviewed. Production rollout remains pending.

Adaptive rollout completed for `205642e` through
[release 40214009211](https://github.com/codyzu/dayframe/actions/runs/40214009211):
134 unit/integration tests, 348 browser passes with four existing skips, 44
navigation passes, deployment and live smoke. Worker version
`e9425aac-5d4a-4f29-877c-dd4aa3678e1d`; public build
`383dfbc4-321f-46f4-95d6-be90ce634080`. The deployed adaptive admin module matches
the local build; signed-out admin redirects to Access preserving the selection
count and anonymous catalog reads return 401. No Shortcut update or encoding
change. Actual iPhone adaptive-group acceptance remains pending.

## Photo import UX — 26 October 2026

Owner confirmed that adaptive batching works well on the iPhone, commonly making
three- or four-photo groups. This closes the prior adaptive phone acceptance gate;
it does not establish a measured device memory ceiling or remove the 40 MiB cap.

The owner requested a quieter Paste/Browse interface, preserving per-photo
conversion feedback. Both sources now share sequential thumbnails and explicit
Add confirmation. Clipboard groups use adaptive sizing on the first paste, with
no initial limit failure or recovery-mode button. Picker selections use the same
grouping and retain remaining File references for the next explicit action.
Progress distinguishes staged/remaining photos from actual added, duplicate,
skipped and failed outcomes. Each conversion/upload remains visible while active;
completed details collapse into a short aggregate summary, errors stay expanded.
Manual paste is offered only after an unsupported/refused/incomplete paste.
Expected count remains validated from the Shortcut query without a visible field;
similarity calibration remains in Options. Successful access checks are silent,
and errors/reconnection remain visible. Busy gating covers the complete batch,
including similarity review and catalog refresh. Failed rows retain retry inputs;
successful row listeners release their original inputs as before.

Re-read local upload requirements and plan foundation. Re-inspected cached
upstream README, MIT LICENSE, `dashboard/js/views/photos.js` and
`dashboard/js/slideshow.js` at
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`. Upstream provides a mock slideshow,
not this authenticated uploader. This interface is independently authored; no
upstream source/assets copied. No Shortcut, encoding, API, credentials, storage,
service or billing change. Validation and deployment evidence follow below.

Local validation: type checks, lint (four existing complexity warnings), production
build, 134 unit/integration tests and 132 affected browser cases passed across
Chromium, Firefox, WebKit and mobile WebKit. Reviewed mobile staged and completed
screenshots. New checks cover no picker upload before confirmation, visible
conversion feedback, busy gating, compact success results, conditional manual
paste, cancellation and picker continuation; existing auth/privacy/retry,
byte/count boundaries and changed-clipboard checks remain covered. Budget fixtures
simulate Blob.size, not an actual large-image memory benchmark. The simplified
flow's actual iPhone acceptance and production rollout remain pending.

The complete local release gate also passed with `DAYFRAME_RELEASE_ASSETS=1`:
134 unit/integration tests, 360 browser passes with four existing skips, and all
44 offline navigation cases. Source committed/pushed as `3ac32c8`. The first
GitHub attempt was cancelled before verification/deployment because its Ubuntu
mirror downloads were extremely slow; the same run was retried on a fresh runner,
which completed browser installation normally. No tests or deployment gates were
removed to work around the runner delay.

Production rollout completed for `3ac32c8` through
[release 40407204551, attempt 2](https://github.com/codyzu/dayframe/actions/runs/40407204551/attempts/2).
All checks, verified-asset deployment and live smoke passed. Worker version
`73ee6d05-9883-4509-b544-6be181d0717a`; public build
`b2a01451-1908-4e83-9a86-c0595f1a4972`. Independently matched the live admin module
to the locally verified build, confirmed signed-out admin 302 with selection query
preserved and anonymous catalog 401. No Shortcut update is required. The new UI's
actual iPhone acceptance remains pending; the earlier adaptive-flow acceptance is
owner-confirmed.

## iPad oversized-photo recovery — 27 October 2026

Owner found the simplified page easier to use, then reported six shared photos:
two prepared initially, a size-related error on the next button paste, and manual
paste accepting the remaining four. No error text or screenshot is available;
the exact rejected limit/bytes cannot be established. The button explicitly asks
for PNG; native paste uses the File representation provided by the browser. Both
paths apply the same individual/group limits, so smaller native representations
are a plausible explanation, not a confirmed cause or a reproduced iPad defect.

Reviewed local upload constraints and plan; re-inspected the pinned upstream
photo-view/slideshow reference at `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`.
No upstream code/assets copied. Also consulted the primary WebKit
[clipboard API description](https://webkit.org/blog/10855/async-clipboard-api/)
for representation/sanitization context; it does not prove this device's byte sizes.

A small recovery UX change reports the measured incoming size for a photo over
40 MiB and opens native-paste help immediately, without resetting the cursor or
asking the owner to reselect photos first. Picker errors still request a smaller
input. Limits, processing quality, Shortcut, authentication and backend are
unchanged. Added a synthetic six-item scenario: first two handed off, third item
reports 41 MiB on button paste, native paste supplies the original six smaller
representations and stages only items three through six. Confirmation is still
required and the upload rows/duplicate summary cover exactly six handoffs. This
validates recovery/cursor behavior, not the unobserved iPad error's root cause.

Local type checks, lint (four existing complexity warnings), build and 16 focused
browser cases passed across Chromium, Firefox, WebKit and mobile WebKit. Coverage
includes single-image rejection, deferred oversized items, exact 100 MB/native
paste parity and the new six-photo recovery case. Blob.size is simulated; no actual
large-image memory benchmark or root-cause claim. Production release pending.

Committed/pushed as `035c5d4`. Release `40546712610` attempt 1 was cancelled
before application checks because Ubuntu dependencies were downloading extremely
slowly from the runner's Azure mirror. Attempt 2 completed browser installation
normally and is running the unchanged full release gate. No application-test or
security gate was bypassed; the deployment outcome is recorded below.

Production rollout completed for `035c5d4` through
[release 40546712610, attempt 2](https://github.com/codyzu/dayframe/actions/runs/40546712610/attempts/2).
Types/lint/build, 134 unit/integration tests, 364 browser passes (four existing
skips), 44 navigation checks, deployment and live smoke passed. Worker version
`6f0d5d42-0061-4e06-9a4d-ea921696829d`; public build
`11f56ff7-7454-4a20-aed3-ceec437c61b0`. Independently matched the live admin module
to the tested build, verified sign-in redirect preserving the selection query and
anonymous catalog 401. No Shortcut change. Actual iPad acceptance of the clearer
error remains pending; the reported event's exact cause is still unconfirmed.

## Feature audit and implementation handoffs — 27 October 2026

Audited source at `6bca9694bfd629de315a20b2459cb36ceaa68df7` against the specification,
milestone/feature records, current code and test inventory. The [audit index](backlog/README.md)
records requirement coverage, priorities, dependencies and upstream review at
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`. Twenty individual plans supply code entry
points, implementation/validation stages, acceptance and rollback requirements,
and copyable prompts for independent chats.

Confirmed the pending weather-freshness behavior remains absent. Forecast browsing
and everyday display simplification are recorded owner requests. Bulk collection
backup/restore and bounded admin gallery are operational enhancements. Calendar,
vigilance, school/day profiles, offline fallback and authenticated adaptive Paste
already exist and are not new baseline gaps. Live authorization, physical import,
offline/update and performance/stability checks remain separately scoped acceptance
work. Hardware hardening retains the explicit owner deferral. Documentation drift
has a dedicated reconciliation plan; this audit preserves historical records.

No application changes, test-suite execution, production inspection/deployment,
credentials, paid services or device actions form part of this documentation slice.

Documentation validation: all 22 backlog documents passed local-link checks; all
20 individual plans contain the shared-contract link and separate-chat prompt.
Prettier checks passed for the backlog and README; `git diff --check` passed.
Existing large historical documents were not globally reformatted.

## F01 and F02 weather recovery and browsing — 27 October 2026

Implemented sequentially in the working tree based on
`6bca9694bfd629de315a20b2459cb36ceaa68df7`. F01 updates the single weather service
with conditions-aware deadlines, immediate stale-cache startup, common bounded
stale-200/failure recovery, old-timestamp rejection, equal-timestamp forecast
updates without recovery reset and no-store provider requests. Shared French dated
warnings replace misleading fresh advice in Morning and Photos, including failed
refreshes of young conditions. The 12-second timeout, lifecycle cancellation,
validated v1 fallback and independent vigilance policy are retained.

F02 chooses the backlog's seven-day default: Morning opens a native modal with
seven dated daily summaries and selected-day returned hourly detail. One seven-day
provider response serves both views. Missing rain/days/hours are unavailable;
keyboard focus, Escape/return, reopening reset, mode/override close, static icons,
mobile reflow and internal hourly scrolling are implemented. The button sits in
the existing forecast heading row to preserve the frame height. No selection is
saved and no new fetch service/timer, private API, offline retention, dependency,
paid service, credentials or device operation is added.

Refreshed upstream default head through GitHub:
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`. Read MIT `LICENSE`,
`dashboard/js/data.js` and `dashboard/js/views/home.js`. Retained glanceable weather
hierarchy as an idea; independently authored live timestamp handling and future-day
UI. No code/assets copied. Official Open-Meteo field/terms/pricing/licence review,
payload fixture measurement and aggregate retry budget are recorded in
[weather operations](weather.md#provider-terms-and-request-budget).

Local validation passed: `pnpm check`, `pnpm lint` (four existing complexity
warnings), `pnpm test` (148 unit/Worker integration tests), `pnpm build`, and
`pnpm exec playwright test tests/e2e/weather.spec.ts tests/e2e/morning.spec.ts tests/e2e/density.spec.ts tests/e2e/scheduling.spec.ts`
(116 passes, four existing intentional skips across Chromium, Firefox, WebKit and
mobile WebKit). The focused weather/morning unit set also passed all 46 tests.
Reviewed Standard/Large frame and mobile screenshots, including dated stale copy;
the mobile Close control stays visible while scrolling. Unit/browser coverage includes
old/equal/stale responses, recovery, lifecycle/wake storms, missing coverage,
loading/offline, Paris versus Los Angeles timezone, repeated DST hours, year change,
focus restoration and expiry within the same Morning mode. The reload test now
uses a fixed synthetic vigilance bulletin to avoid evaluating a replaced document;
production vigilance code is untouched. Documentation links and `git diff --check`
passed. This is local synthetic evidence, not a full release-gate/deployment run.
No production deployment, real household weather observation or physical-device
acceptance is claimed.
Rollback: web revert, keeping UI/provider fields together; old v1 cache degrades
safely and no migration/restoration is required. Existing user documentation edits
and deferred hardware/security acceptance remain intact.

## F01 reading-age enhancement and F01/F02 release — 28 October 2026

Owner accepted a quiet human-friendly reading age for both fresh and stale weather,
then authorized committing and deploying the accumulated work. Morning and Photos
use the provider conditions timestamp, show minutes/hours today, yesterday's local
time or an older dated reading, and retain the stale suffix and Morning departure
warning after failed refreshes. Exact timestamp/timezone remain accessible on the
semantic time label. One existing minute scheduler updates ages while offline;
there are no additional requests, timers, storage/billing changes or device actions.
Year-boundary dates remain explicit. Future provider instants show their time.

Re-read specification §4.2, the roadmap upstream/delivery requirements and weather
freshness proposal. Refreshed GitHub upstream main on 28 October: still
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`; re-inspected root MIT `LICENSE` and
`dashboard/js/views/home.js`. Independently implemented provider reading ages;
upstream's mock weather remains an idea reference. No upstream code/assets copied.

Focused validation and full release/deployment evidence follow. The release will
include the accumulated F01/F02 implementation and feature-audit documentation.
Existing deferred physical/security acceptance stays deferred; no live identity,
photo mutation, outage or native-device test is authorized by this web rollout.
Rollback remains a web revert/previous Worker version, with compatible validated
weather cache and no data migration.

Reading-age local validation: types, lint (four existing complexity warnings),
163 unit/Worker integration tests and build passed. The focused age tests exercise
provider-time versus retrieval-time, minute/hour boundaries, local yesterday/year
boundaries, DST and recovery. The initial full browser run passed 402 cases and
four existing skips, exposing six dense frame-layout failures. Reclaimed decorative
Morning intro spacing, retaining all font sizes, warnings and six event rows; all
20 calendar/day-planning checks then passed across the four browser projects.
Reviewed fresh/stale Morning and Photos screenshots and the corrected dense views.
WebKit's exact timestamp punctuation differs from Chromium/Firefox; the test accepts
both localized separators while checking date, time and timezone. Application
behavior is identical. The complete hosted release gate and deployment are pending
at this commit; no check, layout assertion, security gate or billing gate is bypassed.

First hosted release [40628782891](https://github.com/codyzu/dayframe/actions/runs/40628782891)
passed types/lint/build and all 163 unit/Worker tests, then passed 406 browser cases
with four existing skips. Two instances of the stale-200 recovery test failed
(Chromium/mobile); deployment was skipped. Its request counter advanced before
response parsing/acceptance, so a virtual-clock jump could shift the intended
recovery deadline. The test now explicitly pauses time and waits for the accepted
response's retrieval timestamp before moving to the next deadline. Count, stale
UI, five-minute backoff and fresh recovery assertions remain unchanged. All 20
focused repetitions passed (five per browser). Product code, retry policy and
security gates are unchanged; a fresh full hosted release is required.

Before deployment, review identified an age-label edge case during weather
location/timezone replacement: the old Morning label could remain in the reused
DOM after the new service had no validated data. Clear it on every no-data update,
including while Morning is inactive. A four-browser configuration-change check
passed: the previous age becomes hidden in Night, then the original Paris cache
restores its actual ten-minute reading age rather than a new download age.
Types/build and repository lint passed. Run `40630383321` was intentionally
cancelled before deployment to include this small correction in the final release;
its cancellation is not an application-test result. All prior retry/security
assertions remain in place.

### Weather production rollout completed — 28 October 2026

[Release 40631119085](https://github.com/codyzu/dayframe/actions/runs/40631119085)
succeeded for `8968dbf`: types/lint/build, all 163 unit/Worker integration tests,
412 browser passes with four existing intentional skips, all 44 offline-navigation
checks, verified-asset deployment and live smoke. This includes F01 recovery, F02
seven-day browsing and the reading-age enhancement, plus the location-change guard.
Worker version `cbfb09be-2bd8-457e-8d12-b04637ed628c`; public build
`35e3e8b3-fa70-473d-a475-c57fbcf80084`.

Downloaded that run's approved production artifact and independently matched live
HTML, dashboard JavaScript/CSS, `/offline`, `/sw.js` and `/version.json` against it.
Re-ran the full anonymous smoke matrix: admin redirects to Access, photo/calendar/
settings/session reads remain denied, and headerless mutations remain denied with
no-store responses. Public health remains production/healthy. No household data was
read or mutated, and no device operation, credential/binding or billing change was
introduced. Physical-device reading-distance/touch acceptance and previous deferred
hardware/security checks remain separate. The committed feature audit/backlog is
included. Rollback is the previous Worker version/web source revert; validated v1
weather cache remains safe to refetch without migration.

## Forecast dialog inactivity — 28 October 2026

Owner approved closing seven-day browsing after 60 seconds without interaction.
Added one timeout owned by the open dialog: pointer presses, keyboard, mouse wheel
and touch scrolling reset it; weather renders and programmatic focus do not. Close,
Escape, mode/override transitions and disposal clear it. Reopening starts a fresh
minute and selects today, and closing restores focus without changing the mode.
An accessible French description announces the timeout and how to extend browsing.
No weather request, persistent setting, private data, service, billing, dependency
or device change. Rollback is a web revert of this dialog behavior.

Re-read the weather spec and F02 delivery contract. Refreshed upstream main at
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`; read MIT `LICENSE` and
`dashboard/js/views/home.js`. Upstream remains a mock weather/hierarchy reference;
this dialog timeout is independently authored and no code/assets were copied.
Validation and production rollout evidence follow below.

Local validation: types, production build and repository lint passed (four existing
complexity warnings); all 61 affected weather/morning unit checks and all 88 weather
browser checks passed across Chromium, Firefox, WebKit and mobile WebKit. Coverage
includes the exact 59,999/60,000 ms boundary, focus restoration, reopening, input
resets and a response accepted at 55 seconds that does not prolong the deadline.
Touch input is synthetic in desktop engines, not a physical-device acceptance claim.
Existing long-refresh focus coverage now keeps the dialog active with keyboard
input; stale-response recovery reopens the timed-out dialog before inspecting the
updated forecast. No weather-service or retry assertions were removed. Full hosted
release checks, deployment and independent live verification remain pending here.

### Forecast inactivity rollout completed — 28 October 2026

[Release 40647681115](https://github.com/codyzu/dayframe/actions/runs/40647681115)
succeeded for `701e918`: types/lint/build, 163 unit/Worker integration tests,
424 browser passes with four existing intentional skips, all 44 offline-navigation
checks, verified-artifact deployment and live smoke. Worker version
`40ea0cb1-562f-4b39-b017-99ac68b5bc9f`; public build
`84013353-dc50-4b46-8e44-ccc47c8bd1bd`.

Downloaded the approved artifact and independently matched live HTML, dashboard
JavaScript/CSS, `/offline`, `/sw.js` and `/version.json`. Anonymous photo/calendar/
settings/session reads remain denied, headerless mutations remain denied, and
admin routes redirect to Access. No credentials, private data, services/billing or
native-device settings changed. Physical touch acceptance remains separate from
the browser/emulation checks. The dialog now closes after 60 idle seconds, resets
on interaction, retains explicit close/mode behavior and restores opener focus.

## F03 quiet everyday display — 28 October 2026

Removed routine persistence/eviction/progressive-sync text from normal online Photos,
including partially saved collections. Preserved concise storage-failure warnings,
existing empty/private-access/interruption states and recovery controls. Offline
playback says `Hors connexion · photos enregistrées` in both the live slideshow and
standalone fallback. Successful catalog refresh clears obsolete storage warnings;
offline playback replaces online-storage warnings with its offline label.

A collapsed `/admin/photos` section reports the current browser's saved-copy count
and persistence status only when opened. It does not query another frame, request
persistence, download photos, renew access or poll. Unknown API support is explicit;
copy counts are not proof of full synchronization or backup. Authorization denial
clears/collapses the report and fences pending results. Existing clock/weather,
framing, next-photo, text-size/mode controls, reduced motion and native maintenance
remain available. Screenshot review found phone controls overlapping the clock;
only on narrow screens, the photo control strip and retry now sit below weather,
with spacing checks against clock, status and navigation. Desktop placement stays
as before. Storage/lease/auth semantics, request cadence, private resources,
worker allowlist, services and €0 infrastructure are unchanged.

Read F03/shared contract, spec and relevant M5/operations records. Refreshed upstream
main at `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`; reviewed MIT `LICENSE`,
`dashboard/js/views/photos.js` and `dashboard/js/slideshow.js` at that SHA. Adopted
quiet playback/on-demand information as an idea, independently authored this change,
and retained Dayframe's protected catalog, bounded decode/storage and controls.
No upstream code/assets, mock data, favorites, continuous motion or history copied.

Local validation and hosted full-release evidence follow. Synthetic browser checks
are not actual-frame/phone acceptance. Physical reading-distance/touch review remains
separate, as do previous security, outage/update and stability deferrals. Rollback
is a source revert/redeployment; existing offline database and settings remain
compatible, with no migration or deletion. The original 23 October request above
is now linked to this implementation rather than treated as unstarted work.

Local validation: types, build and lint passed (four existing complexity warnings
and the existing `document.write` deprecation hint). All 22 affected photo/offline
unit/integration tests passed, followed by 212 photo/offline browser checks across
Chromium, Firefox, WebKit and mobile WebKit, and all 44 enabled/disabled offline
navigation checks. Final diagnostics checks also cover pending persistence results
after role loss, including reopening the panel while denied. Screenshots in
[evidence/f03](evidence/f03/README.md) document Standard/Large frame layouts and
mobile, normal/partial-sync/offline/empty/expired/denied/failure states and keyboard
administration. No actual device operation or new physical acceptance is claimed.
Hosted `pnpm verify`, verified-artifact deployment and independent live matching
remain pending until the release record below.

### F03 production rollout completed — 28 October 2026

[Release 40718575390](https://github.com/codyzu/dayframe/actions/runs/40718575390)
succeeded for `ced80dffbd275a3f2b15a48af0ea197e07aa1edf`: full `pnpm verify`,
163 unit/Worker integration tests, 452 browser passes with four existing intentional
skips, all 44 offline-navigation checks, verified-artifact upload and live smoke.
The final local diagnostics run also passed all eight cases across the four browser
projects. Worker version `790be822-4735-47ab-9856-ba730aa075f5`; public build
`97968ea2-6de5-49ba-aad1-7a82d23026a2`.

Downloaded the approved production artifact and independently matched live home
HTML, dashboard and photo-admin JavaScript, shared/dashboard CSS, `/offline`,
`/sw.js` and `/version.json` byte hashes with redirects forbidden. Re-ran the full
anonymous smoke matrix using that artifact: public health is production/healthy,
admin redirects to Access, private photo/calendar/settings/session reads remain
denied and headerless mutations remain denied with no-store responses. No private
household data, credentials, bindings, services/billing or native settings changed.
Physical-frame visual/touch acceptance and previously deferred security/offline/
stability checks remain separate. F03 web implementation, commit and deployment
are complete; the dated local-pending records above describe earlier stages only.

## Mobile photo controls and readability correction — 28 October 2026

Owner iPhone screenshots showed F03's fixed-offset photo control strip floating
across the image/empty card. The owner reaffirmed the larger type for household
readability, proposed a vertical portrait toolbar and requested consistent mode
navigation dimensions. This supersedes the original two-preset selector requirement
and F03's first mobile placement; the prior deployment record is historical.

Implemented one shared bottom navigation with equal-width buttons and identical
bounds in Morning, Photos and Night. Its safe-area-aware anchor is independent of
retry/message visibility. Photo controls are a pair of 56px icon buttons anchored
at the dock edge: vertical in portrait, horizontal in landscape. The fit toggle
has French accessible naming/pressed state and retains existing contain/cover
persistence and offline preference writes. Next-photo behavior remains bounded.
Controls hide without a loaded photo, on mode exit and with idle navigation;
interruption text remains visible. The empty state uses readable plain copy instead
of a large decorative card competing with recovery UI.

The former Large type tokens now apply everywhere. Removed the selector, preset
selection module and obsolete selector-precedence unit tests; browser checks now
assert that old compact URL/storage choices cannot shrink the type, and retain
large-font viewport/long-condition/keyboard/reduced-motion checks. Existing density
URLs remain accepted by the navigation allowlist for bookmark compatibility.
No private storage is cleared, no setting/schema/auth/retention/request change, and
no dependency, native device or service/billing change. Rollback is a source revert.

Read the spec, F03 delivery contract, current photo/readability records and relevant
upstream source. Refreshed main at `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`,
reviewing MIT `LICENSE` and `dashboard/js/views/photos.js`. Retained on-demand control
ideas, independently implemented this household design; no code/assets or owner
screenshots/photos copied into public artifacts. Also inspected the installed heartbeat source's dashboard/status selectors:
status remains beneath `[data-dashboard]`, and active Photos retains a nonzero panel.
No native code/package/action changed. Physical review of this new design remains
separate from synthetic browser evidence. Validation/release evidence follows.

Local validation: types, lint and build passed with the existing four complexity
warnings and `document.write` hint. All 160 applicable unit/integration tests passed;
three retired preset-selection tests were removed with that feature. The full
browser sweep passed 455 cases with four existing skips and one WebKit admin-ready
fixture race. That case now waits for the authenticated upload control; all 12
final admin/toolbar cases passed across Chromium, Firefox, WebKit and mobile WebKit,
including active-panel bounds. All 44 offline-navigation checks passed. The full
hosted release gate remains pending. Reviewed synthetic native/mobile evidence is
in [mobile-controls](evidence/mobile-controls/README.md); physical phone/frame review
of this new layout remains separate.

### Mobile/readability production rollout completed — 28 October 2026

[Release 40732168963](https://github.com/codyzu/dayframe/actions/runs/40732168963)
succeeded for `10e3c321828211b1829671eb19da79b88550648e`: full `pnpm verify`,
160 unit/Worker integration tests, 456 browser passes with four existing skips,
all 44 offline-navigation checks, verified-artifact deployment and live smoke.
Worker version `e94b5a65-e28c-48e2-aa2e-3452f4ba4129`; public build
`23e48e01-f7ab-4d21-b11b-d2907339441d`.

Downloaded the approved production artifact and independently matched live home
HTML, dashboard/photo-admin scripts, shared/dashboard CSS, `/offline`, `/sw.js`
and `/version.json` byte hashes without redirects. The full anonymous smoke matrix
passed again: production health is healthy, administration redirects to Access,
private photo/calendar/settings/session reads are denied and headerless mutations
remain denied with no-store responses. The new large-type default, matching
navigation dimensions and portrait edge controls are deployed. No credentials,
private household data, bindings, native settings or paid services changed.
Physical phone/frame review of this new layout remains separate; prior dated
acceptance deferrals retain their scope. The local-pending notes above are historical.

## F10 touch navigation and photo continuity — 28 October 2026

Owner selected [F10](backlog/F10-touch-navigation.md) for implementation and asked
for commit/deployment. Implemented bounded 30-ID viewing history, previous/forward
retracing and last-photo restoration before gesture/animation work. Mode exit
still releases decoded images; validated queue/catalog IDs survive only within
existing refresh/privacy rules. Authorized saved bytes avoid forced image downloads on
return; catalog revalidation on entry preserves the existing access-check boundary. Storage recovery saves missing current/next bytes without advancing.

Horizontal screen swipes use Morning ↔ Photos ↔ Night without wrapping and feed
the same temporary override as mode buttons. Photo edge taps browse; centre taps
reveal controls. Explicit previous/next buttons, background arrow-key navigation,
focus return, dim Night controls, cancellation/multitouch/dialog exclusions and
compatibility-click suppression are included. Native dragging is disabled for
slideshow images, with vertical touch scroll/pinch zoom retained.

Two 110 ms live-page slide halves run after release, with up to 250 ms bounded
photo preparation. No screenshots or duplicate private views retained. Reduced
motion/API failure/watchdog use immediate switching; scheduled/lifecycle changes
cancel pending transforms. Physical smoothness and any preview alternative remain
an actual-frame acceptance/follow-up, not a desktop performance claim.

Refreshed upstream HEAD `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`; read pinned MIT
`LICENSE`, `dashboard/js/views/photos.js`, `dashboard/js/slideshow.js` and pointer/
idle shell sections of `dashboard/js/app.js`. Used tap areas/on-demand controls as
ideas; independently implemented bounded history, forward retracing, privacy-aware
restoration and transitions. No upstream source/assets copied. No dependency,
provider request service, retention expansion, credential, billing or device change.
Rollback is a web revert/previous Worker version; no data migration/deletion.

First F10 browser pass: 24 cases passed across Chromium, Firefox, WebKit and mobile
WebKit, after focused Chromium offline/privacy checks. Edge-case additions and the
full local release gate are running. Final local/hosted verification, commit,
production rollout and independent asset matching will be recorded below.

F10 verification follow-up: the first full gate passed types/lint, all 164
unit/Worker tests and build, then exposed a re-entry authorization regression and
animation timing assumptions in geometry/inactive-weather tests. Stopped that
known-failing run; restored catalog revalidation before publishing saved pixels
while retaining image-byte reuse. Existing denial assertions remain unchanged.
Relevant layout checks now wait for mode/transition completion. All 64 focused
checks passed across four browser projects, including 40 F10 cases and the original
read-only-cookie denial check. A fresh complete gate is running.

The next complete browser sweep finished with 494 passes, four existing skips and
two failures of the same storage-warning fixture in WebKit/mobile WebKit. Synthetic
diagnostics showed the IndexedDB instance override was not intercepting opens
(the native method remained in place). The fixture now intercepts the prototype
and asserts that the simulated failure actually ran; no production storage policy
or warning assertion was weakened. All 16 targeted cases then passed across four
browsers: storage recovery, keyboard/Night hover contrast, nonfinishing animation
watchdog and delayed-image preparation. The latter two explicitly prove that
fallbacks cannot strand the live page offscreen. Night controls use the dark
hover palette, and slide gaps use a dark backdrop to avoid a bright Night flash.
A fresh full gate on this final source follows below.

F10 local closeout: types, lint (four existing warnings), all 164 unit/Worker tests,
build and 508 regular browser checks passed, with four existing skips. The update
navigation test still began its reload before the animated Night selection had
committed; it now establishes Night and waits for transition completion, retaining
all existing override-preservation assertions. All 44 navigation checks passed on
a complete rerun. Final Night hint/spacing polish avoids overlap with the large
greeting when retry is visible; all 12 final geometry/photo-tap/Night keyboard
checks passed across four browsers, with an explicit greeting/dock clearance
assertion. Reviewed [synthetic screenshots](evidence/f10/README.md) cover frame and
phone layouts. Formatting, documentation links and diff whitespace passed. The
hosted full gate will verify the exact committed source before deployment; commit,
release and independent live verification follow below. No physical acceptance
or deferred device/security gate is closed by this web evidence.
