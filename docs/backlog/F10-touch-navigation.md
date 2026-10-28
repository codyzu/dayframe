# F10 — Touch navigation, photo history and screen continuity

Status: deployed 28 October 2026 as `4224129`. Full hosted verification and
independent live asset matching passed; actual-frame animation acceptance remains
separate.
P2 / M.
Follow the [delivery contract](delivery-contract.md).

## Intent and discussion outcome

Make the frame pleasant to browse casually: swipe between screens, tap through
photos, and return to the photo that was showing before checking the weather.
Keep the display quiet and preserve temporary manual overrides of the schedule.
The owner subsequently selected F10 for implementation and requested commit and
deployment. Native/device changes and physical acceptance remain outside this web
implementation. The original proposal below is retained with implementation
decisions and evidence appended.

Preferred interaction direction:

| Interaction                          | Intended result                                   |
| ------------------------------------ | ------------------------------------------------- |
| Horizontal swipe on the main display | Change screen                                     |
| Tap the left side of a photo         | Previous photo in actual viewing history          |
| Tap the right side of a photo        | Next photo                                        |
| Tap the centre of a photo            | Reveal the existing controls briefly              |
| Bottom mode button                   | Shortcut to the same screen reached by navigation |

Use generous photo tap areas, with visible previous/next buttons and keyboard
alternatives. Keep ordinary buttons, links and open dialogs out of background
gesture handling. A swipe must not also activate a photo tap or a newly revealed
button. Retain the independent native two-finger hold maintenance gesture.

Alternatives discussed but not preferred: horizontal swipes for photos plus an
upward swipe for navigation; different swipe meanings in an invisible bottom
zone; and a persistent bottom strip dedicated to screen swiping. The preferred
division is swipe to change screen, tap to browse photos, avoiding precision
requirements and hidden gesture boundaries.

## Night and scheduling: selected implementation default

The owner questioned the initial suggestion to enter Night only by button and
leave it by swiping in either direction. That exception makes the relationship
between navigation and temporary overrides unclear.

The latest recommendation is a fixed, non-wrapping sequence:
**Weather ↔ Photos ↔ Night**. Swiping left advances toward Night; swiping right
returns toward Weather. Bottom buttons select those same destinations. Night
therefore has an ordinary swipe exit to Photos, rather than a special return to
the previously visited screen. Do not change mode at either end of the sequence.

Both swipe and button selections use the existing per-display manual override
and configured inactivity expiry. They do not edit the schedule. If the schedule
currently says Night, browsing another screen temporarily wakes the display and
expiry returns it to Night. Selecting Night during a daytime period likewise
expires back to the scheduled mode. “Stay dark until morning” would be a separate
product decision, not an implicit consequence of selecting Night.

Selecting F10 adopts this latest recommended default under the delivery contract;
no additional scheduling policy is introduced. A simple Night tap only reveals
controls, which now use the dim Night palette. It does not select a bright screen. CSS Night is distinct from hardware backlight
or screen-off work in [D04](D04-night-brightness.md).

## Photo history and returning to Photos

Previous means the photo actually seen before, even with shuffle enabled. Moving
forward after moving backward retraces the existing history before continuing the
shuffle. Bound the history; start with a small in-memory list of photo IDs, not a
decoded image for every entry. Choose the limit during implementation and document
it. No new cross-reload or persistent history is required by this proposal.

Remember the last displayed photo across Weather/Night visits. Returning to Photos
should restore it rather than start a new shuffle. Restore the history cursor too.
Manual photo navigation and re-entry should give the displayed photo a full
configured slideshow interval. Missing/deleted/unavailable entries must be skipped
safely; an empty collection remains an honest empty state.

Pre-implementation source inspection on 28 October:

- `src/lib/photos/slideshow.ts`: `setActive(false)` invokes `clear()`, releasing
  current/next image sources and Blob URLs and emptying the catalog and queue.
  Re-entry runs `tick()` and rebuilds the catalog/image view; no previous-photo
  history exists. `load()` tries an enabled saved copy before downloading, so a
  return does **not necessarily mean a new network image download**, but can still
  involve catalog work, decoding and a loading/empty view.
- `src/lib/dashboard/controller.ts`: pointer activity reveals navigation for
  15 seconds; mode buttons feed the existing override state.
