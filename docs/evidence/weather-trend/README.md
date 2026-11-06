# Weekly trend review — 6 November 2026

Local synthetic screenshots for [issue #24](https://github.com/codyzu/dayframe/issues/24),
branch `codex/weekly-weather-trend`. These show the actual built application with
fictional weather, warnings, day-off context and six synthetic agenda events.
No household data, live provider data or credentials appear in the captures.
Owner screenshot approval is required before merging or deploying this branch.

- [Wet week, today selected](wet-today-firefox.png).
- [Wet week, Sunday selected](wet-sunday-firefox.png).
- [Warning and day-off with a full agenda](wet-warning-firefox.png).
- [Summer warming trend](heat-today-firefox.png).
- [Summer peak day selected](heat-peak-firefox.png).
- [Mobile today](wet-today-mobile.png).
- [Mobile Sunday selected](wet-sunday-mobile.png).

Firefox captures are exactly 1280 × 800; mobile captures are full-page iPhone 13
WebKit emulation. Reduced motion keeps illustrations still during capture. The
visible dock may temporarily overlap the last agenda rows, as already accepted.

The previous built picker at baseline `6b1bfcd` measured **99px** high. The new
picker measured **99px** in every captured desktop scenario and on mobile, using
its actual `getBoundingClientRect().height`. Desktop capture cases also asserted
that the complete page stayed within 800px. The graph, conditions and advice below
the picker keep their existing typography and layout.

Capture-only Playwright diagnostics used existing weather, alert and configuration
fixtures; they were removed from the permanent test suite after visual review.
Existing weather-selection/layout/focus journeys protect the browser behavior;
pure geometry, amounts, missing-day gaps and provider validation stay in Vitest.
Screenshots are review evidence, not automated pixel baselines or physical-device
acceptance. Real frame/phone observation and existing owner deferrals remain #18.
