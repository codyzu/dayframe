# F07 — Private photo captions

Status: optional enhancement; P3 / M. Follow the [delivery contract](delivery-contract.md).

## Evidence and target

`PhotoMetadata` in `src/lib/photos/contracts.ts` has no caption. The API supports
photo reads/uploads/deletes, not metadata edits. Read `worker/{photos,photo-api}.ts`,
photo admin/slideshow/offline modules, ADR 0002/0009 and upstream slideshow reference.
Proposed scope: manually entered plain-text caption, at most 160 characters, editable
only by admins and hidden by default on the display. No EXIF location/date extraction.

## Implementation

1. Decide storage/concurrency before adding PATCH. Existing bytes and KV metadata
   share one record; a metadata rewrite can race upload/delete. Document bounded
   last-write-wins behavior or use existing strongly consistent coordination only
   after a cost/design review. Never claim atomic compare-and-set from plain KV.
2. Add optional validated caption with missing→empty compatibility; retain stable
   SHA identity and image bytes. Reject markup/control characters and excessive
   lengths. Add admin-only edit transport with origin checks and private caching.
3. Add save/cancel/error UI and a display preference for captions. Render using
   textContent; limit visual lines while preserving readable access to full text.
4. Explicitly decide offline caption retention. Safest first slice: captions online
   only, absent from stored photo records; expanding private offline metadata needs
   an ADR 0009 update. Coordinate manifest compatibility with F04/F08.

## Acceptance and recovery

Test old records, Unicode, XSS strings, role denial, auth expiry, edit/delete races,
late responses and unchanged image identity. Check contrast over light/dark images,
Large/mobile layout and denial clearing. Add affected photo/API browser cases.
Rollback hides captions; old clients must tolerate optional metadata, and data
retention/removal behavior must be documented. No wholesale photo re-encoding.

## Start a separate chat

> Implement F07 from docs/backlog/F07-photo-captions.md, first resolving metadata
> concurrency and online-only caption scope. Preserve photo identity, private access
> and memory limits; document schema/rollback and test the admin/display flow.
