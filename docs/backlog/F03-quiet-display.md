# F03 — Quiet everyday display

Status: deployed 28 October 2026 as `ced80df`; full release and live verification passed. Physical-frame visual acceptance remains separate. P2 / S.
Follow the [delivery contract](delivery-contract.md). Coordinate stale copy with F01.

## Evidence and target

Read the roadmap's “Deferred UI simplification”, `src/lib/photos/slideshow.ts`
(`storageMessage`, `updateStorageStatus` behavior), `PhotoSlideshow.astro`,
`ModeNavigation.astro`, `src/lib/offline/fallback.ts` and `docs/photos.md`.
Routine eviction/synchronization information is visible during normal playback.
The upload-admin simplification on 26 October is already implemented and is a
different feature; do not redo it.

## Implementation

1. Inventory display messages and controls by state: online ready, synchronizing,
   offline playable, no saved photos, expired, auth denied and service failure.
   Preserve clock/weather, text size, mode and next-photo controls the owner uses.
2. Hide routine successful sync/storage chatter during normal display. Put accurate
   technical details in existing admin/maintenance UI, preferably a collapsed
   details section. Keep concise interruption/action text on the display.
3. Retain visible offline and expired/auth states and useful retry controls. Never
   claim permanent storage or a complete backup. Separate presentation changes
   from storage state transitions and preserve accessibility announcements.
4. Apply consistent copy to live and standalone fallback without expanding the
   service worker's intercepted routes or introducing new runtime dependencies.

## Acceptance and delivery

Use `tests/e2e/photos.spec.ts`, `offline-photos.spec.ts`,
`offline-fallback.spec.ts` and relevant navigation tests if fallback markup changes.
Check normal/partial-sync/offline/empty/expired/denied screenshots at frame densities
and mobile. No private image survives denial because a message was hidden; retention,
downloads, lease and reconnection behavior stay covered. Keep maintenance reachable
and record actual-frame visual acceptance separately. Rollback is markup/copy revert.
Update photo operations and the existing deferred item with exact evidence.

## Start a separate chat

> Implement F03 from docs/backlog/F03-quiet-display.md. Simplify normal display
> messaging while preserving useful controls and failure/privacy states. Review
> upstream, verify live/fallback layouts and update the feature documentation.

## Delivery — 28 October 2026

Normal online and partial-sync notices are hidden; actionable local-storage failures
and existing offline/empty/expired/denied/retry states remain visible. Read-only
local-copy/persistence diagnostics are available on demand in collapsed photo
administration details, explicitly scoped to that browser. Existing controls,
privacy limits and native maintenance paths are preserved. Live and fallback use
the same offline label. No new requests, services, dependencies or schema changes.

Refreshed upstream `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`:
MIT `LICENSE`, `dashboard/js/views/photos.js`, `dashboard/js/slideshow.js`.
Adopted the idea of quiet playback with on-demand details; independently implemented
administration diagnostics and retained Dayframe controls, authenticated images and
bounded decode/storage rather than upstream mock favorites, motion/layouts or history.
No source/assets copied. Tests, release evidence and remaining physical limits are
tracked in the [delivery record](../implementation-plan.md#f03-quiet-everyday-display--28-october-2026).

Production [release 40718575390](https://github.com/codyzu/dayframe/actions/runs/40718575390)
passed full `pnpm verify` (163 unit/integration, 452 browser passes, four existing
skips, 44 navigation checks), deployment and live smoke. Independently matched
approved HTML, dashboard/admin scripts, CSS and offline artifacts to production.
Worker `790be822-4735-47ab-9856-ba730aa075f5`; build
`97968ea2-6de5-49ba-aad1-7a82d23026a2`. Physical review remains separate.

The owner's subsequent iPhone review found the original mobile placement awkward.
The [mobile/readability correction](../implementation-plan.md#mobile-photo-controls-and-readability-correction--28-october-2026)
supersedes that placement and the earlier instruction to retain the text-size
selector: the owner now explicitly chooses the larger type everywhere, portrait
edge controls and identical navigation geometry across modes. The correction's
validation and deployment state are recorded separately from the initial F03 release.

The mobile/readability correction is now deployed as `10e3c32` through
[release 40732168963](https://github.com/codyzu/dayframe/actions/runs/40732168963),
with full verification, live smoke and independent artifact matching passed.
Physical phone/frame review of the revised controls remains separate.
