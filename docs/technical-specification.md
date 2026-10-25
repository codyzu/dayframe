# Family Dashboard: Technical Specification

**Status:** Draft v0.1  
**Date:** 16 October 2026  
**Target:** Single-household personal deployment; public GitHub repository  
**Primary stack:** Astro, TypeScript, UnoCSS, Cloudflare Workers

**Project foundation:** This project builds on [Wes Bos's Photo Frame Dashboard](https://github.com/wesbos/photo-frame-dashboard), including its dashboard example and Android photo-frame research. Implementation agents must review the relevant upstream work and record reuse or deviations as described in the [companion implementation plan](implementation-plan.md). Upstream hardware findings must be verified against our actual Dragon Touch Classic 10.

## 1. Overview

Family Dashboard is a browser-based household display designed for a repurposed Android digital photo frame. It combines useful morning weather information, family photos, and eventually home automation controls in an attractive, time-aware interface. The same site should work on the frame, a computer, and a phone.

The project is developed publicly but initially serves one household. Anyone cloning the repository would deploy their own infrastructure; multi-tenancy and a hosted service for others are explicitly out of scope.

### 1.1 Goals

- Offer information at a glance, especially when preparing to leave home.
- Behave like a polished digital photo frame when no information is needed.
- Change display modes on a schedule, with temporary manual overrides.
- Allow two household administrators to upload and manage photos easily.
- Support an eventual iOS Share Sheet upload shortcut.
- Remain usable on older Android hardware and ordinary desktop/mobile browsers.
- Tolerate temporary network failures, where practical.
- Operate at **€0 recurring infrastructure cost**, with no unexpected overage charges.
- Provide a small, practical project for learning Cloudflare.

### 1.2 Non-goals

No multi-tenant hosting, public account registration, generalized plugin system, native Android/iOS app, full-resolution photo archival, advanced image editing, AI-generated forecasts, or complete home automation system in the initial release.

**Approved maintenance exception, 17 October 2026:** [ADR 0004](decisions/0004-frame-maintenance-helper.md) permits a small standalone Android maintenance utility for H3.1, providing physical access between the existing Firefox browser and stock Home/Settings. It does not replace the web application or browser engine; the owner passed the physical maintenance round-trip gates using Settings through stock Home; fullscreen and unattended recovery remain separate. The owner approved [ADR 0006](decisions/0006-firefox-boot-helper.md)’s limited 0.3.0 helper extension on 18 October for a bounded boot launch of the existing Firefox fullscreen shortcut and DF restoration; it adds no browser engine. Broader H6 recovery remains separate. [ADR 0007](decisions/0007-geckoview-recovery-trial.md) records the separately approved GeckoView recovery trial on 19 October. Reviewed 0.1.3 recovery/normal boot passed and untouched cold startup is owner-confirmed; completed physical closeout and explicit timing/paint verification limits are tracked in the [current H6 audit](hardware/h6-recovery.md#current-requirement-by-requirement-audit). This trial does not close prior hardware/security/soak deferrals.

## 2. Target devices

### 2.1 Primary display

| Property | Initial target |
| --- | --- |
| Hardware | Dragon Touch Classic 10 |
| Display | 10.1-inch IPS touchscreen, 1280 × 800 |
| Orientation | Landscape |
| Network | Wi-Fi |
| OS | Android 6.0.1 / API 23 (supplied Classic 10 diagnostics) |
| Browser | Firefox or GeckoView, version subject to hardware verification |
| Input | Touchscreen |
| Presentation | Fullscreen kiosk if hardware supports it |

**Hardware evidence:** Supplied Classic 10 diagnostics confirm the Android build, approximately 1 GB RAM, ARMv7 ABI, native display and root ADB over TCP 5555. Allwinner A33 is a platform inference; H1 has since verified the MMC storage map and WebView 44.0.2403.119 (see the [execution record](hardware/h1-discovery.md)); the owner supplied visual physical inventory; [H3](hardware/h3-firefox.md) has since installed Firefox 143.0.4 and verified initial Dayframe rendering plus synthetic WebP/API checks, with physical touch/exit/manual relaunch subsequently accepted through the [H3.1 DF maintenance helper](hardware/h31-maintenance.md#acceptance-and-operating-limits). USB data, recovery and boot-to-kiosk remain unverified. See the [hardware inventory and evidence labels](hardware/dragon-touch-classic10.md) and [M6 hardware stages H1–H8](hardware/implementation-plan.md). The documented Modern10 Charm is a different model; firmware and partition layouts must not be interchanged. No device commands were run during planning. A verified private backup precedes APK/persistent changes; firmware/system changes additionally need a usable recovery route and specific authorization.

The web app must remain usable without unlocking this particular frame.

### 2.2 Browser and UI requirements

**Display density:** Standard is the default for ordinary desktop/mobile visits. Dedicated displays, including Classic 10, must be provisioned with `/?display=frame`, defaulting to Large independently of resolution/user agent. An explicit `density=standard|large` parameter overrides a saved browser preference, which overrides the profile default. The visible text-size selector persists explicit choices locally. Rem-based tokens respect font preferences; smaller viewports reflow without scaling the entire dashboard. See [display density](display-density.md) for precedence, persistence, provisioning and validation details.


- Target Firefox/GeckoView 143 as a provisional older-Android compatibility baseline, not a promise that it runs on this device.
- Support current desktop Firefox, Safari, and Chromium.
- Avoid relying exclusively on web APIs unavailable in the supported kiosk browser.
- Fit the landscape 1280 × 800 display without scrolling in kiosk modes.
- Be readable from about 1–3 metres, with large type, usable touch targets, high contrast, and restrained motion.
- Adapt admin and general browsing views for mobile and desktop.
- Respect reduced-motion preferences and limit GPU/CPU-intensive effects.

## 3. Display modes and scheduling

| Mode | Purpose |
| --- | --- |
| Morning | Current weather and practical forecast for getting ready |
| Photos | Fullscreen rotating family photos |
| Night | Low-distraction dimmed or minimal screen, potentially screen off |

**Provisional schedule** in the configured IANA timezone (`Europe/Paris` initially):

| Local time | Mode |
| --- | --- |
| 06:00–10:00 | Morning |
| 10:00–23:00 | Photos |
| 23:00–06:00 | Night |

The daily schedule remains the fallback. Optional private day profiles provide different
mode periods and weather checkpoints by weekday and for days off. Weekends and known
Grenoble/Zone A school vacations or metropolitan public holidays can use a day-off
profile: Morning 08:00–11:00, Photos 11:00–23:00, Night 23:00–08:00. School vacations
and public holidays suspend habitual activity checkpoints and appear in the upcoming
appointments panel; Google events remain visible. Existing saved settings require
explicit configuration. See [day planning](day-planning.md) for precedence, official
sources, unknown/stale coverage and current implementation/deployment limits.

**Scope update, 20 October 2026:** Home is removed until useful household automation exists. The display and schedule editor offer Morning, Photos and Night. Existing saved/exported `home` periods are interpreted as Photos with their original times; unrelated settings remain intact. A future Home screen requires a separate feature slice.

The schedule must be configurable without redeployment once settings persistence is implemented. Handle daylight-saving transitions correctly.

Touching the kiosk reveals minimal mode navigation. The user can manually switch modes; the override is temporary and returns to the scheduled mode after a configurable inactivity timeout. Overrides can be local to each display initially. Navigation fades or hides after inactivity. Admin tools are not exposed on the kiosk navigation.

For the native kiosk, normal dashboard display has no persistent DK maintenance button. A stationary two-finger hold for approximately 1.5 seconds opens native maintenance. Keep the independent service-owned DK return control visible outside the kiosk, including Android Settings, so the owner can return to the display. Native failure/setup screens retain explicit maintenance access.

## 4. Morning weather mode

### 4.1 Information hierarchy

The screen should answer: **“What do we need to know before leaving the house today?”**

Required:

- Large local clock and human-readable date.
- Location, initially Annecy.
- Current temperature and textual/icon condition.
- Feels-like temperature.
- Today's maximum and minimum.
- Whether it is currently raining and whether/when rain is forecast.
- Hourly temperature line chart and precipitation probability, with clearly distinct visual encodings.
- A visible marker for the current time.
- Brief, actionable, deterministic summary, such as “Dry until 15:00; showers this afternoon.”

**Scope update, 21 October 2026:** Morning must show official Haute-Savoie vigilance
for the initial Annecy location, independently of Open-Meteo conditions. A conditional
banner names the written severity, phenomenon, department, validity period and issue
time, with all warnings and official-source links available in details. No-warning,
unavailable, stale and unsupported-location states must remain distinct. See
[weather vigilance](weather.md#official-vigilance--21-october-2026).

Conditional or later additions: strong winds, freezing conditions, sunrise/sunset,
short multi-day forecast, and calendar events. Avoid cluttering the primary 10-inch display with humidity, pressure, UV, or long forecasts by default.

The visual direction follows the approved mockups: scenic Annecy-style background, tasteful translucent surfaces, legible typography, color weather icons, and a combined hourly chart. The background must never compromise contrast.

### 4.2 Weather provider

Use **Open-Meteo** for initial noncommercial weather data. Include its required attribution and comply with its usage terms.

Request the fields needed for:

- Current temperature, apparent temperature, weather code, and `is_day`.
- Hourly temperature, precipitation probability, precipitation amount if useful, weather code, and `is_day`.
- Daily temperature high/low and optional sunrise/sunset and daily weather code.

A direct browser fetch is acceptable because Open-Meteo does not require an API secret for the intended free, noncommercial usage. A Worker proxy may be added for centralized caching or additional providers, but is not required initially.

Refresh about every 30 minutes; cache the last successful response locally and label stale information. The interface should remain usable if weather fetching fails.

**Proposed follow-up, 22 October 2026:** [Weather freshness and recovery](weather-freshness.md)
specifies bounded retries for successful responses containing old conditions and
dated stale-weather copy in Photos and Conseil du jour. Implementation is pending.

### 4.3 Weather icons

Use **Meteocons** via Iconify/UnoCSS, preferably colorful Fill icons. Define a layered mapping:

1. Open-Meteo WMO weather code → semantic condition.
2. Semantic condition plus day/night → explicit icon identifier.
3. Condition → localized human-readable description.

Include all documented Open-Meteo forecast weather codes (`0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 97, 99`) and an unknown/missing fallback. Map hourly `is_day` explicitly; daily forecast icons may use day variants.

Verify every actual icon name against the installed package, not just naming conventions. Add tests ensuring complete WMO coverage and successful icon lookup. Keep UnoCSS class references literal and extractable, using `// @unocss-include` when the source file otherwise would not be scanned. Avoid dynamically constructing class names.

## 5. Photos mode

- Display photographs fullscreen with configurable `contain`/`cover` behavior and preserved aspect ratios.
- Default slideshow interval: approximately 20 seconds, configurable later.
- Shuffle the album and avoid immediate repeats.
- Use smooth, restrained transitions; optionally show a minimal clock.
- Preload a small number of subsequent images without downloading or decoding the entire collection.
- Show a useful empty-state message if no photos are available.
- Reload the catalog periodically (initially every 1–5 minutes) so new uploads appear without restarting the display.
- Use appropriate browser caching without exposing private image responses to public/shared caches.
- Continue with cached photos during temporary outages when available.

## 6. Photo administration and uploads

Two people administer the collection initially; adding a third household contributor is a possible future enhancement. No general invitation system is required now.

### 6.1 Admin interface

Provide a private `/admin/photos` experience that allows administrators to:

- Upload single or multiple photos.
- Browse the catalog and thumbnails.
- Delete images, with confirmation.
- Review possible duplicates.
- View basic dimensions, size, upload date, and storage usage.

Optional future features include favorites, captions, and approval workflows. Avoid building albums or folders before needed.

### 6.2 Client-side upload pipeline

For each selected original:

1. Decode in the uploading browser, honoring image orientation.
2. Compute SHA-256 from **original file bytes** for exact duplicates.
3. Compute a normalized 64-bit perceptual hash (initially dHash) from decoded pixels.
4. Compare with existing photo metadata, identifying byte-identical files and visually similar images.
5. Allow human review of perceptual matches; do not automatically discard similar pictures.
6. Resize without upscaling, preserving aspect ratio, with maximum long edge approximately 1600 pixels.
7. Encode as WebP at approximately 0.82 quality; verify resulting MIME type and handle unsupported encoding.
8. Strip unnecessary metadata, especially location metadata.
9. Upload the optimized image and validated metadata via an authenticated endpoint.
10. Refresh the catalog and report per-image success or failure.

Process sequentially or with very limited concurrency on iPhones to prevent memory pressure. Preserve originals in the existing Apple/Google photo library; the dashboard is not an archival backup.

**Clipboard handoff, 25 October 2026:** The owner accepted the PNG-normalized
Shortcut → browser Paste route after the actual iPhone three-photo test. For this
route, “original file bytes” above means the PNG representation delivered to the
browser, before browser resizing/WebP encoding, rather than the photo-library
original. Byte identity across picker and Shortcut routes is not promised;
perceptual matching retains human review. No server image conversion is added.

### 6.3 Duplicate detection

- SHA-256 detects exact source-file duplicates.
- dHash plus Hamming distance detects visually similar resizes/re-encodings.
- Keep similarity thresholds configurable and test with representative family-photo examples.
- Store fingerprints in photo metadata; list metadata independently of the image binaries.
- Client-side comparison is appropriate for the expected few hundred or thousand images.
- KV is eventually consistent and check-then-upload is non-atomic; use deterministic IDs/idempotent writes where possible and provide safe retries. Do not claim hard guarantees against concurrent duplicates without an atomic coordination mechanism.

### 6.4 Suggested logical model

```ts
interface PhotoMetadata {
  id: string;
  sha256: string;
  perceptualHash: string;
  uploadedAt: string;
  uploadedBy: string;
  width: number;
  height: number;
  contentType: 'image/webp';
  size: number;
  favorite?: boolean;
}
```

Exact persistence details should be chosen during implementation.

### 6.5 Storage

Use **Cloudflare Workers KV Free** initially for optimized image bytes and metadata. Prefer one image record plus associated metadata, and a paginated catalog API that avoids loading all binaries. Plan around eventual consistency, operations quotas, the free 1 GB storage allowance, and per-value limits. Add storage accounting and warnings well below the limit.

Workers should validate and store already optimized images rather than decode or transform originals. Do not enable usage-billed photo services merely because they have a free allowance.

### 6.6 iOS Share Sheet (later)

Eventually support **Photos → Share → Send to Family Frame** through Apple Shortcuts. Reuse the upload API, but recognize that Shortcuts do not share a browser's admin cookie automatically. Design a scoped, revocable upload token or secure authenticated handoff. Never embed broad admin credentials in the Shortcut.

## 7. Home mode and future integrations

Begin with a placeholder or limited household information display. Later consider Philips Hue, selected HomeKit devices, connected thermostats, music controls, and calendars.

A Cloudflare Worker cannot directly call a private LAN-only Hue Bridge. A future local relay, supported remote API, or properly authenticated integration may be needed. No generalized Home Assistant infrastructure is required initially.

## 8. Configuration

Ultimately, the admin UI should manage location, timezone, schedules, slideshow timing, display preferences, and connected services. Start with checked-in **example/default configuration** where persistence is not yet needed.

Distinguish:

- **Public defaults:** non-sensitive configuration suitable for the repo and frontend.
- **Private deployment configuration:** household identifiers, potentially sensitive URLs, network allowlists, and service settings; keep outside the public repo.
- **Secrets:** tokens, keys, and signing material; never expose to browser JavaScript or source control.

Use Cloudflare Worker secrets for runtime credentials, GitHub secrets for CI/CD credentials, and ignored local development secret files. Treat shared-album URLs as potentially sensitive bearer links and do not rely on obscurity to protect them.

## 9. System architecture

```text
             Public GitHub repository
                       |
                  GitHub Actions
                       |
                       v
             Cloudflare Workers Free
       +-----------------------------------+
       | Astro / UnoCSS static assets      |
       | Worker API                        |
       | Secrets, auth, authorization      |
       +-----------------+-----------------+
                         |
                      KV Free
                Photos + metadata
                         |
      +------------------+------------------+
      |                  |                  |
 Dragon Touch        Mac browser        iPhone browser
  read-only          admin/display      admin/uploads
      |
  Optional future local Hue integration
```

The app uses a single Astro codebase with a Workers-backed API, avoiding unnecessary microservices, traditional servers, SSR, and databases. Static routes are preferred; lightweight Workers handle protected data, secrets, and mutations. Hosting on `workers.dev` is fine. Any device with a browser may display the UI; private data remains protected independently of where the site is hosted.

### 9.1 Proposed API surface

| Method | Path | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/api/weather` | Optional weather proxy | Public |
| GET | `/api/config/display` | Display-safe settings | Display/admin |
| GET | `/api/photos` | Photo metadata catalog | Display/admin |
| GET | `/api/photos/:id` | Authenticated image delivery | Display/admin |
| POST | `/api/photos` | Upload optimized photo | Admin |
| DELETE | `/api/photos/:id` | Delete photo | Admin |
| GET/PATCH | `/api/config` | Admin configuration | Admin |

Routes are proposals, not immutable contracts. Validate content type, encoded size, dimensions, hashes, identifiers, and authorization at the Worker boundary. Return consistent errors and cache controls. Never trust client-computed hashes as a security boundary. Avoid secret-bearing URLs or public links to private photos.

## 10. Authentication, authorization, and privacy

### 10.1 Two roles

- **Administrator:** Two independent identities, authorized for photos/settings management.
- **Display:** Read-only access to the approved photos and display configuration, with a revocable credential.

### Dashboard access and private data

The dashboard HTML shell and static assets may be public. Anonymous visits show only public example defaults, weather and non-private placeholders. Photos (including thumbnails and catalog metadata), household settings and any future calendar entries must never be embedded in public HTML, prerendered output, static assets or client bundles. Load private content only through Worker-authorized endpoints; protecting `/api` is sufficient only while every private read and mutation passes through that boundary, including image delivery and any future calendar integration.

| Visitor | Public dashboard shell | Private dashboard content | Administration |
| --- | --- | --- | --- |
| Approved, authenticated administrator on any network | Allowed | Allowed | Allowed |
| Provisioned frame with a valid display credential on the approved home network | Allowed | Read-only, approved display data | Denied |
| Display credential outside the approved home network | Allowed | Denied | Denied |
| Anonymous visitor, including on the home network | Allowed | Denied | Denied |

Administrators must be able to view the ordinary dashboard, including its private photos and future approved calendar content, remotely after signing in; access is not limited to administration pages. Home IPv4/IPv6 restrictions apply to display credentials, not authenticated administrators. A home IP alone never grants private access. The display cookie may remain scoped to `/api`; the public shell does not require a credential or home IP. Future private endpoints outside `/api` require equivalent server-side authorization. Private responses must not enter public/shared caches. API denial clears private content and shows a sign-in/provisioning state; existing bounded offline retention rules still apply.

Cloudflare Access is an authentication candidate, but its suitability for two human users, free-tier limitations, and interaction with Worker routes should be validated before selection. Avoid implementing a password database unless necessary.

**Security sequencing:** Admin authentication and authorization checks must be present before any private upload or photo endpoints are exposed on a public deployment. M4 later completes the broader security and device-provisioning workflows; it does not postpone basic protection until after M3.

### 10.2 Display credential

Use a high-entropy revocable credential scoped to read-only resources. The Android display must never hold an administrator session or broad third-party API token.

Add defense-in-depth network restrictions for the home's verified full-stack IPv4 address and, if necessary, an IPv6 prefix. Keep addresses private, configurable outside source control, and easy to update when Free changes them. An IP allowlist does not replace credential checks. Do not assume that IP-based restriction uniquely identifies a device.

Browser image requests need a workable authentication transport: ordinary `<img>` elements cannot set arbitrary Authorization headers. Evaluate a narrowly scoped Secure/HttpOnly cookie established through a protected provisioning flow, or authenticated `fetch()` plus blob URLs with memory/cleanup constraints. Never place a reusable credential in URL query parameters. Verify the mechanism on Firefox/GeckoView on the actual Android device.

### 10.3 Boundary and threat model

- Assume the Android 6 device could be compromised; limit what it can read and revoke credentials when needed.
- Restrict admin mutations and private reads at the Worker, not only through hidden UI controls.
- Use HTTPS everywhere and do not expose secrets in client bundles, logs, error messages, or version control.
- Avoid public CDN caching of private photo responses; set suitable authorization-aware response headers.
- Consider a separate IoT network for the frame.
- Treat shared album links as bearer-style secrets when applicable.
- Minimize photo EXIF and other personal metadata.
- Preserve ability to replace the frame without rearchitecting the application.

## 11. Reliability and offline behavior

- Continue displaying time and locally held UI state if offline.
- Show cached weather with a clear stale indication when live data is unavailable.
- Rotate cached photos where practical and don't blank the frame after a transient error.
- Retry network failures with bounded backoff.
- Avoid repeated large downloads after reconnection.
- Use a service worker if compatible with the target Android browser and caching/privacy requirements; test on hardware.
- Recover from invalid responses, KV quota failures, empty photo collections, and expired sessions.
- Aim for `power on → Android boots → kiosk opens → scheduled mode displays`, while providing manual launch as a fallback until hardware support is confirmed.

## 12. Performance and cost constraints

**Hard requirement: €0 recurring infrastructure expense, with no automatic overage billing.**

Planned services: Workers Free, Static Assets, KV Free, Open-Meteo noncommercial API, and optionally free `workers.dev` URL. Avoid enabling R2, Images, paid Workers, usage-based AI, paid monitoring, or other services that may bill automatically without specific approval.

Verify exact Cloudflare quotas and terms when implementing. As a planning baseline, Workers Free has 100,000 requests/day and 10 ms CPU time per invocation; KV Free has 1 GB stored data plus daily read/write/list quotas. Free-tier exhaustion should fail gracefully, not lead to a paid upgrade.

- Do image decoding, resizing, WebP compression, and perceptual hashing on the uploading phone/browser.
- Keep Worker endpoints lightweight, with minimal CPU and memory overhead.
- Prefer static Astro and selective hydration rather than full SPA or unnecessary SSR.
- Bundle small SVG assets locally and avoid runtime icon CDN dependencies.
- Use minimal photo preloading and memory-conscious image transitions.
- Show storage consumption, warn early, and never silently delete photos to reclaim quota.
- No separate R2 bucket or D1 database unless justified and consistent with the hard cost limit.

## 13. Visual design and localization

- Visual direction: clean, modern, scenic Annecy-inspired background, restrained translucent panels, strong hierarchy, colorful Meteocons, informative but uncluttered graphs.
- Morning mode prioritizes current temperature, today's high, current/upcoming rain, and hourly temperature progression.
- Photo mode prioritizes the image itself, not controls or data density.
- Future household automation can add a dedicated touch-oriented mode when needed.
- Prefer accessible semantic HTML and sufficient contrast/touch targets.
- Initial locale: French, with architecture ready for English. Use `Europe/Paris`, Celsius, metric units, and 24-hour clock; separate labels/descriptions for localization.

## 14. Testing and quality

### 14.1 Unit tests

Cover exhaustive WMO mapping and valid Iconify names, weather descriptions, mode scheduling (including DST), temporary overrides, SHA-256/dHash behavior, metadata validation, and authorization decisions.

### 14.2 Integration tests

Cover Open-Meteo error handling, KV catalog/image upload/delete behavior, authorization rejection, image-delivery authentication, malformed/oversized uploads, duplicate retries, storage failures, and stale data.

### 14.3 Browser tests

Use Playwright or equivalent with a 1280 × 800 viewport for the morning view, photo mode, touch navigation, and admin uploads. Also test mobile and desktop. Modern desktop Firefox tests do **not** substitute for tests on the actual Android browser version.

### 14.4 Hardware tests

Continue non-destructive discovery from the supplied Classic 10 results, then follow the [M6 hardware plan](hardware/implementation-plan.md) for verified private backup, browser support, WebP/SVG rendering, memory/CPU constraints, startup, Wi-Fi recovery and extended stability. The [backup runbook](hardware/backup-and-recovery.md) distinguishes captured bytes, verified backups and unproven restore capability. No firmware/system changes without a usable recovery path and explicit authorization.

## 15. Development and repository workflow

Public GitHub repository. Keep code, docs, example configuration, and a deployment guide public. Keep household-specific addresses, API tokens, photos, and deployment secrets private. Other developers may clone and independently deploy, but onboarding support is not an initial priority.

Proposed structure:

```text
/
├── docs/
│   ├── technical-specification.md
│   └── decisions/
├── public/
├── src/
│   ├── components/
│   ├── layouts/
│   ├── pages/
│   ├── lib/
│   │   ├── weather/
│   │   ├── photos/
│   │   ├── auth/
│   │   └── dashboard/
│   └── styles/
├── tests/
├── .github/workflows/
├── astro.config.mjs
├── uno.config.ts
├── wrangler.jsonc
├── package.json
└── README.md
```

Use strict TypeScript, consistent formatting/linting, Vitest, browser tests, and Wrangler. Choose exact dependency versions in implementation planning. CI should run types, lint, tests, and build before deployment. Store CI credentials in GitHub secrets or use short-lived credentials where supported. Do not leak credentials or private settings in build logs.

Record significant design changes as architecture decision records. Keep an implementation plan separate from this requirements specification.

## 16. Milestones and acceptance criteria

### M1: Foundation

**Deliverables:** Astro project, TypeScript, UnoCSS/Meteocons, Cloudflare Workers Free deployment, shell/layout, navigation foundation, CI, documentation, local/prod environment configuration.

**Done when:** Builds and deploys on the free tier; works on mobile and desktop; renders a 1280 × 800 mock dashboard; no credentials are committed; no paid infrastructure is enabled.

### M2: Weather

**Deliverables:** Open-Meteo adapter, morning UI, hourly temperature/rain chart, complete icon mapping, deterministic summaries, refresh/cache behavior.

**Done when:** WMO mapping and actual icon names are tested; day/night icons work; weather displays gracefully during errors; 1280 × 800 view is readable; API usage fits free terms.

### M3: Photos

**Deliverables:** Protected KV-backed catalog, optimized upload workflow, exact and perceptual duplicate detection, admin photo management, basic slideshow.

**Security prerequisite:** Add necessary authentication/authorization **before** the publicly deployed photo APIs go live; do not defer that protection to M4.

**Done when:** Admins can upload and delete; non-admins cannot; private photos are inaccessible anonymously; images are resized to WebP; duplicate checks and safe retries work; slideshow picks up new uploads; storage use is visible.

### M4: Security and administration

**Deliverables:** Final admin identity mechanism for two people, read-only display provisioning, home IP restrictions, credential rotation/revocation, persisted settings as needed, authorization and recovery tests.

**Done when:** Both admins have independent access; the display has no mutation rights; off-network display-token requests are rejected; keys aren't in the browser bundle; authentication survives kiosk restarts; revoked keys stop working.

### M5: Display behavior

**Deliverables:** Morning, Photos, Home, Night; configurable schedules; touch navigation; temporary manual override; photo transitions; offline fallback.

**Done when:** Scheduled mode transitions work, including DST; manual override expires correctly; kiosk views don't scroll at 1280 × 800; routine outages don't blank the app.

### M6: Dragon Touch integration

**Deliverables:** Hardware inspection, verified private firmware backup with recovery limitations, compatible browser/kiosk, fullscreen deployment, automatic launch where feasible, network recovery, performance/stability testing, setup instructions. See [H1–H8 hardware breakdown](hardware/implementation-plan.md) for actual stage status; H1 and H2 are accepted; H2 has explicit owner exceptions for encryption and single-copy retention, documented in its execution record. M6 is not complete.

**Done when:** Dashboard fits native screen; touch and media work; protected images authenticate without admin login; restart behavior is documented; extended run is stable. If this frame is unsupported, document blockers and retain usable browser app.

### M7: Convenience and smart-home integrations

**Potential deliverables:** iPhone Share Sheet shortcut, Hue control, calendar, HomeKit-adjacent integrations, official weather alerts, additional widgets.

**Done when:** Each added integration has explicit security, reliability, compatibility, and €0-cost validation.

## 17. Operations, recovery, and risks

- Use available Cloudflare Free metrics/logging without logging personal photos or secrets.
- Handle weather-provider failure and KV quota exhaustion gracefully.
- Provide an eventual export path for configuration/metadata and optimized photos; originals should remain in personal photo libraries.
- Maintain dependencies without accidentally breaking the older Android browser target.
- Document how to rotate credentials, authorize a new home IP, and provision/revoke a frame.

| Risk / open question | Approach |
| --- | --- |
| Classic 10 hackability / CPU / RAM / Android version | Inspect once delivered; no assumptions from Modern10 Charm |
| GeckoView and kiosk startup | Verify on hardware; manual browser fallback |
| Old Android security | Restricted credential, IP restriction, network isolation |
| Human admin authentication | Evaluate Cloudflare Access and alternatives during M3/M4 |
| Display image authorization | Prototype cookie vs authenticated fetch + blob URLs |
| KV eventually consistent / non-atomic operations | Idempotent writes, paging, retries, clear UI feedback |
| KV 1 GB ceiling | Client optimization, storage dashboard, explicit quota handling |
| iOS Shortcut auth | Dedicated restricted credential or authenticated web handoff |
| Hue access from hosted site | Later local bridge/relay design |
| Nighttime hardware brightness/sleep | Verify device capabilities |
| French/English UI | Localizable architecture; French default |

## 18. Design principles

1. **Keep it small.** One Astro application and a limited number of Cloudflare resources.
2. **Build for this household first.** Public code does not imply a multi-user hosted platform.
3. **Secure private data at the backend.** Hiding links in UI is not access control.
4. **Keep the frame replaceable.** Browser application first, device integration second.
5. **Respect the free-tier boundary.** Prefer a failed request over an unexpected bill.
6. **Prefer simple, portable browser APIs.** Work within older hardware capabilities.
7. **Deliver incrementally.** Each milestone remains demonstrable and testable.
8. **Separate requirements from implementation plans.** Codex can refine details without changing core constraints.

## 19. References

- [Wes Bos: Photo Frame Dashboard](https://github.com/wesbos/photo-frame-dashboard)
- [Astro documentation](https://docs.astro.build/)
- [UnoCSS documentation](https://unocss.dev/)
- [UnoCSS extracting classes](https://unocss.dev/guide/extracting.html)
- [Iconify](https://iconify.design/)
- [Meteocons](https://meteocons.com/)
- [Open-Meteo forecast API](https://open-meteo.com/en/docs)
- [Open-Meteo usage terms](https://open-meteo.com/en/terms)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [Workers KV](https://developers.cloudflare.com/kv/)
- [Workers KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/)
- [GitHub Actions](https://docs.github.com/en/actions)

---

**Companion document:** [Implementation plan](implementation-plan.md), covering upstream provenance, security decision gates, tasks, and milestones. Begin with M1 rather than attempting all milestones in one pass; pin and record concrete dependency versions at the M1 tooling gate.

## Calendar display refinement — 21 October 2026

The owner requests the shared Family and spouse's massage calendars through the existing
Google connection. Display up to three remaining events per calendar in a single chronological
list beside weather advice: Family on a pastel red background and Massages on a pastel violet background, with
dark text and visible source labels on every event.
Use available bottom space by floating desktop navigation on demand. Keep attribution
and forecast-methodology links in smaller secondary text. Preserve private access,
short-lived in-memory display data, and read-only Google scopes. This refines the
existing owner-requested M7 calendar slice; it does not change hardware acceptance.
