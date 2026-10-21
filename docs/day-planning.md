# Day-specific schedules and official days off

21 October 2026. Local implementation; deployment and household activation are separate.

## Behavior

The existing daily schedule remains the fallback. Optional private `planning.schedules`
provides a separate schedule for any weekday or `dayOff`. Each schedule has at most 24
non-overlapping half-open periods, including overnight periods. At each local instant,
the current day's profile applies to the entire 00:00–24:00 day: a Saturday's 23:00–08:00
Night period therefore ends at 08:00 Saturday morning. The existing IANA/DST resolver,
resume checks and inactivity override still apply; refreshing calendar data does not
renew an override. Schedule gaps retain the existing Morning fallback.

Priority:

1. A temporary display-local manual mode override.
2. A known school vacation or public holiday: `dayOff`.
3. A specific weekday profile, including Saturday/Sunday customizations.
4. Weekends: `dayOff` if no specific profile exists.
5. The existing daily schedule.

Specific schedules/checkpoints can fall back independently. The admin's **Jours de repos**
preset is Morning 08:00–11:00, Photos 11:00–23:00, Night 23:00–08:00. Saving a preset is
explicit; existing persisted schedules do not change automatically. Ordinary Wednesday
mode times remain the daily schedule unless customized separately.

`planning.checkpoints` holds up to four ordered private weather checkpoints per profile,
with a neutral label and forecast time. These are habitual weather reference
points. Activities and their durations stay in Google Family calendar. Temperature interpolation handles any minute (including
quarter hours); rain remains the conservative maximum of neighboring hourly values.
Labels are escaped before insertion into weather markup. Vacation/holiday profiles
replace Wednesday activities; Google Family and Massages events remain independent and
are still shown. No Google events or permissions are created or changed.

The upcoming-appointments panel displays the current public holiday and/or vacation,
including both when they overlap. Vacation labels show the inclusive final vacation
date (« jusqu’au »), rather than claiming a school return on a weekend or another
holiday. The notice does not consume either calendar's three-event allowance. Full
notice text remains in a tooltip if truncated; conditional spacing preserves frame fit.
Unknown/expired coverage shows **Calendrier scolaire indisponible · à confirmer**.

## Official sources and date handling

Annecy belongs to Grenoble, Zone A, confirmed by the Ministry's
[Annecy school directory](https://www.education.gouv.fr/annuaire/74960/annecy/ecole/0741180f/ecole-primaire-publique-sous-alery-cran-gevrier-annecy.html).
The Ministry's [school-calendar dataset](https://data.education.gouv.fr/explore/dataset/fr-en-calendrier-scolaire/)
documents an [official Zone A iCal export](https://fr.ftp.opendatasoft.com/openscol/fr-en-calendrier-scolaire/Zone-A.ics).
The iCal download was verified successfully outside the restricted network sandbox;
the initial in-sandbox lookup failed. The implementation uses the same Ministry source
through its verified JSON endpoint to avoid adding an iCal/timezone parser:

- `https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records`
- `location:Grenoble`, current and previous academic years, at most 100 records.
- Public holidays: `https://calendrier.api.gouv.fr/jours-feries/metropole/{year}.json`,
  documented by [DINUM/Etalab](https://github.com/etalab/calendrier.api.gouv.fr/blob/master/openapi.yml).

The actual Ministry responses were inspected: dates are UTC instants representing Paris
midnight; pupil and teacher summer periods differ; a one-day Ascension bridge may have
identical start/end dates, and the furthest published summer may specify only its start.
Normalize to Paris civil dates, exclude teachers, treat vacation ends as exclusive and
a point bridge as one day. A summer start without an end closes known coverage; no
rentrée is invented. Include the previous academic year so its summer can overlap the
start of September. [Ministry date semantics](https://www.education.gouv.fr/calendrier-scolaire-100148)
remain authoritative. Local school exceptions and family leave are not inferred.

This slice supports Grenoble/Zone A with `Europe/Paris`. A different configured timezone
shows unknown school-calendar status instead of interpreting French dates in that zone.
It does not infer whether an adult works on a public holiday. Additional academies,
personal leave dates and one-date overrides require a later slice.

## Storage, security and failure handling

`planning` is part of existing validated private settings and their existing export.
Default public settings contain no household routine and leave the official integration
disabled. The existing settings editor manages day profiles. The PATCH size bound is
32 KiB to accommodate eight schedules; per-field bounds and overlap validation remain.
No household activity/name is checked into source, fixtures or documentation.

`GET /api/day-context` uses the existing admin/display authentication and display home
network restriction. Admins can read remotely; displays have no mutation rights;
anonymous reads fail closed. Mutation origin protections remain. Responses are private,
no-store. The Worker fetches only fixed government hosts and rejects redirects, bad
responses, oversized bodies, missing school-year coverage and incomplete pagination.
Both provider requests run concurrently with eight-second deadlines.

Public official dates are cached in their own year-scoped record in the existing
Administration SQLite Durable Object, outside the household settings/credential record.
Refresh at most daily on normal reads. On provider failure, return the original dated
cache for at most 30 days; the screen labels old data. The browser checks hourly, retries
failures after a minute, and retries stale responses after five minutes. It holds dates
in memory and re-evaluates day/profile on the existing tick, including midnight, DST,
resume and backward clock corrections. Wrong-year, future-dated, expired or incomplete
coverage is unknown; it does not assert a school day or show habitual activities as
confirmed. Weekends remain known independently of the official feeds. No private habit
is written to persistent browser storage. Auth denial resets private planning and clears
rendered checkpoint labels; lifecycle aborts prevent late data writes.

No new binding, migration, dependency, paid service, billing change, hardware/native
change or scheduled Worker job. A household normally causes two government reads per
day plus small reads on its existing Free-tier infrastructure; exhaustion fails closed.

## Upstream and acceptance

Inspected Wes Bos `photo-frame-dashboard` at
`f1e0820918c926396e0ccafb4839568825f63edc`, root `LICENSE` (MIT),
`dashboard/js/views/home.js`, `dashboard/js/views/calendar.js` and `dashboard/js/system.js`.
Retain the glanceable day/event/weather hierarchy as a design reference. Independently
implement day-specific private routines and official French calendars instead of the
upstream mock agenda and client-side event creation. No upstream code/assets copied.

Full local verification passed: 120 unit/integration tests and 172 browser tests, with
four existing intentional skips. The [synthetic frame preview](evidence/m5/day-off-1280x800.png)
shows both observances beside six appointments. Detailed validation and current activation
state are recorded in the implementation plan.
Desktop tests and screenshots do not establish physical Classic 10 acceptance.
