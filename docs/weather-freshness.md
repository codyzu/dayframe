# Weather freshness and recovery

**Status:** Implemented locally · 27 October 2026 (F01). Production rollout and
physical-frame acceptance are separate. See the [delivery record](implementation-plan.md#f01-and-f02-weather-recovery-and-browsing--27-october-2026).

## Problem

A successful request can return old conditions. The current service treats any
validated response as a successful refresh and waits another 30 minutes, even when
the display already labels those conditions stale. “Dernier relevé” in Photos
does not explain when those conditions applied.

## Refresh behavior

- Keep separate timestamps for retrieval (`fetchedAt`) and the provider's current
  conditions (`current.time`). A recent retrieval must never make old conditions
  appear current. Retain the existing 45-minute freshness threshold and adapter
  validation limits.
- Normally refresh every 30 minutes, or when the retained data first becomes
  stale, whichever comes sooner. On startup, cached data that is already stale
  triggers an immediate request, even if retrieved less than 30 minutes ago.
- Failed requests and valid responses containing stale conditions share one
  recovery sequence: retry after 1, 5, 15, then every 30 minutes. A stale HTTP 200
  must not reset that sequence. Resume, online events and mode changes check the
  existing deadline without bypassing recovery backoff or duplicating requests.
- Reset recovery only after receiving valid, fresh conditions. Keep the existing
  12-second timeout and one scheduler/one in-flight request per display. Continue
  updating Photos when Morning is inactive.
- Request weather with browser HTTP-cache reuse disabled (`cache: 'no-store'`);
  retain the application's validated local fallback. This does not guarantee a
  fresh upstream response, so inspect its timestamp regardless of HTTP status.
- Never replace retained conditions with an older provider timestamp. A valid
  equal-timestamp response may refresh forecast fields, but cannot reset the age
  of the conditions. Keep usable cached data during failures; preserve existing
  unavailable and exhausted-forecast fallbacks.

## Display copy

**Age enhancement accepted 28 October 2026:** Use the configured location's timezone and French formatting, independently of
the browser timezone. Display the **conditions timestamp**, not the download time.

| State              | Morning/Photos label                        | Morning advice                                                                           |
| ------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Fresh              | `Relevé il y a 15 min`                      | Normal advice                                                                            |
| Stale today        | `Relevé il y a 50 min · non actualisé`      | Same label, followed by recovery/departure guidance                                      |
| Previous local day | `Relevé hier à 23:45 · non actualisé`       | Same warning and guidance                                                                |
| Earlier date       | `Relevé du 21 oct. à 23:45 · non actualisé` | Same warning and guidance                                                                |
| No usable data     | Existing unavailable placeholder            | `Météo indisponible. Nouvelle tentative automatique. Vérifiez la météo avant de partir.` |

Age uses `current.time`, never `fetchedAt`. Within today's local date use
“à l’instant” for under a minute, whole minutes below an hour, then whole hours.
At local midnight switch to “hier à…”; older dates are explicit. Include the year
when it differs from the current local year, taking precedence over “hier”.
The label advances on the existing minute scheduler while offline. Both modes
show a quiet fresh label and bold stale label; stale Morning advice retains its
warning. A failed refresh keeps the stale suffix even if conditions are young.
The semantic `<time>` holds the provider instant in `datetime`, with the exact
local date/time and configured timezone in its title and accessible label.
Future provider instants display their time rather than a negative age. A failed refresh
also shows the timestamp and warning, even if the retained conditions are under
45 minutes old. Hide stale warnings automatically after fresh recovery. Replace
Morning's generic stale heading with the same dated wording; avoid presenting
“mis à jour il y a 2 min” as evidence that old conditions are fresh. “Actualisation
automatique en cours” covers scheduled retries as well as an active request.

## Acceptance and scope

Verify with controlled clocks and responses: newly downloaded stale data; stale
startup cache; data aging past 45 minutes before its normal deadline; repeated
stale HTTP 200s and network failures following the same bounded backoff; older
response rejection; fresh recovery; resume/mode changes without duplicate calls;
and correct same-day, midnight, year and DST timestamp formatting. Check Photos
and stale Conseil du jour at both frame densities and mobile widths, without
overflow or stale departure advice presented as current.

Implement as one M2/M5 follow-up. Before implementation, refresh the required
upstream source/license review and record provenance in the plan. No provider,
proxy, dependency, billing or device change is needed. Update the household
request-budget calculation for stale-response retries; preserve €0 recurring cost.
Official vigilance has its own freshness policy and is outside this slice.