- `src/lib/dashboard/schedule.ts`: manual override and inactivity expiry already
  exist. Gesture navigation should use this state rather than introduce another
  scheduling mechanism.
- `src/components/PhotoControls.astro` and `ModeNavigation.astro`: preserve and
  adapt existing explicit controls rather than create a separate navigation model.

Preserve bounded decoded-image memory while retaining lightweight continuity
state. Try restoring the last photo from an existing authorized saved copy, or
fetch it when necessary. Do not keep all screens and photos decoded indefinitely.
Restoration must respect current access/lease validity, deletion, logout, denial
and cache invalidation. Remembering an ID or preview does not authorize displaying
private pixels. Existing privacy clearing must cover any new transition artifact.

## Animation and loading presentation

Desired first approach: recognize a deliberate swipe, then animate the transition
after finger release. Continuous finger-following dragging is not required.
Try a restrained horizontal slide of roughly 200–250 ms with gentle easing;
settle the timing through actual-device observation. Avoid bounce, added blur and
continuous motion. Reduced-motion preferences get an immediate switch.

Prepare the destination before sliding it into view where practical. Keep the
departing photo still during transition and avoid sliding a routine loading label
into view when an authorized last-photo copy is available. Do not delay navigation
indefinitely waiting for the network: define bounded preparation and preserve
useful offline, empty, failure and access-required states.

The owner suggested a lighter alternative if animating live DOM is too expensive:
slide a still or simplified preview resembling the destination, then replace it
with the real view as it becomes ready. This is similar to skeleton loading, with
a feeling of the page coming into focus. Prefer a real last photo or a lightweight
weather layout over generic placeholders. Literal DOM screenshots are only one
possible technique, not a requirement; prove capture/render cost before adding
such machinery or dependencies. Weather previews must not invent data or hide
staleness, and photo previews inherit the same privacy lifetime as the image.

Progression: improve photo restoration first, try short real-screen transitions,
then investigate previews only if measurement warrants them. Immediate switching
is an acceptable fallback when animation harms responsiveness. A quiet fade into
Night was also suggested, but remains an open visual choice against consistent
horizontal transitions across the whole sequence.

No claim that our frame can run these animations smoothly has been established.
Evaluate on the actual Classic 10/current browser in a separately authorized
physical review; desktop emulation is not acceptance of frame performance.

## Suggested implementation slices and acceptance

1. Add bounded history and last-photo restoration independently of animation.
   Verify previous/forward traversal, shuffle continuation, repeated re-entry,
   one-photo/empty/deleted cases, interval resets and bounded decoded images.
2. Confirm Night semantics, then add screen swipes and photo tap zones. Define
   deliberate horizontal intent, movement tolerance, cancellation and behavior
   during rapid/repeated input. Preserve buttons, focus, keyboard navigation,
   mobile behavior, forecast-dialog scrolling and native maintenance access.
   Test that swipe completion never also advances a photo.
3. Add short transitions with reduced-motion handling and a usable nonanimated
   fallback. Inspect frame/mobile layouts and all loading/error states. Validate
   override expiry, scheduled changes, Night contrast and interruptions during a
   transition. A mode change must not leave detached controls or stale private
   preview pixels visible.
4. Measure actual frame response, visible smoothness and memory behavior over
   repeated screen/photo browsing. Decide whether previews are needed from this
   evidence; do not assume they are cheaper than live DOM transforms.

Keep existing authorization/offline tests covering expiry, denial, role loss and
invalidation; extend them to history/restoration/previews. Do not expand photo
retention, private API exposure, service-worker scope, polling or infrastructure
to implement this interaction. Preserve the €0 recurring-cost requirement.
Rollback should be a web revert with existing photo storage/settings compatible.
Record implementation, release and actual-device acceptance separately.

## Upstream reference and deliberate differences

The discussion reviewed upstream `dashboard/js/views/photos.js` and
`dashboard/js/app.js` on `main`. The last locally documented pinned upstream review
is `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`; this documentation task did not
independently resolve a fresh upstream SHA.

