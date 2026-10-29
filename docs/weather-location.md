# Weather location on each device

The weather location in the dashboard header opens a French location picker.
When vigilance hides the decorative header on the frame, the vigilance details
also provide a “Changer de lieu météo” button.
Search for a town or postal code, then choose a result identified by region and
country. The dashboard keeps the short town name for readability. The choice
applies to this browser profile on this origin, including its other tabs; another
phone, browser profile or the frame keeps its own choice or the household default.
It is available on the public example dashboard as well as signed-in displays.

“Utiliser ma position” requests browser geolocation only after a tap. It rounds
coordinates to two decimal places before sending them to Open-Meteo, resolves the
timezone with `timezone=auto`, and offers “Ma position” for selection. No background
tracking or automatic permission prompt occurs. HTTPS, browser permission and an
available geolocation implementation are required. Denial, timeout or provider
failure leaves town search usable. Position is a snapshot, not travel tracking.

“Revenir au lieu de la maison” removes the browser preference and uses the latest
authorized household configuration, or the public Annecy example when unauthorized.
Outside `?display=frame`, the separate administration link opens the existing
authenticated settings editor for household-wide changes. Frame mode omits the
admin entry entirely, preserving the kiosk navigation boundary. The picker itself never writes household settings.

## Time and coverage

Weather requests, daily boundaries, graphs, seven-day forecasts and weather caches
use the chosen location's timezone. The dashboard clock/date, display-mode schedule,
day-off planning and appointments retain the household timezone. The picker
explains this distinction and displays the active weather timezone.

With a browser preference, weather checkpoints use neutral Matin, Midi,
Après-midi and Soir labels at 08:00, 11:30, 16:30 and 18:00 in the selected
weather timezone. Household school/activity labels must not imply that those
activities happen in a travel destination. Reset restores household checkpoints.
The current departmental vigilance implementation supports only the exact default
Annecy coordinates; all other coordinates retain the explicit unsupported-location
state. Choosing another town in Haute-Savoie does not silently extend coverage.

## Persistence, privacy and recovery

`dayframe.weather-location.v1` in localStorage stores only the validated location
name, coordinates and IANA timezone. Unknown fields are removed, invalid/outdated
shapes are ignored, and inaccessible storage falls back to this visit's in-memory
choice with explanatory status text. Browser data clearing resets the preference.
The dashboard URL never contains the preference. No household settings, photos or credentials are
copied into it. Existing location-keyed weather caches and photo retention rules
remain unchanged. A private browsing session may forget the choice when closed.

Search input or rounded GPS coordinates go directly to Open-Meteo, with omitted
credentials and referrer, only in response to an explicit action. The picker names
that provider and attributes Open-Meteo/GeoNames. Town-center coordinates from
search are public place coordinates. No server geolocation log or new binding is
introduced. This preference is ordinary browser data, not encrypted storage.

Changing location stops the old weather service before changing its context,
clears previous readings/icons/checkpoints/charts, then starts a service for the
new location. Old asynchronous results cannot repaint or populate the new cache.
New-location failure shows unavailable weather or that location's valid cached
forecast. It never relabels the previous town's conditions. Household configuration
refresh and access denial preserve the browser choice while existing private
content denial/clearing remains in force. Reset always uses the latest household
configuration. Closing the picker/page cancels pending location work; an outstanding
native permission request can finish but its result is ignored after cancellation.

## Providers and cost

Reviewed 29 October 2026: [geocoding API](https://open-meteo.com/en/docs/geocoding-api),
[forecast API](https://open-meteo.com/en/docs) and [terms](https://open-meteo.com/en/terms).
Free noncommercial use and attribution apply. The published free limits are fewer
than 10,000 calls/day, 5,000/hour and 600/minute, shared by IP/application.
No paid endpoint, account, dependency or automatically billed service is added.

Search is explicitly submitted, not requested per keystroke: one request per
submission, up to eight results. GPS adds one timezone lookup per successful
position action. Neither operation automatically retries; each request has a
12-second bound and GPS acquisition has a 10-second bound. At most one location
operation remains active; replacement or closing cancels it. Each distinct chosen
location can trigger one immediate weather request, followed by the existing
30-minute refresh and bounded failure backoff. A continuously open browser normally
uses about 48 forecast requests/day; three browsers about 144, plus manual actions
and stale-response recovery described in [weather operations](weather.md).
Rapid manual selections can add requests; this is not a provider-quota guarantee.

## Implementation and provenance

The Astro `WeatherLocation` component and `weather/location{,-picker}.ts` own the
picker, validation and storage. The dashboard controller applies the device
preference over weather fields only; `formatClock` receives the independent
household timezone. The weather view supplies neutral checkpoints and clears
old readings when remounted. Touch navigation already excludes modal dialogs.
Utilities provide the layout and controls; the component's scoped backdrop rule
matches the existing forecast modal. An absolutely positioned header button extends its touch area by 4 px above
and below the existing badge without changing header flow height; its focus
outline has clearance inside the page padding. Weather sections use a 6 px gap
instead of 8 px to retain clearance in the busiest Firefox calendar layout; type
sizes and touch controls are preserved. No global CSS or authentication change.

Refreshed upstream main through GitHub on 29 October 2026:
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`. Inspected
`dashboard/js/views/home.js` and root `LICENSE` (MIT, Copyright 2026 Wes Bos).
Retain upstream's glanceable current-weather/hourly hierarchy as an idea;
independently implement the browser preference and live-provider integration on
Dayframe's Astro/UnoCSS architecture rather than upstream's global mock data.
No upstream code/assets copied.

## Validation and release

Unit tests cover malformed preferences/provider results, coordinate/timezone
validation and blocked storage reads. Browser tests cover search, device isolation,
reload persistence, configuration refresh/reset, independent household time,
unsupported vigilance, opt-in rounded GPS, permission denial, empty/error responses,
Escape/focus return, blocked writes and clearing old readings on fetch failure.
Delayed old weather responses cannot overwrite the selected forecast/cache.
Synthetic desktop and iPhone emulation evidence does not establish physical
iPhone permission-sheet, keyboard or Classic10 acceptance.

Release uses the existing main-push Checks workflow and its verified-assets/free-plan
gate; see the dated [implementation record](implementation-plan.md). Rollback uses
the previous Cloudflare Worker version or a revert through that workflow. Previous
builds ignore the additive localStorage key; no migration or data deletion is needed.
The independent minimal offline fallback remains photo/time-only, without a picker.

Production closeout: source `54b9559` deployed through
[release 40968059381](https://github.com/codyzu/dayframe/actions/runs/40968059381).
Full verification passed: 176 unit/Worker tests, 576 browser cases (four existing
skips), and 44 offline-navigation cases. Independent anonymous smoke checks and
[17 live-file hashes](evidence/weather-location/live-assets.json) matched the tested
release. Real town search/selection/forecast/reset and household clock independence
also passed in an isolated mobile WebKit context on production. Actual iPhone
permission/keyboard and frame acceptance remain separate.
