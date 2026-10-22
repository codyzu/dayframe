# Photo operations

M3 photo administration is active in production as of 16 October 2026, with a dedicated KV namespace, an Access application for `/admin/*`, and one privately configured administrator. Display provisioning has since passed on the actual Classic 10; a second administrator remains deferred. Configuration remains fail-closed. See [ADR 0002](decisions/0002-protected-photos.md) for the identity model and consistency limits.

M4 update: [administration operations](administration.md) supersedes prototype display-token and pending-settings instructions below. M4 is deployed with partial live acceptance; see the [current status and validation gaps](status.md). The final credential is stored as a digest in a strongly consistent SQLite Durable Object; display requests require the private home-network allowlist.

## Local acceptance

`pnpm verify` builds the app, tests contracts/auth/storage, and runs browser flows. Integration tests use Wrangler's real **local** KV runtime; loopback sockets are required. Browser photo tests run a separate local HTTPS server on 8789 with ephemeral self-signed TLS and RSA keys and synthetic identities `one@example.test` / `two@example.test`. Only the JWKS network response is substituted; the real Worker handler verifies signatures and operates on local KV. The ordinary preview on 8788 remains photo-disabled. Test routes `/__test/*` exist only in the Node test harness, never the deployed Worker. Its code and synthetic keys are not included in production builds. OpenSSL must be available (macOS and Ubuntu CI provide it). No live Access account, private photos or Cloudflare credentials are required for tests.

For interactive synthetic testing after `pnpm build`, run `node --experimental-transform-types tests/fixtures/photo-server.ts` and open `https://127.0.0.1:8789/__test/login`, then `/admin/photos`. Accept the temporary local certificate warning. `__test/display` exchanges a generated test display credential through the actual Worker endpoint. Stop the server to discard local KV and keys. Never expose this harness to a network or deploy it.

## Production activation checklist

