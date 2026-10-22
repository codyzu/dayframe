# ADR 0005: Local schedules, temporary overrides and offline display

Date: 18 October 2026. Status: implemented locally for M5; deployment and physical acceptance remain separate.

## Schedule semantics

Daily periods use the configured IANA timezone and half-open `[start, end)` minute ranges. An end earlier than its start crosses midnight. Equal endpoints and overlaps are invalid. At an instant, `Intl.DateTimeFormat` supplies the local hour/minute independently of the browser's timezone. Spring-forward minutes do not occur; autumn repeated minutes select the same period on both passes. A schedule gap, invalid configuration supplied to the pure resolver, or invalid instant selects Morning. Existing API validation continues rejecting invalid writes. A malformed refresh response retains the last validated settings; first-load failure uses public defaults. Authorization denial clears private photos and resets display settings to public defaults.

`src/lib/dashboard/schedule.ts` compiles validation/formatting once per configuration. Overrides belong to one page's memory, survive schedule/configuration changes until inactivity expires, and disappear on reload. Every touch/pointer press or key renews an active override; navigation hides after 15 seconds independently of the configured override timeout. Both wall-clock and monotonic elapsed time count toward override expiry, preventing a backward clock correction from extending it. A forward correction can end an override early. Returning from suspend counts wall elapsed time when a platform pauses its monotonic clock.

## Lifecycle and recovery

The dashboard owns one one-second timeout chain, one in-flight display-settings request and a fixed set of lifecycle listeners. It recomputes modes at startup, every second, on visibility return, pageshow, configuration application and online recovery. Clock discontinuities are detected by comparing wall and monotonic deltas; mode evaluation always uses the current instant. Hidden/pagehide stops display polling and releases private images. Resume recomputes before reactivating Photos. Settings refresh every five minutes, retry after one minute on failures, and refresh immediately on resume/online or the visible retry control. Successful weather location/timezone changes dispose the old service and listeners before mounting the replacement; unchanged settings and anonymous denials do not restart weather fetching.

Morning retains the existing forecast and timestamped stale/weather-cache recovery. Home remains a placeholder. Night renders a near-black background with subdued content and hidden branding; this changes rendered pixels only. It cannot lower Android hardware brightness, turn off the backlight, or prove physical readability. Controls are available by touch/keyboard and expose no administrator routes.

Photos retain at most current/next decoded images and blob URLs in memory. Any successful authorized photo/catalog response renews the existing five-minute private-photo lease. Offline failures preserve the current image only within that lease; timer, wall and monotonic deadlines enforce expiry, including a backward clock correction. Leaving Photos, hiding the page, pagehide or authorization denial releases images and URLs. Online recovery retries immediately; ordinary failures retry automatically. No private-photo persistence, service worker, Cache Storage or IndexedDB has been introduced. Offline continuity is in-page only; a cold offline navigation/reload still requires the public shell and assets to be available through ordinary browser caching. These bounds assume browser execution; a suspended browser cannot execute cleanup until resumed. M6 must observe actual Firefox suspend/paint behavior.

## Upstream review and licensing

Reviewed the existing pinned upstream checkout of [Wes Bos's photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard/tree/e97c50ba459c49ea8237259f69b95cd28054b628), revision `e97c50ba459c49ea8237259f69b95cd28054b628`, before M5 implementation:

- `dashboard/js/app.js`: mode routing, `App.isNight`, second ticks, pointer activity and idle/ambient transitions.
- `dashboard/js/system.js`: demo-time controls, night/ambient switches and hidden demo drawer.
- `dashboard/js/slideshow.js`: start/stop/restart lifecycle, image failure fallback and retained slide history.
- Existing M1 source/license audit, upstream README and dashboard manifest; no license grant found in the pinned source tree.

Adopted the ideas of small independent mode modules, touch wake-up and explicit slideshow lifecycle. Independently implemented configured IANA schedules, elapsed inactivity, bounded authenticated blobs, stale-data recovery and responsive layout. Deliberately omitted upstream demo clock, hidden demo/admin drawer, host-local hard-coded night hours, remote Picsum assets, unbounded slide history, scaling and Ken Burns effects. No upstream code/assets copied; public visibility is not a license grant. Upstream attribution remains here and in ADR 0001. No fresh hardware investigation or commands were performed; the latest H4 record was read, preserving the Classic/Modern10 distinction and pending CPU/weather/motion work.

## Verification and limits

See the M5 implementation record in `docs/implementation-plan.md` for actual commands, browser results and retained synthetic screenshots. Desktop engines and mobile emulation are software evidence only. Production M4 remains unchanged and available for H4. Physical schedules/DST, touch, dimmed Night, suspend/clock correction, Wi-Fi loss/return, privacy cleanup and performance need separate acceptance on a fixed future deployment. H4 CPU review, weather baseline, paired-motion measurements, H5/H6 and the continuous 48-hour M6 acceptance remain pending.

## Home removal — 20 October 2026

The owner requested removing the unused household-automation placeholder until useful
integrations exist. Only Morning, Photos and Night remain in display navigation, mode types
and schedule editing. Photos defaulted to 10:00–21:00 until the 20 October 2026 display refinement, which moves Night to 23:00. Validation translates legacy
`home` periods to `photos` without changing period boundaries or other settings; reads
remain non-mutating, and the next ordinary settings save persists normalization.
Unknown modes, extra period keys, overlaps and invalid times remain rejected.

No native package change is required: the installed liveness probe already supports all
three retained modes. Its historical support for the old mode remains compatible with older
web builds. No device, startup/profile, authentication, privacy lease or service change.
The upstream comparison at `f1e0820918c926396e0ccafb4839568825f63edc` informed this review;
we deliberately omit its Home prototype rather than implementing mock household controls.
No upstream code/assets copied. Reintroducing Home requires its own useful feature slice.

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
