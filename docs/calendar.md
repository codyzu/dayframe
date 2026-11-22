# Google Calendar on Morning

A single household Google connection supplies **Family** and the optional
**Massages** and **Routines** appointment calendars, plus up to two optional
calendars for observed holidays.
The connected account must be able to read each selected calendar. Continue
editing events in Google Calendar. Dayframe requests read-only event and
calendar-list scopes; it has no write scope or event-creation endpoint.

## Connect and operate

In `/admin/settings`, choose **Connecter Google Calendar**, authorize an account that
can read Family, then choose **Family** under **Agenda à afficher** and press
**Enregistrer les agendas**. Choose the shared massage calendar under **Massages · violet** before saving. Leave
that selection empty to remove it. Under **Routines · facultatif**, select the
Routines calendar and save with the same button. Clear the selection and save
to remove it from the frame. Use **Fêtes observées · agenda 1** and
**agenda 2** for your chosen Google holiday calendars, for example U.S. and
Muslim holidays. Existing selections remain in the first slot. Leave either
slot empty to omit that feed. Share or subscribe to the calendars with the
connected Google account first. **Recharger la liste Google** reloads options
without saving changes. All selections must be distinct. No additional OAuth consent
is needed for calendars already shared with the connected account. Calendar
names need not be unique: the saved selection uses
Google's verified calendar ID. Both existing administrators can manage the connection;
neither administrator needs to sign in on the frame. A normal Dayframe/Cloudflare
Access sign-in is separate from Google Calendar consent.

Morning prioritizes up to nine remaining events today across the selected calendars
in the household's configured timezone, including ongoing multi-day events.
All-day end dates are exclusive. Google expands recurring appointments and
exceptions (`singleEvents=true`); cancelled and self-declined entries are omitted.
The calendar label sits at the trailing edge of each appointment row with its
other badges. Titles use up to two lines before truncating visually. On narrow
screens the weather and badges share the trailing column. The row retains the original bounded title in
its title attribute. The card does not show descriptions, guest lists or locations.
**Aujourd’hui** shows remaining and ongoing appointments. All-day events appear
first, followed by timed events in local start order. Events at the same time stay
distinct. Every timed appointment shown for today or tomorrow
uses the household forecast at its start time, when fresh hourly coverage is
available. Between hours, temperature is interpolated and rain uses the higher
of the adjacent hourly probabilities. All-day events have no forecast time.
A device-local weather override keeps its weather separate from the household
calendar. Forecast browsing does not change the dates or events in the timeline.

Official public holidays, school closures and optional observances have named
labels above the timeline. Observances do not alter school or schedule rules.
Routines appear on weekends, public holidays and school breaks. Manage school-only
exceptions in Google Calendar so the frame follows the actual event schedule.
An all-day event whose title begins or ends with an explicit birthday keyword
gets a cake icon, such as `Anniversaire de Camille` or `Camille’s birthday`.

**Déconnecter Google Calendar** immediately deletes the server-side connection, pending
OAuth flow and cached events, then attempts Google token revocation. If Google is offline,
local disconnect still succeeds; remove Dayframe in the Google account's third-party
connections to ensure provider-side revocation. Reconnect after a revoked/expired Google
grant and select Family again. Changing the selected calendar clears the server cache.

## Routines calendar

Routines entries use a green source label in the same chronological timeline.
The ten-row budget gives remaining appointments priority, with tomorrow using
spare space. A busy day can show up to
nine appointments across the three selected sources. The private reader retains
up to eighteen appointment candidates across today and tomorrow. If Routines is
unavailable, Dayframe reports it and can still show Family and Massages.

Existing selections work without migration or new OAuth consent. Older settings
pages that omit the Routines selection preserve it. After upgrading, reload any
display still running the previous version before enabling Routines. Clear the
selection before rolling back if the stored selection should be removed.

Reviewed Wes Bos's upstream `dashboard/js/views/home.js`,
`dashboard/js/views/calendar.js` and MIT `LICENSE` at
`0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`. Retained the short today list and
visible calendar identity as ideas. Dayframe puts real, authorized Google events
in one timeline, independently of upstream's mock event lanes and chore list.
No upstream code or assets copied.

