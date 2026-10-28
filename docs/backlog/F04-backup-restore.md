# F04 — Portable optimized-photo backup and restore

Status: partial export exists; optional operational enhancement; P2 / L.
Follow the [delivery contract](delivery-contract.md).

## Evidence and boundaries

Read [administration export/restore](../administration.md), `settings-admin.ts`,
`photos/{contracts,client,admin}.ts`, `worker/{photos,photo-api,administration}.ts`.
Settings JSON and individual WebP downloads exist. Bulk export is a manual catalog
procedure; there is no guided metadata-preserving restore. Re-uploading optimized
WebPs through the ordinary picker hashes those WebP bytes, not the original source,
so it does not restore original deduplication identity.

## Stages (each reviewable separately)

1. **Format and exporter:** define a versioned manifest containing validated settings,
   original IDs/hashes, metadata and a separate SHA-256 of each exported WebP. Exclude
   credentials, OAuth connection data, network secrets and browser offline state.
   Choose a browser-compatible bounded download packaging strategy after measuring
   memory; do not buffer a potential 1 GB collection in RAM. A desktop-only first
   exporter is acceptable if clearly stated. Support cancellation and per-file failure.
2. **Restore preview:** validate format/version, entry count, total/per-file sizes,
   ID/hash relationships, duplicate IDs and optimized WebP headers before writes.
   Reject path traversal/zip bombs if archives are used. Show conflicts and exact
   proposed operations; restore into an empty synthetic deployment first.
3. **Restore writer:** only then add a protected admin-only import contract if needed.
   Treat hashes as untrusted identity claims, not authorization. Choose preserve-ID
   semantics explicitly; do not pretend the unavailable original bytes can be verified.
   Default to additive, skip identical entries, refuse differing same-ID content;
   no destructive replacement. Record uploader provenance policy. Reuse API size,
   origin, quota and retry limits. Restore settings separately after validation.

## Acceptance and recovery

Round-trip a synthetic multi-page collection with metadata, conflicts and cancellation.
Verify exported-byte checksums, auth expiry, denied roles, corrupt manifests and quota
failures without damaging existing content. Exports require paused mutations plus
post-propagation ID/count reconciliation; KV is not a transactional snapshot. Test
resuming without duplicate writes. No credentials enter artifacts/logs. Register new
routes in auth/smoke tests. Maintain compatibility with existing settings exports.
Document private storage, restore ordering and new frame-key issuance. Rollback removes
UI/new route; additive imported photos remain available through normal admin deletion.

## Start a separate chat

> Start F04 from docs/backlog/F04-backup-restore.md with the versioned manifest and
> bounded exporter stage. Inspect existing exports and identity semantics, refresh
> upstream, and document the restore contract. Do not claim guided restore complete
> until its separate validation and writer stages pass.
