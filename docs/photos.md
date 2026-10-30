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

The browser requests persistent storage where supported. Normal photo playback
keeps routine persistence/synchronization notices hidden (F03, 28 October).
Permission prompts do not block synchronization. In `/admin/photos`, expand
**Photos hors connexion · ce navigateur** for an on-demand local-copy count and
persistence grant/eviction status. The snapshot concerns that browser only, never
a remote frame; reopen it to refresh. Unsupported persistence APIs are reported
as unverified. This panel does not download photos or renew access, and it clears
on observed authorization denial. Its explanation retains the gradual-sync,
seven-day/100-photo/100 MB limits and eviction/backup caveats. Visiting administration preserves the shared collection; admin
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

Navigation activation defaults to **disabled in ordinary local/PR builds**.
The owner authorized installation of native 0.1.5 and the enabled production release
on 23 October; online actual-frame checks passed. [Rollout and remaining device
gates](hardware/m5-offline.md). Offline/overnight/cold-power acceptance remains open.

`pnpm test:offline-navigation` saves the current `dist`, builds with
`DAYFRAME_OFFLINE_NAVIGATION=1`, runs the worker acceptance suite and restores the
exact original assets even on failure. `pnpm verify` includes this trial after the
ordinary browser suite. Production CI explicitly selects
`DAYFRAME_RELEASE_ASSETS=1` on main pushes: only a successful enabled trial retains
its exact assets for upload; failure restores the ordinary build. Thus future
production pushes preserve the authorized activation without changing ordinary
local/PR defaults. Removing registration code does not retire an installed worker.

The fallback publishes fixed readiness labels for the native probe. Installed
kiosk 0.1.5 recognizes rendered offline photos and useful empty/expired retry
screens, and permits bounded dashboard navigation without Android connectivity.
This online integration does not establish actual offline startup.

When enabled, an inline startup guard registers stable `/sw.js` with
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

## Clipboard import — 25 October 2026, local implementation

The protected admin page includes **Importer depuis le presse-papiers**. The PNG
Shortcut counts selected images, converts each to PNG, copies locally and opens
`/admin/photos?import=clipboard&expected=N`. Browser sign-in protects the existing
page/API. Paste is explicit, previews appear before upload, and **Ajouter à la
collection** enters the same sequential pipeline as the picker. Native manual
Paste remains available. Preview thumbnails are generated sequentially at at most
320 pixels on the longest edge; only those small images stay decoded in the grid.
The original delivered files remain unchanged for processing. Incomplete batches are blocked; intake limits are ten
photos, 40 MiB each and 100 MB total. Nothing uploads automatically on navigation
or Paste. The normal picker remains available.

Sign in before pasting. On expiry, reconnect in the separate tab linked by the
existing admin UI, then click Actualiser in the original tab. Staged bytes and
upload retries stay only in page memory; denial clears private previews and
blocks sending until verification succeeds. Clear/page exit discard staging;
reload loses pending input. Clipboard contents are not erased by the page.

The Shortcut's intermediate PNG is lossless, with no resize requested. Browser
processing still caps the longest edge at 1600, emits WebP and removes metadata.
SHA-256 is computed from delivered PNG bytes, not inaccessible photo-library
originals. Re-encoding can change exact identity across routes; dHash review
remains advisory and never silently drops similar photos. Representative real
camera/HEIC/HDR/large input acceptance remains pending. No new token, server-side
conversion, storage service or recurring cost is introduced. Production rollout
and actual authenticated iPhone acceptance are separate from local implementation.