## Weather-sensitive events

Add `#meteo`, `#météo` or `#weather` to the description of a timed event in
Family or Routines. Use a standalone tag, for example on its own line. Case
and accents do not matter. For a repeating event, applying the edit to the series
sets the tag for its occurrences. Moving or cancelling an occurrence in Google
Calendar changes or removes its weather advice.

Dayframe reads the description in the private Worker and retains only an
eligibility flag, alongside the existing event fields. The description is
neither stored in the agenda cache nor sent to the display. No new consent
is needed. The flag shares the agenda's existing cache and privacy lease.
See [weather advice](weather.md#weather-advice-for-calendar-events) for when the
summary mentions an event.

## Private runtime setup

Create a dedicated Google Cloud project, leave billing unlinked, and enable Calendar API.
Create an External Google Auth Platform app and a **Web application** OAuth client.
Register exactly `https://YOUR-DAYFRAME-HOST/api/calendar/callback` as its redirect URI;
no JavaScript origin is needed for this server-side flow. This slice uses Google's
[web-server OAuth endpoints](https://developers.google.com/identity/protocols/oauth2/web-server).
The two requested scopes are:

- `https://www.googleapis.com/auth/calendar.events.readonly`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

Google's permission applies to accessible calendars; Dayframe limits fetching to the
selected IDs. Do not request the owned-only events scope: a shared Family calendar may be
owned by the other spouse.

Configure four **Worker runtime secrets**, never public/build environment variables:

| Secret                 | Value                                                     |
| ---------------------- | --------------------------------------------------------- |
| `GOOGLE_CLIENT_ID`     | Web client ID                                             |
| `GOOGLE_CLIENT_SECRET` | Web client secret                                         |
| `GOOGLE_REDIRECT_URI`  | Exact registered HTTPS callback on the deployed origin    |
| `CALENDAR_TOKEN_KEY`   | A cryptographically random 32-byte key, base64url encoded |

Generate the encryption key once, keep it privately backed up, and reuse it across
Worker deployments. Rotating/loss of this key requires reconnecting Google. Store local
credentials only in ignored `.dev.vars` or `private/`, with owner-only permissions.
Wrangler `secret bulk` accepts an ignored JSON file containing these four entries. Use
the ignored generated production Wrangler configuration, retaining existing bindings
and secrets; never write real values into `wrangler.jsonc` or GitHub source.
The existing Administration SQLite Durable Object is reused; no migration, new binding,
paid product or new package is needed. Existing settings exports exclude calendar state.

External OAuth apps start in **Testing**. Add the connecting account as a test user for
initial acceptance. Google's Testing status expires refresh tokens for these scopes
after seven days. Before relying on unattended operation, change the publishing status
to **In production** and reconnect if necessary; review Google's consent/verification
requirements for the personal-use deployment. Production status does not make Family
public, grant access without consent, or remove Dayframe's administrator allowlist.
An unverified-app notice may remain for a personal app; do not claim Google verification.
See [Google's token-expiry rules](https://developers.google.com/identity/protocols/oauth2#expiration).

## Security and limits

All calendar endpoints pass through the existing Worker authentication. Events allow an
administrator remotely or a provisioned display on the approved home network. Connection
status, calendar list, connect/callback, selection and disconnect require an administrator.
POST/PATCH/DELETE require same-origin requests and the existing custom request header.
The callback separately verifies a ten-minute random state, initiator identity, Secure
HttpOnly SameSite=Lax browser nonce cookie and PKCE S256. State is consumed once before
code exchange. The configured HTTPS callback must match the request origin.

Access/refresh tokens are encrypted with AES-256-GCM (compact JWE using the existing
`jose` dependency) before persistence. Codes, tokens and provider error bodies never appear
in browser JSON, public HTML, bundles, settings exports or logs. Calendar state occupies
its own internal Durable Object record. Transactional revision checks prevent a delayed
callback, token refresh or event request overwriting a newer disconnect/selection.
No generic server fetch endpoint or caller-selected provider URL exists.

Successful event responses are cached centrally for up to four minutes, including empty
results. The private Durable Object stores the bounded today/tomorrow candidate
appointments, today's bounded observances, and their fetch time/timezone. The
latest cache remains in private storage until replaced or
removed by selection/disconnect. Provider requests have timeouts, fixed Google origins,
redirect rejection, bounded response bodies and at most ten sequential pages. Reads use
[Google's events list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list)
and [calendar list](https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list).

The browser refreshes while Morning is visible, keeps events only in memory and never
uses localStorage or a service worker for appointments. Private API responses are
`private, no-store`. Errors clear events immediately; otherwise the maximum browser
privacy lease is five minutes from the provider fetch, enforced with wall and monotonic
time. Midnight, backward clock jumps, page hiding and page lifecycle transitions clear
private entries/revalidate. Existing configuration authorization failures also clear
agenda data. Frozen browsers enforce expiry on resume; no guarantee of background
JavaScript execution is assumed. Server cache means a Google-side calendar change or
revocation may take up to four minutes to be detected; no real-time push is promised.

A household fetching every four minutes remains tiny standard Calendar API usage;
[standard use has no additional cost](https://developers.google.com/workspace/calendar/api/guides/quota).
Do not attach billing or opt into paid quota increases. Workers/Administration retain
the existing Free plan gate and fail closed on quota/provider failures.

## Provenance and acceptance

Inspected upstream Wes Bos `photo-frame-dashboard` local checkout
`3969b453b9375f7cb63cf9931e983e2657f97852`, including
`dashboard/js/views/home.js`, `dashboard/js/views/calendar.js` and root `LICENSE` (MIT,
Copyright 2026 Wes Bos). Retain the idea of a short remaining-event list and all-day/timed
separation. Intentionally use a real private Google reader, French Astro/UnoCSS agenda,
existing Worker auth and actual configured IANA time instead of upstream's mock events,
full calendar grid and client-side event creation. No upstream code or assets copied.
This is the local revision actually inspected, not an assertion about current remote HEAD.

Unit/integration tests exercise the authenticated Worker router and real workerd SQLite
storage with synthetic Google responses. Browser tests use synthetic appointments and
Google navigation across Chromium, Firefox, WebKit and mobile. Local success does not
prove live consent, Family calendar access, token longevity, or physical frame acceptance.
Record current verification/deployment status in the implementation plan.

## Two-calendar display — 21 October 2026

Family uses a muted rose-red accent and Massages a violet accent, with persistent text
labels so colour is not the only distinction. One chronological list fills the wider
lower-right panel beside weather advice.
All-day events come first, then both calendars mix by start time; up to three events
from each calendar remain available. Pastel rose-red/violet row backgrounds and visible per-row labels identify
the source. Times, titles and the visible per-row Family/Massages labels use dark text,
so source identification does not depend on distinguishing colours. Mobile retains the same list.
Current and forecast weather remain the first visual tier. Desktop navigation
floats over the bottom on touch and disappears after the existing timeout, reclaiming
its reserved row. Weather attribution and methodology remain accessible in a discreet
10px footer with 24px targets. Event text retains the existing adjustable rem sizes.

The existing single-calendar selection/cache remains readable as Family. Saving either
selection validates both against Google's accessible calendars and clears the complete
cache atomically. Both calendars share the existing encrypted connection, revision
checks and five-minute browser privacy lease. Failure reading either calendar clears
the full agenda; no stale or misleading partial success is shown. Fetch pagination is
bounded to ten pages per selected calendar. No new permissions, package or service.

## Tomorrow preview

Morning’s **Aujourd’hui** column gives today's appointments priority within
the ten-row budget. A divider labelled **Demain · weekday** uses one spare
row, then up to eight of tomorrow’s earliest new appointments can fill the rest.
When today is empty, its status message uses one row. All selected appointment
calendars share the available rows in start order within each day.
An empty tomorrow is labelled explicitly whenever its section fits;
the preview never skips ahead to another day. All-day events precede timed entries.
Events spanning both days appear under today only, then become today’s entries
after midnight revalidation.

The same authorized reader now queries through the end of tomorrow in the household
timezone, using local date boundaries across 23/25-hour days rather than adding
24 hours. It retains up to nine candidates per day across all selected calendars
(eighteen total). The browser applies the shared row budget so finished events
can free preview space between refreshes. The first read after upgrading refreshes
caches made with per-calendar quotas. Saved selections and consent carry over.
On rollback, the preceding version applies its own rules immediately and refills
from Google on its next regular refresh.
The four-minute server refresh, five-minute browser privacy lease, midnight/hiding/
access-denial clearing, no-store responses and read-only OAuth scopes remain.
There is no extra periodic request or new service, dependency or recurring cost.
The public calendar privacy page describes the expanded candidate bound.

Reviewed upstream main at `346b712b8f3c42e7407baae3c620116ebae9c85e`, including
the root MIT `LICENSE` and `dashboard/js/views/{home,calendar}.js`. Dayframe keeps
the ideas of a short remaining list and a next-morning preview. Upstream gives
each person a short lane on its home view. Dayframe uses a single shared list of
authorized Google events with a fixed row budget and source labels. No upstream
code or assets were copied.

## Household observances

The two calendars share a total limit of two distinct, all-day titles active
on today's household civil date. When both sources have entries, each can
contribute one before the other adds a second. A title is bounded to 120
characters. Google’s explicit `tentative` status appears as **Date à confirmer**.
The official French public holiday and school feeds still determine day-off
schedules. Google observances are display only.

The sources share the four-minute server cache and five-minute browser privacy
lease. An unselected slot adds no request. If a source fails, the frame can
show a notice alongside the healthy source and appointments. Calendar names,
provider IDs and event descriptions stay off the display. Empty selections clear
their respective source and invalidate the cache. Older clients that omit the
second slot retain the saved choice. No OAuth, storage migration, or paid
service is needed. Clear the second slot before rolling back if it should also
be removed from saved settings.

This extension re-reviewed Wes Bos's `dashboard/js/views/home.js` and MIT
`LICENSE` at `0bff55ef3fb2a3bfdab05bc8e3bd0c9d69f63189`. Dayframe keeps the
short current-day list and independently merges private read-only sources.
No upstream code or assets copied.

Reviewed upstream `dashboard/js/views/calendar.js` and the MIT `LICENSE` at
`f1e0820918c926396e0ccafb4839568825f63edc`. Dayframe retains the distinction
between all-day and timed entries and uses independent private Google calendar
reads. No upstream code or assets copied.

### Emoji in appointment titles

The Aujourd’hui and Demain rows keep the original calendar title as text.
Manrope handles the lettering and Dayframe serves Fluent Emoji Flat for emoji
before falling back to the system font. Each color format keeps joined sequences
in one font file. GeckoView and Chromium can select COLRv1, and WebKit can
select the OpenType SVG version. Astro fingerprints both assets, and Cloudflare
gives their URLs a one-year immutable browser cache policy. A new font produces
a new URL. The build reads the local assets without a separate font download.
See the [third-party notices](../THIRD_PARTY_NOTICES.md) for font provenance.

Upstream reference reviewed at `e97c50ba459c49ea8237259f69b95cd28054b628`:
`dashboard/js/views/calendar.js` escapes titles and inserts them as text, and
`dashboard/css/base.css` inherits the dashboard's text stack. Dayframe retains
its existing text insertion and applies a local emoji fallback only to agenda
appointment titles. No upstream dashboard code or artwork was imported.

### Compact appointment rows

Appointment rows reserve two lines, with start above end in the time column.
Times use the household timezone. An end on a different date includes that date.
An ongoing appointment shows
`En cours` and its end time, with a date if it ends after today. All-day entries
retain `Journée`.

On the Massages calendar only, a recognized French Cal.com title such as
`Massage 60 minutes VIP entre Studio Exemple et Camille Martin` displays
`Camille Martin` and the scheduled duration beside the colored calendar label.
Duration comes from elapsed time between the event timestamps. Unrecognized
and ambiguous titles keep their original text. The transformation runs in the
display; the Google event, private response shape and retention are unchanged.
Reverting the display code restores the previous rendering without a data migration.

Upstream review at `f1e0820918c926396e0ccafb4839568825f63edc` covered
`dashboard/js/views/calendar.js` and the MIT `LICENSE`. Its event cards show a
time range beside escaped text. Dayframe uses the same presentation idea with
the household timezone and a Massages-only rule. No source was copied.

## Client-facing massage welcome

The existing `/?display=frame` kiosk address can use the selected **Massages**
calendar to replace the household dashboard with the practice logo. The feature
is off by default. From a signed-in phone at `/admin/settings`, open **Accueil
des clients** and select **Activer l’accueil sur le cadre**. Keep the frame
online long enough to receive the change and verify the installed offline
fallback has updated before relying on it. The same household controls apply
to any authorized kiosk using the frame address. Ordinary dashboard visits
without `display=frame` keep their usual modes.

Timed Massages entries trigger the welcome 10 minutes before the scheduled
start until 30 minutes after the scheduled end. Cancelled, declined and all-day
entries are ignored. Overlapping windows keep the welcome active. On the
frame, tap to reveal the × (or Tab to focus it), then activate it for one minute
of clock and current-weather display. The logo returns automatically if the
window is still active. Both views hide family photos, the agenda and normal
mode controls. The neutral background remains if the logo is unavailable.
The native two-finger maintenance shortcut and liveness probe are retained.

To end the welcome early, confirm **Terminer l’accueil sur le cadre** in
`/admin/settings`. The dashboard resumes its scheduled mode, which may be
Photos. This dismisses the buffered windows already active at confirmation.
A later booking or a changed appointment can start the welcome again.
The frame normally picks up the action on its next check, within 15 seconds
while enabled or within one minute when first enabling from the ordinary schedule.

### Calendar data and outages

The authenticated welcome endpoint uses the existing read-only Google connection
and requests only Massages start/end/status fields and the current attendee's
response. Its bounded range extends from 30 minutes in the past to 24 hours ahead
in UTC; the response contains only buffered timestamps and fetch time. The same
private Administration object caches timings for up to four minutes and serializes
settings and dismissals with the existing revision check. Calendar edits may
take until the next refresh to appear. The browser keeps timings only in memory
and requires a fresh snapshot to leave the protected screen.

At a 15-second polling interval, one continuously visible enrolled frame adds
at most about 5,760 scheduled Worker requests per day. The shared four-minute
cache normally adds up to 360 Google refreshes per day for a one-page calendar.
These estimates exclude retries, manual refreshes and existing feature traffic.
The design reuses the [Workers Free limits](https://developers.cloudflare.com/workers/platform/limits/),
[SQLite Durable Object allowance](https://developers.cloudflare.com/durable-objects/platform/pricing/)
and [standard Calendar API usage](https://developers.google.com/workspace/calendar/api/guides/quota).

An enrolled frame shows the neutral screen when timings are unavailable, stale
or unauthorized. Once enrolled, it also suppresses saved-photo playback on an
offline restart and offers to reconnect. Only a local enrollment flag is needed
for this decision. No client title, calendar contents, interval, or new photo
data is persisted by the browser. Existing saved photos and their retention
limits are unchanged. An offline frame cannot learn a setting it has never
received. Reconnect and verify enrollment after clearing browser storage or
moving to a new profile.

### Compatibility and rollback

Existing schedules and settings exports require no migration. Disable the feature
from phone admin and let the frame confirm the change online before reverting
to an older build. This clears the local flag and restores ordinary offline
behavior; it leaves the selected calendars and saved photos intact. There is
no native APK change, new service or paid resource.

The artwork comes from `assets/logo-vertical-dark.svg` and the cream surface token in
`src/styles/design-tokens.ts` from the Les Mains de Sérénité website repo. The
logo is from commit `6c4ce5a38a5cc22939cfaaf415087e80b443a179` and is used for
the owner's requested display; its rights remain with the practice. Reviewed
Wes Bos's `dashboard/js/app.js`, `dashboard/js/views/home.js`, and MIT `LICENSE`
at `f1e0820918c926396e0ccafb4839568825f63edc`. The clock and weather follow the
upstream glanceable layout idea. Dayframe implements its own calendar-based
privacy gate and time-limited control with the existing kiosk panel contract.
No upstream source or artwork was copied.
