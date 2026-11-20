# Readability and shared navigation

## Journal alpin Morning

The Morning view uses a wide weather column and the narrower **Aujourd’hui**
timeline. The left holds the household clock, the weather location, current
conditions, advice, the split hourly chart and the seven-day selector. The
timeline lists private appointments and routines. Timed appointments shown today
or in the tomorrow preview receive the forecast at their start time when fresh
household weather has coverage. All-day appointments have no default forecast
time. A device-local weather location keeps its forecast independent of household
appointments.

The lake art uses three conditions (clear, cloudy and snowy) across night, dawn,
day and dusk. Fresh WMO readings select the condition group. Provider sunrise
and sunset select the light phase when available. Rain, fog and snow have
separate static overlays, and only the selected approximately 512 × 250 WebP
is requested.
Missing and stale readings use neutral cloudy art and keep their status text.
The dark fallback preserves legibility if a file is unavailable. No new
cache, image provider, runtime image generation, or looping scenery motion.
The full-width warning band sits above both columns. The shared frame dock is
anchored at the lower right in every mode so forecast controls remain accessible.

Observance symbols are separate from the weather. Selected household calendar
entries can show a lantern, an active Ramadan entry shows a crescent, and an
official school break shows a kite. Dedicated symbols cover Christmas, New
Year, Easter and July 14 when supported by calendar data. July 4 appears only
for an explicitly named U.S. Independence Day in the selected observance
calendar on that date. A decorative symbol cannot change the day profile.

The twelve public assets in [weather-window](../public/weather-window) were
generated with built-in ImageGen using the preceding lake concept as a camera
reference. The generated atlas was cropped and encoded as individual WebPs
without metadata. [Generation prompt and matrix](journal-alpin-art.md).

Reviewed upstream `dashboard/js/views/home.js`, `dashboard/js/views/calendar.js`
and `dashboard/css/views/home.css` at
`f1e0820918c926396e0ccafb4839568825f63edc` (MIT). The emphasis on a glanceable
clock and next event follows upstream ideas. Dayframe uses its own chronological
timeline, generated art and authenticated data. No upstream code or art copied.

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
large temperature, description, advice, chart and navigation sizes.
Night and photo clocks retain their large responsive sizing. The 1280 × 800 frame
must continue fitting without clipping, including six appointments and warning/day-off
states. Phones can scroll Morning content; bottom clearance keeps it reachable above
the shared navigation.

## Weekly trend strip — 6 November 2026

The #24 trend strip uses the same **99px** picker height measured on the
previous 1280 × 800 layout. A small left legend shares the day-label row; the
maximum-temperature line and adjacent millimetre bars occupy the remaining
horizontal space. Main weather typography, graph, four moments, header and dock
are unchanged. Day names are 18px, plotted maxima 18px and amount labels 16px;
background-coloured text halos keep crossing marks from obscuring values.

Seven full-height columns remain native buttons with explicit date/value names,
selected state and painted keyboard focus. Mobile preserves horizontal scrolling
instead of shrinking seven days into unreadable columns. The SVG is decorative
for assistive technology because each button exposes the equivalent values.
The owner approved this layout after screenshot review. Local synthetic evidence
remains separate from physical-device acceptance. [Capture context](evidence/weather-trend/README.md).

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

## Morning visual hierarchy

Morning uses semibold supporting text at the existing large sizes. The clock,
temperatures, appointment times and advice headline remain prominent. Agenda rows
show the calendar name in a fixed-width tinted label at the right edge. Routine
advice uses a pale warm surface so official vigilance stands out when present.
The four main panes on the frame have 12 px gaps in both directions and 16 px
corners. The smaller checkpoint tiles have 12 px corners.
On the frame, the date sits beside the clock with the landscape fading before
the digits. The hourly plot puts temperature above rain probability with a shared
time axis and current-time marker. The agenda gives the next timed appointment
more weight, including tomorrow when it is the next appointment shown.

The paper and ink palette and emphasis on the clock and temperature follow ideas
from Wes Bos's dashboard. Reviewed `dashboard/css/tokens.css` and
`dashboard/css/views/home.css` at `e97c50ba459c49ea8237259f69b95cd28054b628`.
Dayframe uses its own Manrope weights, neutral agenda rows and Astro components.
The upstream revision has no root license, and this pass copies no code or assets.

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
