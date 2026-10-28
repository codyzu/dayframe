# F08 — Favorite photos

Status: optional enhancement; P3 / M. Follow the [delivery contract](delivery-contract.md).

## Evidence and scope

Favorites appear as optional in specification §6 but are absent from local metadata
and slideshow selection. Upstream favorites weight mock photos; that is a design
reference, not a ready persistence implementation. Read photo contracts/admin/client,
slideshow/offline, `worker/photos.ts`, F07 and ADR 0002/0009.
Proposed first behavior: admin favorite toggle and optional favorites-only playback;
default full-album shuffle stays unchanged. No mutation permission for the frame.

## Implementation

1. Reuse or design the bounded admin metadata edit contract described by F07. If
   F07 is absent, this slice owns its concurrency decision; do not create competing
   caption/favorite storage schemes. Missing favorite means false.
2. Add accessible admin toggle with save failure/retry state and settings preference
   for all versus favorites. Choose empty-favorites behavior explicitly: proposed
   fall back to all with an accurate admin indication, avoiding a blank frame.
3. Apply filtering before shuffle; preserve no immediate repeats where possible,
   one-photo behavior, deletion reconciliation and current/next decode bounds.
4. Decide offline semantics explicitly. If favorite flags are persisted, version
   minimal display records and keep identical retention/denial cleanup. If not,
   explain that offline fallback still uses saved photos rather than promising filtering.

## Acceptance and recovery

Test old records/settings, 0/1/many favorites, changed flags during playback,
concurrent edits/deletes, unauthorized mutations and offline fallback semantics.
Use photo/settings unit tests and photo/admin/offline browser specs. Keep public
HTML empty of photo metadata. Rollback restores all-photo selection without deleting
images; older clients must tolerate the optional field. Update photo docs and F04
manifest if implemented. No weighted selection until household need warrants it.

## Start a separate chat

> Implement F08 from docs/backlog/F08-photo-favorites.md. Coordinate metadata edits
> with F07, choose explicit offline/empty-favorites behavior, and test privacy,
> persistence and shuffle bounds without giving the display mutation rights.
