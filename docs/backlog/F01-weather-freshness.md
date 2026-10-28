# F01 — Weather freshness and stale copy

Status: implemented locally 27 October 2026; rollout/device acceptance separate. P1 / M. No device or provider change required.
Follow the [delivery contract](delivery-contract.md).

## Evidence and target

Read [the existing detailed requirements](../weather-freshness.md), specification
§4.2 and `src/lib/weather/{adapter,service,view,morning}.ts`,
`src/lib/photos/weather.ts`, `src/components/PhotoSlideshow.astro`.
`createWeatherService` resets failures and schedules 30 minutes after every valid
response, regardless of conditions age; `fetchWeather` does not disable HTTP cache
reuse. Photos only toggles its stale label. This confirms the existing proposal is
still unimplemented at the audit revision.

## Implementation

1. Make conditions time and retrieval time explicit in scheduling decisions. Use
   the existing 45-minute stale threshold; request at the earlier refresh/staleness
   deadline. Already-stale startup data requests immediately.
2. Treat stale HTTP 200 and failures as one 1/5/15/30-minute recovery sequence.
   Prevent already-expired freshness deadlines from spinning the timer during
   recovery. Preserve one request, cancellation/generation handling and timeout.
3. Reject an older conditions timestamp without discarding retained data. Equal
   timestamps can update forecasts but cannot reset conditions age/backoff. Fresh
   validated conditions reset recovery. Fetch with `cache: 'no-store'`.
4. Share timezone-aware dated stale wording between Morning advice and Photos,
   following the existing proposal exactly, including failed refresh of fresh data.
   Keep official vigilance's independent policy unchanged.
5. Update request-budget documentation for persistent stale responses and record
   upstream review; no proxy or new dependency is needed.

## Acceptance and delivery

Extend `tests/weather.test.ts` and `tests/e2e/weather.spec.ts` with controlled clocks:
stale startup, aging before normal deadline, repeated stale 200/failure, old/equal
responses, fresh recovery, stop/restart and online/resume storms. Verify midnight,
year change, DST and a browser timezone different from the configured location.
Check both modes at both frame densities and mobile; no misleading fresh advice or
overflow. Run affected weather/morning tests and shared type/lint/build checks.
Rollback is a web revert; cache format should remain readable. Mark the original
proposal implemented only with code/test evidence; deployment remains separately recorded.

## Start a separate chat

> Implement F01 from docs/backlog/F01-weather-freshness.md. Read its delivery contract
> and docs/weather-freshness.md, verify current code, refresh upstream provenance,
> and complete this slice with focused tests and documentation. Preserve vigilance,
> privacy and the €0 limit; report deployment separately.

## Local delivery

Implementation and validation: [F01/F02 delivery record](../implementation-plan.md#f01-and-f02-weather-recovery-and-browsing--27-october-2026).
The evidence above describes the audit baseline; current behavior and rollback are
recorded in [weather operations](../weather.md). Production is not deployed by this slice.