Rollout update: the clipboard importer is live from `52ed5f4`, verified by
[successful release checks and smoke](https://github.com/codyzu/dayframe/actions/runs/40182021955).
Use **Dayframe PNG** in the iPhone Share Sheet; the five test Shortcuts have been
removed after explicit owner confirmation. Sign in if requested, tap Coller les
photos/native Paste, review the complete batch, then Ajouter à la collection.
Actual authenticated iPhone import and representative camera-photo acceptance
remain pending. The tested three-photo PNG handoff/preview/WebP diagnostic passed
on the owner's phone; rollout did not automatically upload any photo.

## Clipboard batch recovery — 25 October 2026

The owner reported a successful authenticated iPhone import, then a larger batch
(approximately ten photos) rejected by the combined limit message. The exact
trigger is unconfirmed: the previous message combined count, individual-size and
aggregate-size limits. Full-resolution PNG expansion can reach the 100 MB batch
limit even when the original photo-library files are smaller.

Recovery distinguishes these errors and offers **Coller par lots adaptés**
after a count/size rejection. The owner requested replacing the initial fixed
pairs with size-based groups. On each explicit Paste, read the next consecutive
photos in clipboard order until ten images or 100 MB is reached. Inspect at most
one additional image to discover that it does not fit; it is excluded from the
staged group and read again next time. Do not reorder or skip photos to fill gaps.
Preview the group and require Add to collection; the next Paste starts after the
last photo handed to the existing uploader.
Failed uploads retain their existing retry rows; progress means handed to the
uploader, not necessarily uploaded successfully. Completed/skipped/duplicate rows
remove their retry listeners so they no longer retain source PNGs.

The staged range and encoded size are displayed. Ten 11 MB images yield groups
of nine (99 MB) and one. An exact 100 MB group is allowed. Both button reads and
native manual paste use the same grouping rule. An item with no exposed image representation, or an individually oversized next
image, is deferred after any valid prefix, then reported when first; it is never
silently skipped. Image decode errors still block confirmation of the staged group. The one-image lookahead
can temporarily exceed the staged-byte budget in encoded references; it is not
decoded or retained in staging. This is not a measured peak-memory guarantee.

The full source count (up to 100 selected clipboard items) is still checked against
the Shortcut count; changed counts during recovery are rejected. Every staged group
retains the ten-photo, 40 MiB individual and 100 MB aggregate guards. A single image
over 40 MiB still requires a smaller representation; splitting does not bypass it.
No original-byte hash, WebP pipeline, API or authentication change is made.

The page never writes/clears the system clipboard. Unless something else replaces
or expires it, the current selection can be pasted again without going back to
Photos. Keep that clipboard unchanged until all groups are handed off. Count checks
cannot detect a replacement with the same count, so previews remain required.
Clear/page exit discard staging and recovery position; refreshing starts at the
first group again. Exact delivered-byte checks and human similarity review remain
available for repeated groups. No persistent original inbox is introduced.

Initial fixed-pair recovery was deployed from `0d8413d`; the
[release and live smoke passed](https://github.com/codyzu/dayframe/actions/runs/40194141441).
Refresh/reopen the admin page and paste again to reach the recovery control.
No Shortcut update is needed. Reuse of the previous selection depends on it still
being present in the system clipboard; the page does not persist original photos.
Actual iPhone recovery and a smaller-representation path for individually
oversized photos remain pending.

Adaptive recovery is deployed from `205642e`; actual iPhone adaptive acceptance
remains pending. No Shortcut reinstall, image-quality, fingerprint, API, credential or
service changes are required. The 40 MiB individual-photo limit remains.

Adaptive [release 40214009211](https://github.com/codyzu/dayframe/actions/runs/40214009211)
passed all checks, deployment and live smoke: 134 unit/integration, 348 browser
passes with four existing skips, and 44 navigation checks. Independently matched
the live admin JS to the tested build and verified admin sign-in plus anonymous
catalog denial. Refresh the admin page and use **Coller par lots adaptés**.

## Simplified import flow — 26 October 2026

This flow supersedes the older controls described above. The owner confirmed
adaptive clipboard imports work on the iPhone (often three/four photos per group).
The page now offers **Coller des photos** or **Choisir des photos**, then the same
preview and **Ajouter les photos** confirmation. Browsing no longer sends files
immediately. Every first paste is sized automatically, preserving the existing
ten-photo/100 MB group and 40 MiB individual limits. Each next clipboard group
still needs a user gesture; picker continuation uses the remaining selected files
without reopening the chooser. Neither source uploads before confirmation.

**Coller les suivantes** / **Préparer les suivantes** appears when there are more
photos. Remaining counts mean not yet handed to the uploader; the result summary
separately reports actual additions, duplicates, skipped photos and retries.
Per-photo conversion/upload feedback stays visible during work. Successful results
collapse under **Détails des ajouts**; errors keep details and retry buttons open.
**Annuler** clears pending selection and progress, preserving uploaded photos and
the system clipboard. Manual-paste help appears after a paste problem; successful
previews hide it again. Similarity calibration remains under **Options**. Counts
from the Shortcut URL remain checked internally. No reinstall or new service.

Unsupported image decoding blocks confirmation and asks for JPEG/PNG or the
Dayframe PNG Shortcut. On expired access, reconnect with the displayed link and
use **Actualiser** in the original tab. Pending input and failed upload retries
remain only in that tab's memory; leaving/reloading still loses pending work.

Deployed from `3ac32c8` after the complete
[release gate and live smoke](https://github.com/codyzu/dayframe/actions/runs/40407204551/attempts/2)
passed. The live admin module matches the tested build; admin sign-in and anonymous
catalog denial were independently checked. Refresh the photo page to use the new
flow; the existing Shortcut remains compatible. Actual iPhone acceptance of this
simplified UI is the remaining owner check.

### Oversized-photo recovery — 27 October 2026

A photo over the 40 MiB input limit now reports its received size and, for clipboard
input, opens manual paste immediately. Try native paste in that zone to resume at
the same photo; the same size limits still apply. A different native representation
may fit, but success is not guaranteed. If it remains too large, share a smaller
version. The owner reported a successful manual-paste recovery after the first two
of six iPad photos; without the error text the actual cause remains unconfirmed.

Recovery guidance is deployed from `035c5d4` after the full
[release checks and live smoke](https://github.com/codyzu/dayframe/actions/runs/40546712610/attempts/2)
passed. The live module matches the tested build and private-access checks passed.
Refresh the page; no Shortcut update is needed. The new guidance improves recovery
and error evidence, without claiming the original iPad error's cause is fixed.

## Quiet everyday display — F03, 28 October 2026

| State                                        | Display behavior                                                                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Online ready / progressively saving a subset | No routine sync/persistence notice; clock, weather, framing, next photo and existing mode/text-size navigation remain unchanged.                                                                                             |
| Saved offline playback                       | `Hors connexion · photos enregistrées`, identical in live and standalone fallback; existing reconnection controls remain.                                                                                                    |
| Local storage unavailable / saving fails     | Concise `Copies locales indisponibles · lecture en ligne.` or `Copies locales incomplètes · lecture en ligne.` warning. A successful catalog refresh clears old warnings; saved offline playback uses its own offline label. |
| Empty collection                             | Existing invitation to add photos; no claim that a collection is saved.                                                                                                                                                      |
| Missing/expired fallback copies              | Existing no-photo/reconnect or access-expired message and retry; no private image remains after invalidation.                                                                                                                |
| Access denied                                | Existing reconnect/private-access message, immediate decoded/saved-photo cleanup and retry behavior.                                                                                                                         |
| Service failure without saved copies         | Existing unavailable/automatic-retry message; the current image stays only within existing privacy bounds.                                                                                                                   |

Status regions retain polite accessibility announcements. Normal controls keep their
existing touch, keyboard, focus and inactivity behavior. On narrow screens, photo
controls and retry sit below the clock/weather to avoid covering useful information. No photo schema, lease,
retention, request cadence, authorization, service-worker route, native maintenance
path, dependency or infrastructure change. Rollback is a web source revert and
redeployment with compatible existing storage; no clearing or migration is needed.
Local synthetic browser evidence and release scope are recorded in the
[implementation plan](implementation-plan.md#f03-quiet-everyday-display--28-october-2026).
Actual-frame visual/touch acceptance remains separate.

## Portrait toolbar and shared navigation — 28 October 2026

The owner's mobile review supersedes F03's initial fixed-offset strip. Next and
fill/whole-photo controls now use two 56px buttons in a floating group just above
the shared navigation: vertical in portrait, horizontal in landscape. The fill
button's pressed state means cover; toggling off shows the whole photo. Existing
framing preference and offline playback semantics are preserved. The group is
hidden without a loaded image and with idle navigation. Recovery text/retry stay
in an ordered group above the mode navigation; useful interruption text remains
visible after navigation idles. The photo center/clock and denied state no longer
carry useless framing controls. Mode navigation has identical width, touch targets
and bottom anchor across all modes. The larger typography is now the default;
there is no text-size selector. See [readability](display-density.md) and the latest
[implementation record](implementation-plan.md#mobile-photo-controls-and-readability-correction--28-october-2026).

## Touch browsing and continuity — F10, 28 October 2026

Deployed 28 October 2026 as `4224129`; full release and independent live verification
passed. Evidence is tracked in [F10](backlog/F10-touch-navigation.md).
Swipe horizontally between Morning, Photos and Night; the sequence does not wrap.
Bottom buttons select the same screens. Every manual screen selection uses the
existing inactivity-based temporary override; it does not edit the schedule or
mean “stay dark until morning.” A Night tap only reveals dim controls.

In Photos, tap the left/right outer thirds (30% each) for previous/next, or use the
explicit buttons. The centre reveals controls without advancing. Previous follows
actual viewing history, and forward retraces it before continuing the shuffle.
At the oldest retained entry, Previous is disabled. History is limited to 30 IDs
in page memory and resets on reload or access invalidation. Returning from another
screen restores the last viewed photo/cursor and starts a full configured interval.
No decoded image stays resident while away. Entry revalidates the catalog before
publishing pixels; authorized local image bytes are reused without a forced image
download. Network failure can still use the existing valid offline lease. Existing photo expiry/deletion/offline rules apply.

Screen slides occur after release and respect reduced motion; animation failures
fall back to immediate switching. Forecast-dialog scrolling and native maintenance
remain separate. Actual frame touch/smoothness acceptance is still pending; no
native package/settings change is part of F10. Revert the web build to undo F10;
existing saved photos and configuration require no migration.

## Shortcut resizing — 30 October 2026

The authenticated **Dayframe PNG** generator now resizes each shared image before
PNG conversion. It reads the current Repeat Item's width and height, calculates
`min(1600,max(width,height))`, and uses native **Resize Image → Longest Edge**
with that result. This preserves proportions and avoids upscaling. Conversion
remains PNG with metadata preservation disabled; Local Only clipboard, original
selected count, explicit Paste/preview/Add and browser authentication are retained.
Earlier full-resolution PNG descriptions above document the previous version.
Existing installed Shortcuts need replacement; deploying the website alone cannot
update a native Shortcut. Signed files and signing certificates stay outside Git.

PNG compression is lossless after resizing; resizing itself removes detail.
This moves Dayframe's existing 1600px reduction earlier, avoiding large PNG
intermediates. Native and browser resampling can differ slightly, and HDR/color/
metadata preservation is not promised. Library originals remain untouched. The
browser still encodes WebP at 0.82, strips metadata, and enforces its 40 MiB input,
100 MB group and 2 MiB optimized-upload limits. SHA-256 now identifies the resized
PNG representation, so older imports can require advisory perceptual duplicate
review; cross-route byte identity is not guaranteed.

Native action parameters were checked against a task-owned macOS editor export:
Calculate Expression uses `Input`, Resize Image uses `WFImage`,
`WFImageResizeKey=Longest Edge` and `WFImageResizeLength`. Runtime synthetic
validation and rollout evidence are recorded in the implementation plan. Physical
iPhone sync, orientation, camera/HEIC/HDR and batch acceptance remain separate.

Upstream review refreshed at `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`:
`dashboard/js/views/photos.js`, `dashboard/js/slideshow.js`, and `LICENSE` (MIT).
Its slideshow uses generated image URLs and supplies no corresponding native
Shortcut resizing flow. This enhancement is independently authored; no upstream
code/assets copied. Dayframe retains its protected browser upload pipeline.

[Sanitized native validation results](evidence/photo-shortcut-resize/native-validation.json)
record dimensions/byte counts only. A synthetic 48.02 MiB input became about
7.6 MiB; a three-image batch preserved all three outputs. The updated **Dayframe
PNG** is installed on the Mac. The old version and all five test copies are saved
but hidden from the Share Sheet with owner approval. Confirm iPhone sync and retry
the previously oversized photo using the current **Dayframe PNG** entry.
