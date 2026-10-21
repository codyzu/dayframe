# Google Calendar on Morning

20 October 2026. A single household Google connection supplies up to two selected calendars:
**Family** and **Massages**, both readable by the connected account. Continue editing events in Google
Calendar. Dayframe requests read-only event and calendar-list scopes; it has no write
scope or event-creation endpoint.

## Connect and operate

In `/admin/settings`, choose **Connecter Google Calendar**, authorize an account that
can read Family, then choose **Family** under **Agenda à afficher** and press
**Afficher ces agendas**. Choose the shared massage calendar under **Massages · violet** before saving. Leave
that second selection empty to remove it. The two selections must be distinct. No
additional OAuth consent is needed when both are already shared with the connected
account. Calendar names need not be unique: the saved selection uses
Google's verified calendar ID. Both existing administrators can manage the connection;
neither administrator needs to sign in on the frame. A normal Dayframe/Cloudflare
Access sign-in is separate from Google Calendar consent.

Morning shows up to three remaining events **per calendar** today in the household's configured timezone:
all-day entries first, then timed entries in start order, including ongoing/multi-day
events. All-day end dates are exclusive. Google expands recurring appointments and
exceptions (`singleEvents=true`); cancelled and self-declined entries are omitted.
A long title truncates visually, retaining its complete bounded title in DOM text and
the title attribute. The card does not show descriptions, attendees or locations.
School/weather checkpoints remain habitual labels, independent of appointments.

**Déconnecter Google Calendar** immediately deletes the server-side connection, pending
OAuth flow and cached events, then attempts Google token revocation. If Google is offline,
local disconnect still succeeds; remove Dayframe in the Google account's third-party
connections to ensure provider-side revocation. Reconnect after a revoked/expired Google
grant and select Family again. Changing the selected calendar clears the server cache.

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
two selected IDs. Do not request the owned-only events scope: a shared Family calendar may be
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
results. The private Durable Object stores only the bounded displayed events and their
fetch time/timezone; the latest cache remains in private storage until replaced or
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
