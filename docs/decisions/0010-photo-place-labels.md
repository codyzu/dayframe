# ADR 0010 — Private photo place labels

Date: 3 November 2026. Status: implemented and verified locally; no rollout or household
recovery claimed. Current scope and acceptance belong to
[issue #22](https://github.com/codyzu/dayframe/issues/22).

## Decision

Keep optimized image bytes, dimensions, fingerprints and uploader information in
existing KV records. Store editable place labels separately in the existing
SQLite-backed `Administration` object, under `photo-place:<source SHA-256>`.
Each record contains a revision, an optional bounded plain-text label with
`manual`/`estimated` provenance, and a deletion marker. No precise capture GPS,
originals, filenames or EXIF are stored there.

The existing public Worker authorization/origin boundary owns every request. The
internal object URLs are binding-only, with no public router. Admins can PATCH
`/api/photos/:id/place` with an expected revision and a label or null. Transactions
serialize changes; stale revisions return 409. Photo deletion first clears the
label and records a tombstone, then deletes the KV image. Late label edits cannot
undo the tombstone or rewrite/recreate image bytes. A successful new upload can
activate a previously deleted identity with no retained label.

This extends ADR 0003's object responsibilities for mutable photo annotations.
It does not turn image uploads/deletions into a distributed transaction. Existing
KV eventual consistency and concurrent upload/delete limits from ADR 0002 remain:
uncertain or simultaneous operations on the same source require refresh and human
reconciliation. A failed image deletion after its label was cleared can leave the
image present without a label; retry deletion. Failed activation after a KV put
reports the uncertain upload rather than silently replacing another image.

Authorized catalogs join labels to the existing paginated KV metadata listing.
Display responses expose only the label/provenance and existing minimal image
fields; revisions and uploader/fingerprints remain admin-only. Label-store failure
omits labels and marks them unavailable while authorized photo reads still work.
Admin editing is disabled until a successful refresh. No label is inferred from
missing metadata or the current device's location.

## Alternatives

KV binds a value and its list metadata in one `put`; editing current metadata would
rewrite image bytes and could race deletion. A separate KV annotation key avoids
that rewrite but retains eventual consistency and has no atomic revision check.
The already provisioned SQLite object gives mutable fields a transactional boundary
without a new service, binding, migration, image copy or frame reset. The tradeoff
is a catalog join and a second store to include in backups. This is not a reason
to move large immutable photos into the object.

## Import, privacy and offline policy

The owner selected automatic locations and automatic upload after paste/selection,
with optional customization before adding and later editing in administration.
This supersedes the original issue's per-location confirmation proposal and the
previous mandatory preview/Add intake. Exact duplicates remain idempotent; existing
advisory similarity review remains. Recovery uses an explicit mode and requires a
chosen existing candidate, including perceptual matches; it never uploads a new
image. The actual household recovery and Apple Photos access are deferred by the
owner. Reselection via the existing file/manual-paste paths is implemented first.

Capture GPS is parsed locally from JPEG EXIF or PNG eXIf before canvas normalization.
Unsupported/missing metadata and provider failures do not block ordinary upload.
The UI discloses transmission of the selected image's coordinates to Photon and
allows automatic lookup to be disabled before selection. Only coordinates, not
image bytes or credentials, go to the provider. Intermediate Shortcut PNGs preserve
metadata; final stored WebPs still reject EXIF/XMP/ICC. The intermediate clipboard
may contain metadata beyond GPS and is not automatically restored/cleared.

Owner-observed synthetic iPhone single/batch tests established correct GPS through
manual paste, but no GPS through the asynchronous clipboard button. When automatic
locations are enabled, Shortcut links reveal the native/manual paste zone. The
Paste button reveals/focuses the same zone instead of calling `navigator.clipboard.read()`. With lookup disabled, the old
button remains usable. Do not claim all camera/HEIC/HDR/Photos representations were
validated by those synthetic tests.

Labels remain online-only, transient display data. ADR 0009's IndexedDB projection
continues to store only IDs, dimensions, size and image bytes; no place labels,
provenance, revisions or GPS enter offline storage. The self-contained fallback
retains its existing behavior. A local display preference (boolean only) enables
labels on that browser; default is hidden. Denial, offline playback and mode exit
hide/clear captions. No private location text enters localStorage or public assets.

## Cost and providers

Reuse the existing Photon public service, with no key/account/subscription, and the
existing Workers Free/KV/SQLite object bindings. Policy reviewed on 3 November 2026:
[Photon demo policy](https://github.com/komoot/photon#demo-server) permits reasonable
project use, may throttle/ban extensive use, and guarantees neither availability nor
an exact request allowance. [Reverse API](https://github.com/komoot/photon/blob/master/docs/api-v1.md#reverse)
returns a nearby settlement, not municipal-boundary proof. Retain
[OpenStreetMap attribution/ODbL](https://www.openstreetmap.org/copyright).

One page serializes lookups, starts at most one per second and caps them at 100.
No automatic retry; 429/403 pauses lookup for the page. Coordinates/results are
cached only in memory, deduplicating a session's requests; saved labels are reused
for identical already-enriched imports. Hide/exit/denial cancels and forgets the
session cache. Recovery volume must stay modest; pacing is not permission for an
unbounded library sweep. Manual text remains available on failure.

The [Free SQLite allowance](https://developers.cloudflare.com/durable-objects/platform/pricing/)
is 5 GB total storage, five million rows read/day and 100,000 written/day; compute
also has separate limits. Its [limits page](https://developers.cloudflare.com/durable-objects/platform/limits/)
currently has a 10 GB generic object table but a 1 GB Free per-object FAQ: budget
against the lower 1 GB. KV remains [1 GB/account](https://developers.cloudflare.com/kv/platform/limits/).
A planning estimate of 1 KB per place record is about 1 MB per 1,000 photos. Two
continuously open displays reading 1,000 labels every five minutes use approximately
576,000 row reads/day, plus credential/settings/calendar/admin work; shared account
usage still matters. No automatic billing upgrade or paid fallback is introduced.

## Compatibility, backup and rollback

Old records have no label and an empty initial edit revision. Existing image IDs,
URLs and bytes remain unchanged. Old clients ignore additive API fields. The
updated production Shortcut generator preserves metadata only in admin-import
mode; historical diagnostic modes remain unchanged. Installing/replacing a signed
Shortcut is separate from deploying the web application. Keep the previous Shortcut
for rollback and explicitly inspect iPhone sync before claiming rollout accepted.

Reverting the web/Worker build hides labels and disables new editing without
re-encoding/deleting photos. Object keys may remain private and unused; old code
ignores them. Before later re-enabling labels after an old release has performed
photo mutations, reconcile label records with the live catalog. A future optimized
photo backup (#1) must include place/provenance separately from KV binaries and
mint fresh edit revisions on restore; listing KV alone would miss labels.

## Provenance

Refreshed upstream main on 3 November 2026 at
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`; inspected root `LICENSE` (MIT,
Copyright 2026 Wes Bos) and `dashboard/js/slideshow.js` (`photoMeta`/`caption`).
Retain the idea of a small optional place caption. Dayframe independently authors
its private metadata API, local GPS extraction, Photon integration, manual paste,
recovery matching and UnoCSS layout. No upstream source/assets copied. Unlike
upstream's mock place/date captions, we store only an editable place label and keep
our existing privacy, two-image decode and offline-retention contracts.
