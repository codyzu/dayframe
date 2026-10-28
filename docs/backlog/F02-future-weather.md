# F02 — On-demand future weather

Status: deployed 28 October 2026; physical-device acceptance separate. P2 / M. F01 implemented first.
Follow the [delivery contract](delivery-contract.md).

## Evidence and proposed scope

Read the roadmap's “Future weather browsing”, `src/lib/weather/adapter.ts`
(`forecast_days: '2'`, daily highs/lows), `forecast-view.ts`, `chart.ts`,
`view.ts`, `src/lib/dashboard/controller.ts` and `MorningWeather.astro`.
There is no future-day browsing interface. Proposed first slice: a seven-day daily
summary opened by a clearly labeled Morning button, with selected-day hourly
detail only where returned coverage exists. Seven days is a proposed default,
not an existing requirement; settle horizon/detail before coding the adapter.

## Implementation

1. Define an accessible panel/dialog and selection state, separate from scheduled
   modes. Close returns to Morning; mode change/override expiry closes it. Do not
   reserve the native two-finger maintenance gesture or persist temporary selection.
2. Extend validated provider fields minimally: daily condition/high/low and rain
   indicator; fetch selected hourly coverage within the agreed bounded horizon.
   Prefer one shared response/service over a request per tap. Recheck Open-Meteo
   official fields/terms, payload size and aggregate request budget.
3. Build daily selection and optional hourly view with explicit dates, keyboard
   focus/escape/return handling, static verified icons, provider attribution and
   accessible text. Default Morning hierarchy remains unchanged.
4. Distinguish stale forecasts, missing days and exhausted hourly coverage; do not
   manufacture zero rain or use a past day's data as future data. F01 owns freshness.

## Acceptance and delivery

Extend weather fixtures/unit parsing and `tests/e2e/weather.spec.ts`: seven-day and
partial data, stale/offline, DST, year boundary, timezone mismatch, repeated opening,
mode switch and focus restoration. Show screenshots at 1280 × 800 Large/Standard
and mobile; the frame panel fits without page scrolling. Verify one service and
bounded requests. No new private API or offline-app cache. Revert UI/provider fields
together if necessary; old cached payloads must degrade safely. Record the chosen
horizon and interaction in `docs/weather.md` and the roadmap.

## Start a separate chat

> Implement F02 from docs/backlog/F02-future-weather.md. Use the proposed seven-day
> on-demand view as the starting scope, resolve any material detail choice, inspect
> F01's current state, and deliver a tested, documented slice with upstream review.

## Local delivery

Implementation and validation: [F01/F02 delivery record](../implementation-plan.md#f01-and-f02-weather-recovery-and-browsing--27-october-2026).
The evidence above describes the audit baseline; current behavior and rollback are
recorded in [weather operations](../weather.md). [Release 40631119085](https://github.com/codyzu/dayframe/actions/runs/40631119085)
deployed `8968dbf` on 28 October; physical acceptance remains separate.
