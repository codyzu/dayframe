# Weather strip review — 5 November 2026

Local synthetic screenshots for [issue #23](https://github.com/codyzu/dayframe/issues/23),
on branch `codex/weather-day-strip`. These are rendered application screenshots,
not mockups or production/device evidence. Weather, warnings and all six agenda
items are fixtures; no household information or credentials are included.

- [Today, Firefox 1280 × 800](today-frame.png).
- [Tomorrow selected, Firefox 1280 × 800](tomorrow-frame.png).
- [Official-warning layout, Firefox 1280 × 800](warning-frame.png).
- [Tomorrow selected, mobile WebKit/iPhone 13 emulation](tomorrow-mobile.png).

A temporary Playwright investigation routed the existing weather/alert/calendar
fixtures, varied the seven daily forecasts, waited for weather and fonts, and
captured the actual built application with reduced motion. Its desktop captures
asserted document height at most 800px for today, tomorrow and the warning state.
Mobile is a full-page capture of the readable, scrollable layout. The temporary
capture-only case was removed from the permanent suite per the testing policy.

The visible dock is expected to temporarily cover the last agenda rows; it
retains its existing auto-hide behavior. The main panels do not move when it
hides. Actual frame/phone readability remains owner-observed acceptance in #18.
See the weather and display-density runbooks for behavior and rollback. These
captures were prepared before deployment; the owner subsequently approved the
layout and requested deployment.

## Location-pill text correction

The [updated header crop](location-pill.png) shows normal letter spacing and a
small amount of end padding inside the truncated place label. This prevents the
last glyph from being clipped by the greeting's inherited negative tracking.
Captured from the built application in desktop Firefox; existing GPS-label and
long-name cases also check desktop/mobile layout. Earlier full-frame captures
above predate this small typography correction.