Upstream [photo controls](https://github.com/wesbos/photo-frame-dashboard/blob/0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189/dashboard/js/views/photos.js)
provide left/centre/right tap zones for previous/details/next plus explicit buttons.
Use generous tap areas and on-demand controls as ideas. Screen-swiping, temporary
Night overrides, privacy-aware bounded history and mode restoration are Dayframe
design proposals, not claims of equivalent upstream behavior. Refresh upstream
slideshow/shell code and root MIT license before implementation and record the
actual SHA. No upstream code or assets copied by this proposal.

## Start a separate chat

> Continue F10 from docs/backlog/F10-touch-navigation.md and its current delivery
> evidence. Preserve the implemented Night/order, photo privacy, history/memory
> bounds and scheduling. Refresh upstream provenance before changes. Physical
> frame animation acceptance remains separate from browser verification; investigate
> preview alternatives only if actual-device evidence warrants them.

## Implementation — 28 October 2026

Implemented sequentially: (1) bounded history/restoration with focused unit and
browser checks, (2) gesture routing and explicit controls, then (3) live-screen
transitions and failure handling. The first combined F10 browser pass covered 24
cases across Chromium, Firefox, WebKit and mobile WebKit. Subsequent edge-case
coverage and full release verification are recorded below when complete.

- History contains at most 30 IDs in this page's memory. It preserves the cursor,
  retraces forward after going back, filters catalog deletions and clears on
  observed denial/invalidation or lease expiry. Reload starts a new history.
- Mode exit releases current/preloaded decoded images and Blob URLs. Validated
  catalog/queue IDs survive within their existing privacy deadlines.
  Re-entry restores the history cursor using an existing authorized saved image
  when available, with a full slideshow interval. Re-entry revalidates the catalog before
  publishing saved pixels, preserving the pre-F10 access-check boundary; failed
  network reads may still use a valid existing offline lease. No image download
  is forced when authorized saved bytes exist.
- A left/right swipe of at least 60 CSS pixels, with horizontal movement at least
  1.6 times vertical movement and completed within one second, changes screens.
  The order is Morning → Photos → Night; right swipes reverse it. Ends do not wrap.
  Photo taps in the outer 30% on each side browse history; the centre reveals
  controls. Tap movement must remain within 12 pixels and duration below 500 ms.
- Buttons, links, form controls, footer navigation and open dialogs are excluded.
  Cancellation, multitouch and stationary holds do not browse photos. A consumed
  background interaction suppresses its compatibility click. Native image dragging
  is disabled; vertical touch scrolling/pinch zoom remain available. Existing
  two-finger native maintenance is unchanged and still needs physical review.
- Previous/next buttons provide keyboard alternatives; background Left/Right keys
  change screens. Focus inside a departing panel returns to the dashboard.
  An on-demand French hint in Morning/Photos disappears after the first screen
  swipe. Night omits it to keep the large greeting clear of recovery/navigation.
- Manual navigation slides the live page out for 110 ms, commits the mode, then
  slides the destination in for 110 ms. Photos gets up to 250 ms preparation before
  the incoming half; slow requests cannot hold the page offscreen indefinitely.
  The two halves are sequential, not a continuously dragged carousel. No DOM
  screenshots, duplicate private views or preview images are retained.
- Reduced motion switches immediately. Missing/failed animation APIs or a 400 ms
  animation watchdog disable animation for the page. Superseding selections,
  scheduled changes, visibility/page lifecycle changes and reduced-motion changes
  cancel pending transforms/waits. Scheduled changes switch immediately.
- Restoring instead of advancing on wake exposed a storage-recovery case: already
  loaded current/next bytes are saved only if absent from the existing authorized
  bounded subset. This adds no download, retained-photo budget or service. Aborted
  decodes release their image source/URL immediately.

Upstream refreshed with `git ls-remote` on 28 October: still
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`. Read pinned root MIT `LICENSE`,
`dashboard/js/views/photos.js`, `dashboard/js/slideshow.js` and the shell's pointer/
idle navigation in `dashboard/js/app.js`. Adopted large photo tap areas and
on-demand controls as ideas. Independently implemented bounded ID history with
forward retracing, privacy/lease-aware restoration, scheduled overrides and
cancelable transitions. Did not copy upstream source/assets, retain its unbounded
slide history, introduce mock photos/layouts or alter native/device behavior.

Physical gate: observe native touch, slide smoothness, responsiveness and memory
on the actual Classic 10/current kiosk before calling animation device-accepted.
Lightweight destination previews remain an optional measured follow-up if live
transitions struggle; no claim that they are cheaper or needed yet. Existing
hardware/security/soak deferrals remain unchanged. Rollback is a web source revert
or previous Worker version, with no settings/storage migration or photo deletion.

## Validation progress — 28 October 2026

Types, lint (four existing complexity warnings), all 164 unit/Worker tests and
build passed on the first full gate. That run was stopped after finding an
access-check regression from reusing a fresh catalog on re-entry and layout tests
sampling moving screens. Restored catalog revalidation before showing saved pixels;
no authorization assertion was removed. Geometry/inactive-weather checks now wait
for the selected mode/transition to settle before measuring or advancing time.
All 64 focused checks then passed across Chromium, Firefox, WebKit and mobile
WebKit, including all 40 F10 scenarios and the original read-only-session denial
check. A fresh complete gate is running; the stopped run is not a full pass.

The next complete browser sweep finished with 494 passes, four existing skips and
two WebKit/mobile failures in the storage-warning fixture. Diagnostics showed
its instance-level IndexedDB override did not intercept calls. The fixture now
uses prototype interception and verifies that the simulated failure occurred;
the production warning and recovery assertions are retained. All 16 targeted
storage/Night keyboard/hover/nonfinishing-animation/delayed-photo cases passed
across the four browsers. Night hover remains dark, and a dark slide backdrop
prevents a bright flash into Night. A fresh final full gate is running.

## Local closeout — 28 October 2026

The final regular release sweep passed types, lint (four existing complexity
warnings), all 164 unit/Worker tests, build and 508 browser checks with four
existing intentional skips. Offline navigation then exposed the same immediate-
mode assumption in the update test: the reload began before Night selection
finished. The test now first establishes Night and settles the transition, then
runs its unchanged override-preservation assertions. All 44 navigation checks
passed in a complete rerun.

Final screenshot review also found that Night's hint crowded the greeting when
retry was visible. Night now hides that hint and reserves a little more bottom
space without shrinking type or controls. All 12 final geometry/photo-tap/Night
keyboard checks passed across the four browser projects, including an explicit
8 px minimum between the greeting and dock. Reviewed synthetic screenshots are
in [F10 evidence](../evidence/f10/README.md). These CSS/layout checks supplement
the regular sweep; the hosted full gate will verify the exact committed source
before deployment. Formatting, local links and diff whitespace checks passed.
Production rollout and independent live matching remain pending below.

## Production rollout completed — 28 October 2026

[Release 40760808299](https://github.com/codyzu/dayframe/actions/runs/40760808299)
succeeded for `4224129541629a3324ebf0520cf7fb6d3603e298`: full hosted `pnpm verify`,
164 unit/Worker tests, 508 browser passes with four existing intentional skips,
all 44 offline-navigation checks, verified-asset deployment and live smoke.
Worker version `33868b6b-0585-4351-88e8-d509d7d11d78`; public build
`6fcd305d-b059-497a-b9e2-eddeb7ebd111`. The previous public build was independently
observed as `23e48e01-f7ab-4d21-b11b-d2907339441d` before promotion.

Downloaded the approved production artifact and independently matched live home
HTML, all bundled JavaScript/CSS, `/offline`, `/sw.js` and `/version.json`: 17 files,
with redirects forbidden. The public [asset-match record](../evidence/f10/live-assets.json)
retains their SHA-256 hashes. Re-ran the complete anonymous smoke matrix: health
remains production/healthy, admin routes redirect to Access, private photo/
calendar/settings/session reads remain denied, and headerless mutations remain
denied with no-store responses. No household data, credentials, bindings, native
settings or paid services changed. Web implementation, commit and deployment are
complete. Actual frame touch/animation performance and previous hardware/security/
soak deferrals remain separate. Earlier pending notes describe prior stages.

CI timing: checks took 19m09s including browser installation; the regular browser
suite took 12.7m (previous release: 8.2m), and navigation 2.7m (previous: 1.1m).
Unit tests took 7.94s. F10 adds four unit tests and 13 scenarios across four browser
projects (52 executions). Existing tests also now wait for screen animations.
One concrete navigation-suite contributor is the Photos update-order test: wake
now restores the current photo instead of advancing, so it waits for the next
scheduled slide (about 20 real seconds in each browser). Preserving that behavior
and its ordering assertion while advancing the test clock is a possible separate
CI optimization. No complete per-test timing report was retained by the passing
CI reporter, so the remaining slowdown has not been isolated. No test, security,
Free-plan or deployment gate was removed to obtain this release.
