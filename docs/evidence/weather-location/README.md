# Device weather location evidence

Local synthetic evidence, 29 October 2026. Public example towns, fixture weather
and placeholder agenda states only; no household location, photos or credentials.

- [Phone search results](phone-search.png)
- [Phone selected location](phone-picker.png)
- [Frame search results](frame-search.png)
- [Frame selected location](frame-picker.png)

The desktop viewport is 1280 × 800; the phone uses Playwright iPhone 13 WebKit
emulation. The dialog scrolls on smaller screens while keeping controls reachable.
Town search results preserve region/country disambiguation; selected dashboard
headings use the short town name. The household clock stays at 08:30 while the
weather timezone is America/New_York.

All 60 targeted browser scenarios passed across Chromium, Firefox, WebKit and
iPhone emulation: nine location cases per browser plus existing calendar and
rendered focus checks. All 176 unit/Worker tests, type checks, lint and production
build passed (four existing complexity warnings). Public live provider checks
parsed Annecy search results and resolved rounded New York coordinates to the
expected timezone. See the [feature contract](../../weather-location.md) and dated
[release record](../../implementation-plan.md) for full verification/deployment.
These captures do not claim physical iPhone permission/keyboard or frame acceptance.

[Release 40968059381](https://github.com/codyzu/dayframe/actions/runs/40968059381)
deployed source `54b9559` after 176 unit/Worker tests, 576 browser cases (four existing
skips), and 44 offline-navigation cases passed. The independent
[live-file comparison](live-assets.json) matched 17 files against the verified
artifact, including all public JavaScript/CSS and offline entry points. Anonymous
smoke checks and real town search/selection/forecast/reset in isolated mobile
WebKit passed. No signed-in household session or personal location was used.

## Current-position header polish — 30 October 2026

Reviewed synthetic [phone](phone-current-position.png) and
[desktop](desktop-current-position.png) captures show the one-line place pill and
“Bonjour.” GPS greeting. The phone capture retains keyboard focus after closing
the picker, showing the complete outline. No personal GPS coordinates were used.
All 76 focused location/foundation browser checks passed across the four engines
and layouts above, including 320px long-town-name fit, accessible device context,
44px minimum touch area, cancellation, persistence/reset and existing focus checks.
Types, lint, build and three location unit tests passed. Local evidence only;
these changes have not been deployed.

## Precise GPS and estimated city — 30 October 2026

The current-position phone/desktop captures above are refreshed to the final
“Près de New York” label with fixture weather. All supplied GPS decimal places
are retained through selection, storage, reload and scheduled forecast refresh.
Tests cover empty/malformed/failed/timed-out naming, ignored late results, legacy
preferences and long-town-name header fit. Across focused runs, 112 distinct
location/foundation/focus browser cases passed; all 179 unit/Worker tests and
types/lint/build passed. A separate isolated mobile WebKit check used real
Photon/Open-Meteo responses and a public Annecy point, returning “Près d’Annecy”
and Europe/Paris without replacing the coordinates. No personal GPS data used.
Source implementation is locally verified; release evidence follows below.

Production closeout: [release 41036425591](https://github.com/codyzu/dayframe/actions/runs/41036425591)
deployed source `9cc4816` after 179 unit/Worker tests, 600 browser passes (four
existing skips) and 44 offline-navigation passes. Independent
[live-file comparison](gps-city-live-assets.json) matched 17 files to the exact
verified artifact; repeated anonymous access/no-store smoke checks passed.
An isolated mobile WebKit context on production used real providers with a public
Annecy example point, selected “Près d’Annecy”, and retained the original
coordinates and Europe/Paris timezone. No personal location or session was used.
Earlier pending/local-only notes describe their preceding stages.
