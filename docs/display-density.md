# Readability and shared navigation

## Current policy — 28 October 2026

The household explicitly favors the larger type for reading at a distance. The
former Large tokens are now the default in all dashboard visits, including phones.
There is no Standard/Grand selector. Narrow layouts wrap and stack content while
preserving readable type; browser zoom and font preferences remain available.
`data-density="large"` remains a descriptive compatibility marker. The retired
`dayframe.display-density.v1` preference and `density=standard|large` URL choices
no longer change typography. Old bookmarks remain valid, including the frame's
`/?display=frame`; no browser storage is cleared or migrated.

The page owns shared rem typography/icon tokens. This correction keeps the existing
large temperature, description, checkpoint, advice, chart and navigation sizes.
Night and photo clocks retain their large responsive sizing. The 1280 × 800 frame
must continue fitting without clipping, including six appointments and warning/day-off
states. Phones can scroll Morning content; bottom clearance keeps it reachable above
the shared navigation.

## Controls

Morning, Photos and Night use the same 24rem maximum navigation width (viewport
minus 2rem on narrow screens), equal-width buttons at least 48px high, and one fixed
bottom anchor respecting the browser safe-area inset. Mode changes, retry visibility
and interaction must not move or resize that navigation.

The photo toolbar is anchored just above the navigation at its right edge. It uses
two 56px touch buttons: next photo and a fill/whole-photo toggle with an accessible
French name, pressed state and explanatory title. Portrait stacks the buttons;
landscape places them side by side. It is hidden without a loaded photo and when
navigation idles away. Interruption text remains visible after idle. Empty/denied
Photos no longer combines a large decorative card with useless framing controls.

No photo retention, credential, schedule, native maintenance, API request, dependency
or paid-service change. Framing still persists with the existing contain/cover key
and updates the existing offline playback preference. Rollback is a web source
revert; no private storage deletion or data migration is needed.

## Verification

Current checks cover large type despite retired preferences/URLs, unavailable
storage, phone and native frame layouts, unchanged navigation bounds across modes,
portrait/landscape toolbar layout and touch targets, keyboard toggle/framing
persistence, reduced motion and privacy/recovery. Existing cases retain long weather
conditions, six appointments and holiday/vigilance coverage. Local browser evidence
is not a new physical-frame acceptance claim; see the latest implementation record.

## Historical density rollout

The original two-preset behavior below is superseded by the owner’s 28 October
readability decision. Its dated evidence and provenance remain historical.

## Evidence and provenance

Synthetic-weather screenshots live in `docs/evidence/readability/`. Browser verification covers Chromium, Firefox, WebKit and iPhone 13 emulation at 1280 × 800 and phone size, plus Chromium at 1440 × 900, 1024 × 768 and 390 × 844. Tests cover profile defaults, explicit overrides, persistence, selector switching, denied storage, viewport bounds, label separation, navigation targets, animation and reduced motion, long freezing conditions and full-scale rain. Desktop engines do not validate the actual Android browser.

Reviewed the local upstream checkout again at `e97c50ba459c49ea8237259f69b95cd28054b628`: `dashboard/css/tokens.css` and `dashboard/css/views/home.css`, alongside the M2 source review in [weather.md](weather.md). Retained the ideas of shared type tokens, glanceable weather hierarchy and generous touch targets. Deliberate differences: independent rem tokens, explicit persisted density preferences and responsive content reflow instead of a fixed canvas. No upstream code/assets copied; the reviewed revision has no repository license file (see [ADR 0001](decisions/0001-upstream-foundation.md)).

Refreshed upstream on 28 October at
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`: MIT `LICENSE` and
`dashboard/js/views/photos.js`. Retained on-demand controls as a design idea;
independently implemented the owner-requested edge toolbar, shared navigation and
large-type default. No upstream code/assets or household photos were copied.
