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
