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

## Weekly trend strip — review branch, 6 November 2026

The #24 review branch uses the same **99px** picker height measured on the
previous 1280 × 800 layout. A small left legend shares the day-label row; the
maximum-temperature line and adjacent millimetre bars occupy the remaining
horizontal space. Main weather typography, graph, four moments, header and dock
are unchanged. Day names are 18px, plotted maxima 18px and amount labels 16px;
background-coloured text halos keep crossing marks from obscuring values.

Seven full-height columns remain native buttons with explicit date/value names,
selected state and painted keyboard focus. Mobile preserves horizontal scrolling
instead of shrinking seven days into unreadable columns. The SVG is decorative
for assistive technology because each button exposes the equivalent values.
This is local synthetic screenshot-review evidence, not deployment or physical
acceptance. [Capture context](evidence/weather-trend/README.md).

## Compact Morning layout — 5 November 2026

Morning uses one frame-width header: greeting with a weather-location pill,
actual household date and clock. The pill opens the existing location picker;
long labels truncate inside it and remain complete in the picker. The separate
brand row and duplicate location above the clock are removed. Phones wrap the
header. Below are the seven-day selector, conditions/checkpoints/chart row, and
advice/agenda row. The selected forecast never changes the real header date.
The main weather typography tokens retain their large sizes. Seven-day labels
use 18px, with 16px Max/Min and 20px rain values. With an active warning, a compact
banner, smaller condition illustration and a 70px plot preserve useful space
without reducing the main weather text. Rain-axis and peak labels scale with the
plot. Full warning details and official links remain available.

The floating dock retains its existing anchor, auto-hide and reveal behavior.
Navigation instructions above it are removed; failures and retry controls remain.
On the frame it may temporarily overlap the last agenda rows while visible, as
accepted by the owner; do not reserve an empty full-width dock band or reflow the
cards when it hides. Phones retain scroll/focus clearance so content remains
reachable. This accepted overlap refines the no-clipping policy above only for
the temporary dock. The owner approved the #23 screenshot review; physical
acceptance remains #18.

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

Deployed on 28 October as `10e3c32` through
[release 40732168963](https://github.com/codyzu/dayframe/actions/runs/40732168963).
Full verification passed (160 unit/integration, 456 browser passes, four existing
skips, 44 navigation checks), followed by live smoke and independent artifact matching.
[Current synthetic screenshots](evidence/mobile-controls/README.md) include the
portrait toolbar, shared navigation, denied state and large-type native-frame layouts.
New physical phone/frame review remains separate.
