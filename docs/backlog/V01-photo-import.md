# V01 — Real iPhone/iPad import acceptance

Status: implemented workflows with specific evidence gaps; P1 / M.
Follow the [delivery contract](delivery-contract.md). Requires owner/device availability.

## Evidence and scope

Read the latest 25–27 October entries in `docs/implementation-plan.md`,
`docs/photos.md`, `docs/ios-share-sheet-feasibility.md`, and
`src/lib/photos/{clipboard-import,processing,admin,webp-fallback}.ts`.
Adaptive iPhone groups already passed owner acceptance. The 27 October iPad recovery
copy is deployed in the recorded release but physical acceptance is pending. The
reported six-photo failure's exact cause is unknown; simulated Blob.size tests are
not memory measurements. Similarity threshold control already exists (default 6).

## Execution plan

1. Prepare a private checklist and synthetic/owner-approved representative samples:
   rotated JPEG, camera HEIC where exposed, HDR, large panorama, similar burst,
   exact duplicate, and large PNG clipboard representation. Record actual OS/browser
   and deployed revision; never commit originals, captions or photo screenshots.
2. Observe picker and PNG Shortcut routes separately, including explicit Add,
   adaptive continuation, cancel and same-tab retry after sign-in. Capture only
   sanitized counts/dimensions/byte sizes/timings, not clipboard payloads.
3. Reproduce the six-item sequence if possible: after a valid first group, trigger
   an oversized item and use native Paste without resetting the cursor. Count actual
   uploads, duplicates, skips and failures; distinguish different representations.
4. Inspect optimized output orientation, dimensions, no-upscale, MIME and removal of
   EXIF/GPS/XMP. Compare visual quality and human-reviewed dHash matches. Record
   threshold calibration without committing household images or hashes.
5. Fix only reproducible defects as a separate narrow code change. Retain 40 MiB,
   ten-photo/100 MB limits unless a new measured design justifies changing them.

## Acceptance and recovery

Use `tests/e2e/photo-paste.spec.ts`, `photos.spec.ts` and photo unit tests for any
fix. Actual-device record must list observed input representations, group progress,
auth recovery, output quality and failures. No “HEIC passed” claim when the browser
received PNG. No memory-ceiling claim from a single successful batch. Use synthetic
uploads where possible and remove only explicitly selected test records. Update the
three operational documents, preserving earlier evidence and remaining limits.

## Start a separate chat

> Prepare and carry out the available V01 checks in docs/backlog/V01-photo-import.md.
> Use the latest import flow and preserve accepted adaptive behavior. Ask for the
> needed physical observations, keep household inputs private, and distinguish
> measured results from synthetic regression coverage.
