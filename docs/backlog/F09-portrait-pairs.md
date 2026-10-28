# F09 — Optional portrait pairing

Status: optional enhancement; P3 / M. Follow the [delivery contract](delivery-contract.md).

## Evidence and scope

The local slideshow uses single-photo contain/cover with two decoded images at most.
Upstream `dashboard/js/slideshow.js` offers pairs/collages but lacks our privacy and
memory contract. Read `src/lib/photos/slideshow.ts`, `offline.ts`,
`src/lib/offline/fallback.ts`, `PhotoSlideshow.astro` and `docs/photos.md`.
First scope is two portrait photos side by side, opt-in; no collages, blur fills,
Ken Burns motion or new stored binaries.

## Implementation

1. Define pair eligibility from validated width/height and deterministic selection.
   Require two distinct available portraits; otherwise use existing single layout.
   Preserve shuffle/no-immediate-repeat guarantees across groups and catalog changes.
2. Resolve memory tradeoff before coding: two visible images exhaust the current
   decode budget. Proposed pairing transition releases the old pair before decoding
   the next, with a neutral bounded transition; do not preload a second full pair or
   silently increase memory. Validate whether this UX is acceptable on hardware.
3. Add backward-compatible layout setting and responsive display; use single images
   on narrow mobile screens. Keep image aspect ratios and current/next cleanup semantics.
4. Either implement the same grouping in fallback or explicitly retain single-photo
   offline playback. No native bridge, service-worker expansion or retention change.

## Acceptance and recovery

Test 0/1/2/mixed orientations, load failure of one member, deletion, rapid next taps,
mode exit, denial, offline and reduced motion. Assert peak decoded-image/object-URL
bounds, not merely DOM count. Review frame/mobile screenshots and measure actual
Classic behavior before enabling there. Rollback selects existing single mode with
all photos intact. Record upstream differences and the chosen transition tradeoff.

## Start a separate chat

> Start F09 from docs/backlog/F09-portrait-pairs.md by proving a two-image-budget
> pairing transition with synthetic photos. Implement the opt-in layout only once
> memory and failure behavior are reviewable; keep device acceptance separate.
