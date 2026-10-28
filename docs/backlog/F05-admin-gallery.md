# F05 — Bounded admin gallery and honest storage usage

Status: enhancement with confirmed scaling/wording limits; P2 / M.
Follow the [delivery contract](delivery-contract.md).

## Evidence

`src/lib/photos/client.ts:fetchCatalog` walks API pages with a 10,000-image bound;
`admin.ts:render` recreates a card for every catalog image. Each image uses the
protected full WebP endpoint. The storage label sums image sizes plus 1,024 bytes
per record and says “Mo utilisés”; this is an estimate, not exact account usage.
Read `docs/photos.md`, `worker/photos.ts`, `contracts.ts` and admin markup.
Server pagination and the 700 MB warning already exist; do not reimplement them.

## Implementation

1. Keep the complete bounded metadata set needed for deduplication, but display a
   bounded page of cards (proposed 50) with accessible previous/next controls and
   count. Preserve session-local upload/delete overlays and selected page on refresh.
2. Load visible images lazily; release removed nodes/handlers when navigating.
   Keep full-size downloads authenticated. First measure this approach before
   proposing a separate thumbnail storage format or extra writes.
3. Label storage as estimated collection usage, distinguish it from account-wide
   quotas and offline cache capacity, and preserve early warnings and quota errors.
   Add explicit pending/partial-catalog/error states so partial totals are not final.
4. Recalculate page after deletion and show newly added photos predictably. Do not
   add batch deletion or search/folders in this slice.

## Acceptance and delivery

Use synthetic 0/1/50/51/1001-item collections and API cursor failures in photo unit
and browser tests. Assert bounded cards/image requests, complete duplicate detection,
page correction after deletion, expired-session cleanup, usable keyboard/mobile UI
and continued download/delete confirmation. Measure request counts with paginated
fixtures and update the quota budget. Revert is UI-only with no data migration.
Record pagination size, estimate semantics and evidence in `docs/photos.md`.

## Start a separate chat

> Implement F05 from docs/backlog/F05-admin-gallery.md. Bound rendered gallery cards
> while preserving complete duplicate checks, and label storage estimates accurately.
> Refresh upstream, test scale/auth/error paths and document measured request bounds.
