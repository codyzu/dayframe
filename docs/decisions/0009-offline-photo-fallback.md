# ADR 0009 — A small web fallback for offline photos

Date: 22 October 2026. Status: architecture and offline policies accepted by the
owner; phases 1–4 implemented locally. Phase 2 implements the persistent store
and live slideshow integration described in [photo operations](../photos.md#persistent-photos--m5o2-22-october-2026). No deployment or device change is included.
O3/O4 browser evidence and activation/retirement controls are recorded in [photo operations](../photos.md#standalone-fallback-and-navigation--m5o3o4-22-october-2026). Ordinary builds keep navigation/update activation disabled pending O5. Phase 5 remains planned.

## Context and scope

The owner wants photos to survive disconnects and offline cold starts, without
running the full dashboard offline. Weather and appointments can become misleading
when disconnected. Caching the complete Astro application would also introduce an
unnecessary release/cache coordination burden.

Before O2, `src/lib/photos/slideshow.ts` held only the current and next decoded photo.
An authorized catalog/image response renews a five-minute privacy lease. Authorization
denial, lease expiry, hiding or leaving Photos releases private images. There was no
persistent photo store or service worker. [ADR 0005](0005-display-scheduling.md) and
[photo operations](../photos.md) record that historical behavior. O2 now supersedes its persistence/lease bounds
for automatically retaining authorized Photos browsers; browsers without usable persistent storage retain the five-minute baseline.

## Selected architecture

- Keep the live Astro dashboard and its assets on their existing network path. Do
  not precache dashboard HTML, JavaScript, weather, vigilance, appointments or APIs.
- Add one self-contained offline HTML document with minimal inline JavaScript/CSS,
  system fonts, a slideshow, connection status and retry. Generate it through the
  existing build; no external runtime dependencies. Inline code needs an explicit
  compatible CSP, preferably build-generated hashes rather than relaxed script policy.
- A small service worker handles only allowlisted same-origin dashboard GET
  navigations. Try the network with a bounded timeout; on transport failure/timeout,
  return the saved fallback. Let all other requests use normal browser handling.
  This does not disable ordinary HTTP caching; the worker adds no live-app cache.
- Serve the fallback at the requested dashboard address, preserving frame parameters.
  Do not redirect the kiosk to a new top-level `/offline` path. Admin, setup, API,
  other paths and unrecognized query variants are excluded from interception.
- Store optimized WebP blobs and minimal display metadata in IndexedDB, shared by
  the live slideshow and offline document. Cache Storage contains only the public
  fallback document. Photos never enter shared/CDN caches or the public build.
- Automatically retain photos in every authorized browser using the live Photos
  slideshow, including signed-in administrators and ordinary dashboard URLs. No
  opt-in, frame profile or role gate is required. The private API remains the access
  boundary: only successful authenticated reads can fill or renew the collection.
  This owner-approved revision on 22 October 2026 supersedes the original explicit
  dedicated-display opt-in policy.
- Preserve the current/next limit for decoded images and revoke object URLs when
  replaced. Disk capacity is independent of RAM usage.
- Use existing Workers/KV and local browser storage. No new billed service, native
  photo store, native synchronization bridge or additional hosting is required.

This uses the browser's [navigation fallback pattern](https://web.dev/articles/offline-fallback-page),
not an offline copy of the full application. It still requires an initial online
installation and photo synchronization; a never-provisioned device cannot start an
offline collection.

## Playback, synchronization and privacy contract

Start persistence after a complete successful authorized catalog read; save only
photo bytes received through successful authorized reads. Reuse an existing valid
collection during outages. Browsers with no authorized collection show the ordinary
empty/retry state. There is no separate consent control or device-role classification.
Store photo IDs, blobs, dimensions/size and the smallest required playback/retention
metadata; exclude source fingerprints, uploader identities, credentials, calendar
entries and full household settings. Persist fit/interval separately. Offline playback
does not use Night hours or timezone settings; do not persist private day profiles,
schedules or official-calendar responses for the fallback.

Fill a bounded shuffled subset gradually with limited concurrency; do not fetch or
decode the entire remote collection at startup. Refresh the complete paginated
catalog before treating an absent ID as deleted. Retain valid entries through
incomplete refreshes/downloads and commit completed writes atomically. Evict only
local copies to meet the approved budget; never delete server photos to reclaim
local space. Offline copies are disposable and are not a backup.

The live Photos view can rotate stored images during a disconnect and after a mode
transition. A cold offline start runs only the fallback slideshow, never stale Morning
weather or appointments. Offline playback shows photos at all hours, including hours
that would select Night online. The online schedule remains unchanged. Empty/unavailable storage
shows a useful retry state. A corrupt image is skipped without losing the collection.

An observed private-API 401/403, explicit logout, reprovisioning or lease expiry
invalidates playback immediately and clears the local private collection.
Cleanup failures must leave playback denied and be retried; another open tab must not
keep displaying already-loaded photos after local invalidation. A cached photo must
never mask a denial by pretending the request succeeded.

Transient transport failures do not clear the collection while the approved offline
lease remains valid for seven days since the last successful authenticated
photo/catalog response. This is the last time the display was online and its photo
access was verified, not merely when Wi-Fi connected or the internet became reachable.
Only that successful authorized verification renews the lease, not public health
checks, worker updates, local reads or failed attempts. After expiry,
release decoded photos, block playback and clear private storage when execution is
available. A suspended or powered-off browser cannot execute deletion. Remote
revocation, home-network changes and server deletions cannot reach a disconnected
device: bounded offline retention deliberately extends local readability beyond the
current five minutes. The owner accepted this seven-day tradeoff on 22 October 2026.

Across a restart, monotonic elapsed time alone cannot establish retention age.
Reject implausible/backward wall-clock states and require online verification when
age cannot be established safely; use wall/monotonic checks while running. An offline
lease is not protection against root access or deliberate device-clock/storage
tampering. The Classic 10's clock/profile initialization gate remains intact.

Request storage persistence where supported, report whether it was granted and
handle denial, quota exhaustion and eviction. Browser-managed storage cannot promise
permanent availability. See [Mozilla's storage limits and eviction guidance](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

## Network recovery and updates

Use actual same-origin requests, not `navigator.onLine` as proof of connectivity.
The existing public `/api/health` can indicate reachability, but it cannot authorize
offline photos. Require expected response content; redirects/captive portals are not
healthy Dayframe. Apply backoff and avoid repeated navigation loops on weak Wi-Fi.

The navigation fallback handles rejected fetches/timeouts, not all unsuccessful
application states. Preserve 401/403 and other HTTP errors by default; do not turn
security/certificate failures into authorization success or weaken native TLS policy.
A small live-page startup guard must also cover HTML succeeding while critical
scripts fail. It must enter the saved fallback without requiring a forbidden kiosk
URL. Prove the chosen mechanism in phase 4 rather than assuming navigation alone
covers partial loads. On reconnection, return to the live dashboard and revalidate
private access; do not present cached weather/appointments during the transition.

Keep one stable service-worker URL. Version only its fallback cache and install a
replacement completely before activation. Failed installation retains the previous
working version. Because the worker never serves versioned dashboard assets, dashboard
deployments need no matching service-worker release. Fallback document and IndexedDB
schema must remain compatible across old/new open pages; destructive migrations need
separate review. Choose controlled activation/reload behavior in phase 4, accounting
for an always-open frame. Include worker retirement/unregistration and cache cleanup
in recovery validation; removing its registration code alone does not remove an
already installed worker. [Service-worker lifecycle](https://web.dev/articles/service-worker-lifecycle).

## Owner decisions accepted — 22 October 2026

The owner accepted the following policies. These replace the initial proposals and
close the phase 1 policy gate. O2 implements the persistent-photo portion locally;
standalone fallback/navigation now have local browser evidence; actual-device acceptance remains phase 5.

| Decision                | Accepted policy                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Automatic retention     | Every authorized browser using Photos, including signed-in admins and ordinary dashboard URLs; no opt-in or frame/role gate.                                                                |
| Offline retention       | Seven days since the last successful authenticated photo/catalog response. Being online means reaching Dayframe and verifying photo access; connectivity alone does not renew retention.    |
| Local collection budget | At most 100 photos and 100 MB (100,000,000 bytes) of encoded photo bytes, whichever is reached first; reduce if device capacity requires it. This is separate from the server KV allowance. |
| Night behavior          | Show photos at all times while offline, including cold starts. No offline Night screen or saved Night schedule. Online scheduling remains unchanged.                                        |

No owner policy decisions remain open for phase 2. Invalid/expired retention and
untrustworthy clock states still block private playback with a minimal retry state;
these are access/recovery states, not a scheduled Night screen.

Other implementation details (retry timings, database/cache names and deterministic
test fixtures) can be resolved within the selected architecture and documented with
evidence; they do not require a new product decision.

## Delivery and acceptance

The [M5 offline extension](../implementation-plan.md#m5-offline-extension--22-october-2026)
defines five independently reviewable phases: contract; persistent photo store;
standalone fallback; navigation-only worker; actual-device integration. Phase 1 is
complete, including the accepted retention, budget and continuous offline playback
policies. Phases 2–4 are implemented locally; their browser evidence is in the plan.
Activation on the actual frame still requires phase 5.
Do not claim cold-start support after phase 2 alone.

The existing native `AddressPolicy` permits only root display/setup URLs, while
`heartbeat.js` expects dashboard mode/panel/clock signals. Phase 5 must explicitly
recognize healthy offline slideshow and empty/expired retry states without
misreporting authorization denial or creating supervisor restart loops. Do not fake
the full dashboard DOM merely to satisfy the old probe. The accepted Classic 10
baseline is Android 6.0.1/API 23, board `exdroid`, firmware
`Classic10_A33M187_20250910-1617_V09`, GeckoView 143 with retained Firefox 143.0.4
fallback; recheck actual installed identity/version before device work.

Browser tests establish web behavior only. GeckoView service-worker interception,
storage retention, clock handling and native supervision require physical evidence.
Refresh device research/issues before that work; installation, restart and power
tests require their specific authorization. No hardware action is authorized by
this ADR. Prior hardware/security/soak deferrals remain open.

## Upstream review and deliberate differences

Re-read the saved Wes Bos checkout at
[`f1e0820918c926396e0ccafb4839568825f63edc`](https://github.com/wesbos/photo-frame-dashboard/tree/f1e0820918c926396e0ccafb4839568825f63edc)
on 22 October 2026: root `LICENSE`, `dashboard/js/slideshow.js`,
`dashboard/js/views/photos.js` and `dashboard/kiosk/README.md`. This is the available
pinned reference, not a claim that current upstream HEAD was resolved. Online reads
of these pinned files failed in this session; review used the local checkout.

Retain upstream's fullscreen priority, shuffled selection and explicit start/stop
lifecycle as ideas. Its slideshow's broken-image fallback is not evidence of durable
offline storage. Deliberately omit collage/polaroid layouts, unbounded history,
remote demo image sourcing and the kiosk guide's APK-bundled-site route. Independently
design authenticated local photo storage and a minimal browser navigation fallback.
The root license at this revision is MIT, Copyright 2026 Wes Bos; copied substantial
source would require its notice. No upstream source/assets are copied in this
documentation slice. Earlier no-license findings apply to their older revisions.

## Automatic retention revision — 22 October 2026

The owner explicitly approved caching in all authorized browsers, including their
signed-in admin browser. This replaces both the original opt-in policy and the
subsequent proposed frame-only alternative. Authorization already controls delivery
of private bytes; there is no additional browser eligibility check. The existing
seven-day/100-photo/100 MB lease, bounded gradual writes, complete-catalog deletion,
logout/denial clearing and cold-start/device limits remain.

The live slideshow initializes the existing schema only after an authorized full
catalog succeeds. Prior valid opt-in collections remain usable under their existing
lease. After local invalidation, a later authenticated full refresh automatically
starts a fresh collection. A revision check fences authorization attempts that
started before logout/denial, and pending writes retain their token fence. Starting
a valid collection in another tab is no longer treated as an access denial. No
server API, role header, permission scope, binding or dependency is added. Admin
management previews keep their short memory lifetime; the Photos slideshow is the
component filling the shared durable collection.
