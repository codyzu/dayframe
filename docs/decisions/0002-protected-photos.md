# ADR 0002 — Protected photos on Workers Free

Date: 16 October 2026. Status: selected and implemented; local acceptance only. Production activation requires the private configuration and verification in [photo operations](../photos.md). M4 completes household provisioning/recovery and network restrictions; M6 verifies actual hardware.

## Identity and authorization

**20 October 2026 amendment:** The owner selected seven-day admin sessions. This supersedes the original one-hour durations below: the Worker's maximum token age is seven days, with the signed `exp` still enforced independently. Configure the Access application and Allow policy to match using [photo operations](../photos.md). Until that live configuration is changed and a fresh login occurs, the original issued expiry remains effective. Direct Worker API verification does not query Access revocation on each request; a previously issued token may remain usable until its expiry (up to seven days), unless the Worker allowlist/audience configuration also changes. Signature, issuer, audience, identity allowlist and mutation protections remain required. No extra session store, credential, dependency or paid service is introduced.

Select Cloudflare Access for the two independent human administrators. Its [Free plan](https://www.cloudflare.com/plans/zero-trust-services/) accommodates this household (up to 50 users); choose Free explicitly and do not start a billed plan. Use individual email identities with Access one-time PIN or an existing identity provider, an explicit two-address allow policy, and one-hour application/policy sessions. No password database or shared admin secret.

The Worker verifies Access RS256 signatures using `jose` 6.2.12 and the configured team's HTTPS JWKS endpoint. It validates issuer, audience, subject, email, expiry, issued time and a maximum token age of one hour, then checks the email against its private allowlist. An email header alone cannot authorize anything. Key discovery has a five-second timeout and five-minute local cache; failure denies access. The [Access JWT guidance](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) informs this implementation. No upstream authentication code was copied.

Access covers `/admin/*`. The Worker verifies the same signed `CF_Authorization` cookie on photo APIs, allowing a display credential to use those APIs without an interactive Access challenge. A valid edge-injected assertion is also supported. Do **not** put an Access interactive policy over all `/api/*`: it would intercept the read-only display. The Worker enforces every private API independently, including direct Workers-host requests. Static admin HTML contains no private data; protection of that shell is supplemental.

Mutations require an exact same-origin `Origin`, `X-Dayframe-Request: 1`, and no cross-site Fetch Metadata. No permissive CORS is returned. Uploads accept only `image/webp` bytes with bounded streaming reads, not multipart originals. Ambient cookies alone are insufficient for mutations. API responses, including images and auth errors, use private/no-store, appropriate `Vary`, and nosniff. Images also use same-origin resource policy. No CDN or persistent browser photo cache is introduced.

## Display transport and expiry

A 256-bit lowercase hex credential can be exchanged at `POST /api/session/display` using an Authorization bearer header over HTTPS with the same mutation protections. The Worker compares its SHA-256 with a private deployment secret and establishes `__Secure-dayframe_display`, Secure/HttpOnly/SameSite=Strict, scoped to `/api`, with a one-day browser lifetime. Credentials never appear in URLs or frontend source. Native image elements and authenticated fetch both send the scoped cookie. The browser prototype verifies this over local HTTPS in Firefox and WebKit. The Android kiosk lifecycle remains M6.

The display role can read catalog and images, but cannot mutate photos. Its catalog excludes source fingerprints, upload time and uploader identity. Clearing the cookie via `DELETE /api/session` logs out the display. The underlying provisioning credential remains valid until its configured digest is rotated or removed; cookie expiry is not credential revocation. Runtime configuration changes require deployment and propagation; no immediate global revocation guarantee is made. Access JWTs can remain usable for up to their one-hour lifetime unless the Worker allowlist/configuration is also changed. Account-wide token invalidation, home IPv4/IPv6 restrictions, per-device provisioning UI and shorter operational revocation guarantees are M4.

## KV layout and concurrency

Each `photo:<original-sha256>` key stores optimized binary WebP bytes **and associated KV key metadata**. `list()` returns that metadata independently of the value, so catalog pagination never reads image binaries. This deliberately replaces a separate catalog index: one KV put or delete couples binary and metadata, eliminating cross-key partial-write/deletion recovery. The specification prefers this associated-metadata model. Metadata stays below KV's 1,024-byte limit; Worker-produced dimensions, size, timestamp and verified identity are authoritative. `id` equals the original-byte SHA-256 supplied by the admin browser, which is a retry/deduplication input, never proof of source authenticity.

Catalog pages contain at most 1,000 metadata entries with opaque cursor continuation, including empty intermediate pages. No shared counter, full catalog scan on upload, or atomic duplicate claim. Uploads first inspect the existing record and acknowledge an existing deterministic ID without rewriting it. A failed/uncertain response can be retried safely using that ID. Concurrent cross-region uploads can still overwrite one another under KV last-write-wins semantics; deletion racing with upload can reintroduce a photo. Serialize household imports/deletions for a single source and refresh after propagation before resolving a conflict.

[KV consistency documentation](https://developers.cloudflare.com/kv/concepts/how-kv-works/) explains that changes and negative lookups can remain cached for 60 seconds or more. No hard global propagation bound or transactional uniqueness is claimed. A quota failure causes 503, retains existing content, and offers retry. No automatic eviction or service upgrade. On an uncertain upload/delete, refresh then retry the same action; single-key atomicity prevents orphan binaries. Corrupt metadata fails closed and requires an operator inspection/export, rather than silently dropping it from accounting.

## Storage, rendering and browser processing

Enforce 2 MiB encoded bytes and a 1,600px maximum edge. Validate the RIFF/WebP container, chunk lengths, static VP8/VP8L/VP8X signatures, dimensions, and absence of animation/EXIF/XMP/ICC chunks at the Worker. This is structural validation, not full image decoding. Browsers decode for rendering; Worker CPU is reserved for authentication and bounded parsing. Actual Workers Free CPU acceptance remains a deployment check.

The browser computes original SHA-256, decodes with orientation, paints an sRGB white-matted canvas without upscaling, computes row-major grayscale 9×8 dHash, and encodes WebP at 0.82. Canvas output MIME is checked. Safari/WebKit lacks native WebP encoding in the tested build, so it loads `@jsquash/webp` 1.5.0 locally in a temporary worker, at quality 82. That worker terminates after each image or a 45-second timeout, releasing WASM memory. HEIC is accepted only when the browser can decode it; otherwise the UI explains JPEG export. All encoder-added metadata/profile chunks are removed after rendering into sRGB. No originals, filenames, GPS or EXIF are stored.

The default Hamming threshold is 6/64, editable from 0 to 16 in the admin session. Similarity is advisory: the user explicitly keeps or skips a match. Synthetic landscape variations validate the workflow; the household should calibrate it against representative photos. No promise is made that crops or all visually similar images are detected.

The slideshow defaults to contain and 20 seconds, offers cover and next, shuffles without immediate repeats across cycles, and polls metadata every five minutes. Only the current and one upcoming photo are decoded; object URLs are revoked when replaced, hidden, or exited. Ordinary outages retain the current image; an observed authorization failure clears it. There is no persisted offline photo cache. A disconnected frame can keep already-decoded pixels until it exits/hides; remote revocation cannot erase an offline screen. M5 will address any broader offline policy.

## Upstream and licenses

Refreshed upstream at `e97c50ba459c49ea8237259f69b95cd28054b628`. Reviewed README, `dashboard/js/slideshow.js`, `dashboard/js/views/photos.js`, `dashboard/css/views/photos.css`, the photo fixtures in `dashboard/js/data.js`, and `dashboard/js/app.js` image sourcing. Retain the ideas of fullscreen photos, fit modes and a shuffled queue. Independently implement authenticated KV delivery, privacy, pagination, bounded preloading and browser processing. Defer upstream's collage/polaroid/favorites/captions and 15-second timing. No upstream license file exists at that revision; no upstream code, images or CSS copied.

The optional encoder uses jSquash/Squoosh (Apache-2.0), libwebp (BSD), and wasm-feature-detect (Apache-2.0). `jose` is MIT. Copies of notices ship under `public/licenses`; [third-party notices](../../THIRD_PARTY_NOTICES.md) identify versions and original authors. The encoder is bundled only for browser use, not Worker-side transformation.

## M5.O2 retention update — 22 October 2026

The no-persistence/five-minute slideshow descriptions above record the earlier
implementation. [ADR 0009](0009-offline-photo-fallback.md) and the
[photo operations](../photos.md#persistent-photos--m5o2-22-october-2026) now supersede
those bounds only for explicitly enabled dedicated browser profiles: seven days
since authenticated photo/catalog verification, at most 100 photos/100 MB in
IndexedDB, live offline rotation across mode changes, and immediate local denial/
logout/reprovisioning invalidation across tabs. Other profiles retain five-minute
memory continuity. Every profile releases decoded images on hide/mode/page exit.
Admin previews keep their existing short lease and additionally clear on local
invalidation. No service worker or offline cold-start support is implemented in O2;
no deployment or actual-device acceptance is claimed.

### Automatic retention policy revision — 22 October 2026

The owner subsequently removed the opt-in and frame restriction: every authorized
browser using the Photos slideshow, including signed-in admins and ordinary URLs,
automatically retains the bounded collection. This supersedes the explicitly
enabled-profile/five-minute-baseline distinction in the historical O2 note above.
Storage-unavailable memory fallback and admin previews retain their short lifetime.
See [ADR 0009](0009-offline-photo-fallback.md#automatic-retention-revision--22-october-2026).
