# Dayframe: Implementation Plan

**Status:** Draft v0.1 — implementation not started  
**Date:** 16 October 2026  
**Requirements:** [Family Dashboard: Technical Specification](technical-specification.md)  
**Primary upstream:** [Wes Bos — photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)

> **Start here, including implementation agents:** Dayframe is based on Wes Bos's dashboard and photo-frame work. Inspect the relevant upstream implementation and research before starting a related task. Preserve attribution, record reuse and deliberate differences, and verify hardware assumptions on our actual device. The local specification remains the authority for Dayframe's requirements.

## 1. Upstream foundation and provenance

### Source map

| Source | Use in Dayframe |
| --- | --- |
| [Upstream README and agent guidance](https://github.com/wesbos/photo-frame-dashboard/blob/main/README.md) | Understand the project, device investigation process, backup/recovery lessons, and entry points. |
| [Dashboard source](https://github.com/wesbos/photo-frame-dashboard/tree/main/dashboard) | Review layout, display behavior, asset handling, deployment, and browser compatibility before building equivalent features. |
| [Kiosk guide](https://github.com/wesbos/photo-frame-dashboard/blob/main/dashboard/kiosk/README.md) | Evaluate kiosk behavior and an existing Android wrapper during M6, if a browser alone is insufficient. |
| [Device index](https://github.com/wesbos/photo-frame-dashboard/blob/main/docs/devices.md) | Find relevant board/firmware reports after identifying our unit. |
| [Dragon Touch Modern10 Charm notes](https://github.com/wesbos/photo-frame-dashboard/blob/main/docs/dragontouch-modern10-charm.md) | Related research to investigate, **not a validated procedure for Classic 10**. |
| [Issues](https://github.com/wesbos/photo-frame-dashboard/issues) and [pull requests](https://github.com/wesbos/photo-frame-dashboard/pulls) | Check newer findings relevant to the actual hardware before device work. Treat unmerged procedures as unverified. |

**Review baseline:** The upstream README and device index were reviewed via GitHub on 16 October 2026. The README describes a Vite dashboard using mock data and Cloudflare Workers, plus an Android kiosk wrapper. This is an initial orientation, not a source-code or license audit. No upstream code or assets have been imported. A reviewed upstream commit SHA has not yet been captured; branch links above move over time.

### Required upstream review before implementation

- [ ] M1: Capture an upstream commit SHA; inspect the dashboard source, package manifest, build configuration, styling, and deployment setup at that revision.
- [ ] Record useful source paths, adoption decisions, and any incompatibilities in `docs/decisions/0001-upstream-foundation.md`.
- [ ] Verify license coverage for each code/asset candidate before copying it. If permission is unclear, use the research as reference and implement locally without copying that material.
- [ ] For adapted material, retain required notices and record source permalink, original path, local destination, and modifications. Add a third-party notices file when material is imported.
- [ ] Refresh the relevant upstream review when starting a new feature or device session; record the revision actually used. Do not silently absorb upstream changes.

Review upstream first, then decide deliberately. Dayframe keeps Astro/TypeScript/UnoCSS, French weather for Annecy, protected family photos, KV storage, and the strict €0 deployment requirement. An upstream implementation does not override these choices. No automated upstream synchronization or full fork is planned unless the review justifies it.

## 2. Delivery approach

Deliver one demonstrable slice at a time. Keep task IDs in commits/PRs and update this document with validation evidence. All tasks below are pending. A task is done only when its acceptance evidence exists; a mock or desktop-only test must be labeled as such.

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

| Task | Work | Acceptance evidence |
| --- | --- | --- |
| M1.1 | Complete the upstream review and provenance record above; compare reuse against our stack. | ADR with source revision, paths, license findings, and explicit adopt/adapt/defer decisions. |
| M1.2 | Select compatible versions of Node, package manager, Astro, TypeScript, UnoCSS, Iconify Meteocons, Wrangler, Vitest, Playwright, and lint/format tooling. Verify current official docs and package engine/peer requirements. | Exact versions recorded in the ADR and manifest, committed lockfile, pinned runtime/package manager, reproducible clean install and build. |
| M1.3 | Scaffold static pages, layout, dashboard controller, example configuration, and locally bundled icons/fonts/assets with documented rights. | French shell renders at 1280 × 800; admin shell adapts to phone/desktop; no kiosk scrolling; reduced motion supported. |
| M1.4 | Validate the Astro/static-assets/Worker API integration with a non-sensitive health route. Configure local bindings and ignore private configuration. | Local preview serves assets and the API; bundles contain no secrets; separate local and production settings documented. |
| M1.5 | Add CI for type checks, lint, unit tests, and build; document deployment with least-privilege CI credentials. | Required checks pass on a clean checkout; deployment runs only after checks pass. |
| M1.6 | Verify current Cloudflare Free quotas, asset request behavior, and account settings before provisioning. Deploy a public fixture-only preview when credentials are available. | Free-plan configuration and sanitized deployment evidence recorded; no billable services enabled. |

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

| Task | Work | Acceptance evidence |
| --- | --- | --- |
| M3.1 | Build validated metadata contracts and KV adapter: separate binary records and listable metadata, stable IDs, cursor pagination, and consistent errors. | Catalog does not read all binaries; partial writes/deletes and delayed visibility have documented recovery behavior. |
| M3.2 | Add protected catalog/image/upload/delete endpoints with size limits, ID/hash format checks, image header/dimension validation within Worker limits, trusted identity attribution, and authorization-aware cache headers. | Anonymous reads and non-admin mutations fail; malformed/oversized input is rejected; private responses never enter shared caches. |
| M3.3 | Build sequential browser processing: original-byte SHA-256, orientation-aware decode, normalized 64-bit dHash, no-upscale resize to ~1600px, WebP ~0.82, metadata stripping, and per-file feedback. | Representative iPhone/browser images render correctly; actual output MIME is checked; unsupported formats/encoders produce actionable errors. |
| M3.4 | Add exact duplicate lookup and human review of perceptual matches, configurable thresholds, and safe retry UI. | Repeated uploads target the same identity; similar photos are not discarded automatically; concurrency limitations remain explicit. |
| M3.5 | Add responsive admin catalog, thumbnails, confirmed deletion, and storage reporting. | Both admins can manage photos; quota errors preserve existing content; usage is labeled approximate if based on eventually consistent metadata. |
| M3.6 | Add shuffle slideshow, ~20-second interval, contain/cover, bounded preloading, empty state, periodic catalog refresh, and failure recovery. | No immediate repeats when multiple photos exist; new uploads appear; transient errors retain the current image; decoded image memory stays bounded. |

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

| Decision | Due | Required outcome |
| --- | --- | --- |
| Upstream revision, reuse scope, and licensing | M1.1 | Source review and attribution record. |
| Exact dependencies and Astro/Worker wiring | M1.2–M1.4 | Pinned compatible versions and verified local build/API. |
| Approved visual assets/mockups | M2.3 | Available reference and asset rights, or an explicitly recorded provisional design. |
| Admin authentication and image credential transport | M3.0 | Working protected-route prototype and auth ADR. |
| KV schema, accounting, and partial-operation recovery | M3.0–M3.5 | Measured operation budget and documented consistency limits. |
| Credential revocation bounds and private offline cache policy | M4–M5 | Explicit propagation/retention guarantees and tests. |
| Classic 10 compatibility, kiosk, brightness, startup | Discovery/M6 | Observations on the actual unit and a recovery path. |

**Next implementation slice:** M1.1 upstream review and M1.2 tooling decision, followed by the smallest static shell. This document authorizes no hardware changes or paid infrastructure.