1. Verify the target account still uses **Workers Free** and choose **Zero Trust Free** explicitly. Do not upgrade a plan or enable an automatically billed service. [Workers KV pricing](https://developers.cloudflare.com/kv/platform/pricing/) currently provides 1 GB, 100,000 reads/day and 1,000 writes, deletes and lists/day. Exhausted free operations fail; they do not justify enabling paid usage.
2. Create a dedicated Workers KV namespace. Store its ID in the GitHub `production` secret `DAYFRAME_PHOTOS_NAMESPACE_ID` and, for local deployment, ignored `private/photos-namespace-id.txt`. `node scripts/prepare-production.mjs` reads the pinned Wrangler parser’s production configuration and generates ignored `private/wrangler.production.jsonc` with the `PHOTOS` binding. Deploy that generated config without `--env` because it already resolves production naming and settings. The workflow supplies the namespace ID only during upload and fails if it is missing or malformed; never deploy the unbound base config over the activated Worker. Keep account/namespace IDs outside the public repository. Retain the existing assets and stage configuration. No R2, Images, D1 or Durable Object is required. The existing CI token may lack KV provisioning/configuration permission; use account setup by the owner rather than expanding the deployment token indiscriminately.
3. Configure a self-hosted Access application on the exact production hostname, `/admin/*`, with the two administrators' independent identities, a precise email allow policy, and seven-day sessions. Set the application session duration to **7 days** and its Allow policy duration to **Same as application** (or explicitly **7 days**). The Worker accepts signed tokens up to seven days old and always enforces their signed expiry; changing Worker code alone cannot extend a token issued with a shorter expiry. Existing sessions need a fresh sign-in to receive the new duration. See [Cloudflare session management](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/). Set `ACCESS_TEAM_DOMAIN` to `https://<team>.cloudflareaccess.com`, `ACCESS_AUD` to that application's audience, and `ADMIN_EMAILS` to the comma-separated addresses via Worker secrets/private configuration. Never trust an unsigned identity header. Keep `/api/photos*` and `/api/session*` outside interactive Access policies so read-only displays work; all private APIs are enforced in the Worker. Confirm that the signed same-host `CF_Authorization` cookie is scoped so it reaches `/api`, including after a fresh login.
4. Deploy with `PHOTOS_ENABLED` absent or `false` first. Confirm `/api/photos` still returns JSON 404/no-store and public weather remains usable. After the binding, policy and allowlist are verified, set `PHOTOS_ENABLED=true`. With missing required bindings or identity configuration, the Worker returns 404. Anonymous requests to enabled private routes return 401; an edge Access challenge may also protect the admin shell. Use synthetic images first. Test both real identities, not only a synthetic signer; check upload/delete/privacy on the deployed hostname and measure Worker CPU against the Free limit before household use.
5. For an M3 display prototype, generate 32 random bytes as 64 lowercase hex digits privately; set only their SHA-256 digest in `DISPLAY_TOKEN_SHA256`. Exchange the source credential through an HTTPS same-origin POST to `/api/session/display`, using `Authorization: Bearer <credential>`, `Origin` and `X-Dayframe-Request: 1`. Do not store it in source, terminal history, URLs, localStorage, or logs. This is an API prototype; M4 supplies the household provisioning UI, per-device rotation/recovery and home network restrictions. Verify `Secure`, `HttpOnly`, `SameSite=Strict`, `/api` path and image delivery on the real browser. The one-day cookie lifetime does not revoke the source credential; rotate/remove the digest and deploy to revoke it, allowing runtime propagation. Do not put an admin session on the frame.
6. The production smoke script now expects `/admin/photos` to redirect to Access, anonymous catalog/session/image reads to return 401, and a headerless upload to return 403. It still verifies public HTML and health and rejects shared caching of APIs. Authentication settings and `PHOTOS_ENABLED=true` are Worker secrets, preserved across uploads; the namespace ID is injected through the private generated config. Keep secrets scoped to deployment/runtime, not verification or build steps.

Access domain, audience and allowlisted emails are kept private even when they are not cryptographic secrets. The namespace data is private. Do not commit `.dev.vars`, private Wrangler files, photos or exports. `PHOTOS_ENABLED` is a deployment toggle, not an authorization mechanism.

## Daily operation and quotas

Catalog pages use [KV list metadata and cursor pagination](https://developers.cloudflare.com/kv/api/list-keys/), at 1,000 photos/page. For one always-active display and up to 1,000 photos: 288 list operations/day at five-minute refresh; at most approximately 4,321 image reads/day at twenty seconds (current plus next at startup). Authentication uses no KV reads. Two displays use about 576 lists and 8,642 reads/day, leaving some capacity for admin refreshes. Frequent restarts/manual refreshes, more than 1,000 photos, other namespaces and other account consumers increase those numbers. Three pages on two always-active displays would exceed 1,000 lists/day. Before that scale, adjust cadence/design; do not blindly deploy more displays. Catalog polling stops while hidden or outside Photos mode.

An upload uses one existing-record read and at most one write, plus one catalog refresh per selected batch. An exact server retry reads the existing record but does not rewrite it. Each delete uses one delete and no shared-counter write. Quotas are account-wide; namespace lists and manual administrative operations also count. Avoid repeatedly importing the same source concurrently; KV limits writes to the same key and cannot make check-then-upload atomic.

The admin sums visible metadata sizes with a conservative 1,024-byte overhead per photo. Usage is explicitly an **estimate**, affected by propagation, concurrent changes and other account consumers. The displayed 1,000 Mo is a planning allowance, not reserved capacity. Warning starts at 700 Mo. No exact server-side quota counter is claimed. A failed put never deliberately deletes existing data; errors remain per-file and offer a retry using the original SHA-256 identity. No paid fallback and no automatic photo deletion.

A successful upload/delete may take 60 seconds or more to appear elsewhere. The uploader retains a session-local metadata overlay; a delete is hidden locally immediately. Refresh after propagation to reconcile other sessions. On timeout, retry the same file/action: deterministic identity prevents an extra key. Concurrent upload/delete of the same source still requires human reconciliation because KV is last-write-wins. One key contains bytes plus metadata, so there is no two-key partial-write orphan to repair. If stored metadata becomes invalid, the API reports an error; inspect/export the affected key privately before repair.

## Browser behavior and limits

The upload boundary allows 2 MiB WebP, 1,600px maximum edge. Originals are limited to 40 MiB in-browser and processed sequentially. EXIF orientation is honored, no upscaling occurs, and output has no EXIF, GPS, XMP or ICC profile after sRGB conversion. A bundled WASM encoder handles Safari's absent native WebP encoder, using a temporary worker with timeout and termination. HEIC decoding is browser-dependent; JPEG export is the documented recovery. Actual physical iPhone memory/HEIC testing and representative household duplicate-threshold calibration remain follow-ups; synthetic tests do not establish that coverage.

Slideshow fit defaults to cover. The admin's default fit and interval are supplied by M4 settings at dashboard startup. An explicit dashboard framing choice is saved in this browser under `dayframe.photo-fit.v1` and overrides that household default across navigation, reload and configuration refreshes. Only `contain`/`cover` is stored; with storage disabled the choice survives configuration refreshes for the current page. Clear that local key/site storage to follow the household default again. It rotates around 20 seconds, refreshes metadata every five minutes and keeps at most two decoded images/object URLs. All authorized Photos visits now retain a bounded collection automatically. If persistent storage is unavailable, decoded-image continuity remains bounded to five minutes. Hiding, page exit or mode exit releases decoded images in every profile. M5.O2 adds automatic IndexedDB retention and live offline rotation as described below; images never enter localStorage, Cache Storage or a service worker. Loading the dashboard after a browser restart still requires the live shell and assets; there is no offline cold-start guarantee. The cookie transport works in tested desktop engines/iPhone emulation; actual Classic 10 acceptance is recorded separately in the hardware documentation.

## Activation record — 16 October 2026

Workers plans visibly confirmed Free / $0 / Current plan before creating the dedicated photo namespace. The owner personally completed Zero Trust Free signup after reviewing the checkout’s payment/terms and generic overage authorization. The Zero Trust overview then displayed Zero Trust Free. No Workers upgrade or paid add-on was selected. This records the actual checkout behavior; do not assume Free signup avoids payment details.

Created a self-hosted Access application for exactly the production `/admin/*` path and an explicit single-email allow policy approved by the owner. The app uses a one-hour session, its available Cloudflare identity provider, HttpOnly cookies, and hostname-wide cookie scope so signed API requests receive the cookie. The wildcard app is hidden from the App Launcher; its admin URL remains directly accessible. Identity values and application identifiers remain outside source control. A second administrator can be added later with the owner’s explicit address.

Deployed the KV binding first with photos disabled and confirmed public health 200, photo catalog 404 and admin Access redirect 302. Installed `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, `ADMIN_EMAILS` and `PHOTOS_ENABLED` as Worker secrets. Anonymous production checks then passed: catalog, image and session 401; headerless upload 403; admin redirect 302; public dashboard/health 200. Signing in with the approved Cloudflare identity reached the enabled admin UI, with verified administrator status and an empty KV-backed catalog. No reusable browser credentials were copied into scripts or GitHub. No household photo upload or deletion was performed during setup. The owner can now test those from `/admin/photos`.

Local verification of the deployment wiring passed `pnpm verify`: 50 unit/integration tests, 85 browser checks, 3 existing duplicate viewport skips, types, lint and build. The two existing complexity warnings remain. The private config generator has tests for invalid/missing namespace rejection and retained routing/public configuration. Authentication and the KV binding were also verified on the deployed hostname. Physical-device and sustained CPU acceptance remain separate follow-ups; a successful signed-in catalog request alone is not a CPU benchmark.

## Persistent photos — M5.O2, 22 October 2026

Photos are saved automatically when the live slideshow successfully reads the
complete authenticated catalog and individual images. This works at `/` and
`/?display=frame`, for both provisioned displays and signed-in administrators.
There is no opt-in checkbox, frame gate or role classification. An unauthenticated
visitor cannot fill a collection because the private API rejects its reads.
An existing valid collection can remain readable offline until its lease expires;
logout and observed denial clear it immediately when execution is available.

The browser requests persistent storage where supported, and the existing photo
controls show a read-only grant/eviction status. Permission prompts do not block
synchronization. Visiting administration preserves the shared collection; admin
previews keep their existing shorter memory lifetime. The slideshow, rather than
the management gallery, fills the durable store. Reload the dashboard to load this
policy revision after deployment; no device restart or reprovisioning is required.

The live slideshow gradually saves photos as its current/next images are fetched,
with one sequential fetch/decode path rather than a full-album download. A shuffled
subset is selected from the fully paginated catalog, retaining existing valid
copies first. The local limit is **100 photos or 100,000,000 encoded bytes**,
whichever comes first. Limits concern disk bytes, independently of the two decoded
images. The remaining remote collection still participates in the online slideshow.
Small collections fill as they rotate; this is not an immediate full synchronization.
The view reads saved photos before downloading them again. During an outage it can
rotate the saved subset and resume it after leaving/returning to Photos. The live
schedule continues selecting Morning/Photos/Night; all-hours offline playback and
cold navigation belong to O3/O4, not this phase.

`src/lib/photos/offline.ts` owns IndexedDB `dayframe.offline-photos.v1` (schema 1).
`photos` contains only ID, dimensions, encoded size and content type; `blobs` contains
WebP encoded ArrayBuffers, reconstructed as individual Blobs for playback. This avoids
WebKit's observed Blob-preparation failure without decoding an entire collection.
`state` holds one lease plus fit/interval, with no full settings, credentials,
uploader identities, source fingerprints, appointments or schedules. Fit/interval
updates and local reads do not renew authorization. A localStorage control record
holds only collection availability and an invalidation token, never image data
or credentials. It fences pending writes; storage events and BroadcastChannel release
loaded photos across open tabs. Admin previews also clear on local invalidation,
with generation checks preventing in-flight results from restoring them.

A successful authenticated photo response or complete validated catalog refresh
renews retention for **seven days**. Public health/network events, local reads and
failed/partial refreshes do not. Stored wall-clock evidence and running monotonic
checks reject expired/backward/untrustworthy clocks. Startup/periodic checks run outside Photos too; an independent expiry timer
also survives pagehide while browser execution continues. Suspended/off devices
cannot execute cleanup. Observed private API 401/403, explicit frame or Access logout, attempted
reprovisioning and lease expiry block playback and clear the
collection. Logout/reprovisioning clear locally before attempting the network.
A later complete successful authenticated catalog refresh restarts caching
automatically after invalidation; no switch needs resetting.
A disconnected frame cannot observe remote revocation, home-IP changes or server
deletions until it reconnects: the accepted seven-day readability tradeoff applies.

Deletion reconciliation runs only after the complete paginated catalog succeeds.
Partial refreshes leave copies intact. Metadata/encoded bytes are committed in one
transaction; aborted writes or quota errors preserve previous entries. Local budget
eviction never deletes server photos. Quota/unavailable-storage messages leave
online playback usable; browser eviction may leave no offline photos. Corrupt saved
images are skipped and their local copies removed, preserving the other entries.
A synchronous denial tombstone survives a failed asynchronous clear; deletion retries
after one minute and on later access, while playback stays blocked. Clear this site's
browser data on retirement if storage cannot be accessed. Copies are disposable and
are not an export or backup.

This phase adds no service worker or precached shell. Reloading offline may still
fail before this code can run. O3/O4 provide the standalone navigation fallback;
GeckoView storage/retention and native supervision remain O5 device gates. No
production deployment or device action is included in this implementation.

## Standalone fallback and navigation — M5.O3/O4, 22 October 2026

The build produces `offline.html`, a public self-contained document with system
fonts and hash-authorized inline script/style. It contains no private photos,
weather, appointments, credentials or household settings. It reads the same
schema-1 IndexedDB store as the live slideshow and displays saved photos at all
hours, including Night, for the remaining seven-day authenticated lease. Fit and
interval survive; weather, appointments and schedules do not run offline. Empty,
expired, corrupt or unavailable storage leaves a useful retry state. Current/next
object URLs remain bounded and are released on hiding, page exit or invalidation.

Navigation activation is **disabled in ordinary builds**, pending M5.O5 native
heartbeat/recovery readiness. O3/O4 are desktop software slices; do not enable the
feature on the active Classic 10 by deploying a trial build. No device action is
included. For isolated local browser validation, `pnpm test:offline-navigation`
saves the current `dist`, builds with `DAYFRAME_OFFLINE_NAVIGATION=1`, runs the
worker acceptance suite and restores the exact original assets even on failure.
`pnpm verify` includes this separate trial after the ordinary browser suite. Its
restored assets remain the existing verified deployment handoff.

When explicitly enabled, an inline startup guard registers stable `/sw.js` with
cache bypass for updates. Its scope is `/`, but it intercepts only same-origin GET
**navigations to `/`**, optionally with one `display=frame` and/or one
`density=standard|large`. Duplicate, unknown or invalid parameters exclude a URL.
Explicit `/index.html`, admin/setup paths, APIs, assets and `/version.json` retain
ordinary browser handling. The worker never caches the live dashboard HTML or its
assets. A five-second network-first attempt bypasses old HTTP shell copies and covers the dashboard body; transport
failure or timeout serves the public offline document at the original address.
HTTP failures, including 401/403, and redirects keep their normal response. Cached
photos do not turn a private denial into a successful API response. No TLS or native
address/clock policy is relaxed.

If dashboard HTML loads but its critical module fails, the independent inline
guard waits twenty seconds, then obtains the installed fallback over a worker
message port and replaces the failed document at its original address. This is the
single deliberate `document.open/write/close` exception: the input is exclusively
the installed worker's public, hash-CSP document, with no user/private markup. It
starts its standalone script without a new top-level URL or an iframe. Normal
weather/photo renderers still use native templates. A never-installed/evicted
fallback cannot fabricate an offline start; an evicted active fallback returns a
plain retryable 503. Browser support remains distinct from GeckoView acceptance.

The fallback probes `/api/health` with no-store, redirect rejection, expected JSON
and a five-second timeout. Checks back off from fifteen seconds to five minutes;
one request runs at a time. Successful health is reachability only and never
renews photo retention. A return attempt persists a deadline before reloading.
Repeated partial-startup returns back off across navigations from one to five
minutes; successful application startup resets them. If session storage is denied,
a healthy connection enables an explicit manual return; automatic navigation stays
disabled because its loop fence cannot be persisted. Reconnection revalidates
private access through the ordinary live APIs. Public connectivity cannot override
a photo-access denial or expired lease.

Every build publishes `/version.json` with an opaque ID embedded in its dashboard
and matching scripts. With the trial enabled, the dashboard checks on startup,
every thirty minutes and on connectivity return, with no-store and one in-flight
request. Failed, malformed and unchanged responses leave it running. A changed ID
waits for the next Photos transition (or the next render turn in other modes/an
empty Photos view). The attempted target is persisted before reload, suppressing
loops if stale HTML returns. Only the unexpired manual mode override's remaining
lifetime transfers through session storage; density, fit, credentials and the valid
photo store retain their existing locations. Admin/setup pages do not check/reload.
Weather and settings keep their independent refresh cycles. Page resume restarts
update checks.

Only the fallback content hash versions Cache Storage (`dayframe.fallback.*`).
Install verifies the complete document against that exact hash before saving it;
a failed/mismatched install leaves the active version usable. Successful install
activates immediately and claims open clients, then removes obsolete fallback
caches. This is safe for old pages because no dashboard asset is intercepted and
schema 1 remains compatible. Destructive storage migration requires a separate
review. Do not remove registration code as a retirement procedure: existing workers
remain installed. A specifically authorized retirement build uses
`DAYFRAME_OFFLINE_RETIRE=1 pnpm build` to serve a replacement at the same `/sw.js`;
it removes only fallback caches and unregisters during activation. For a controlled
local recovery, the current worker also accepts `RETIRE_DAYFRAME_OFFLINE` via a
message port and acknowledges `retired` after cache cleanup/unregistration. Both
paths preserve the photo store and unrelated caches. Reload/close existing pages
after retirement; their old worker controller can remain attached until navigation.
No retirement build has been deployed.
