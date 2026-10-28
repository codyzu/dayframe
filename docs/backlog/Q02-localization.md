# Q02 — Optional English localization

Status: later enhancement, not a missing French requirement; P3 / M.
Follow the [delivery contract](delivery-contract.md).

## Evidence and proposed scope

Specification §13 requires French initially with an architecture ready for English.
French strings are currently distributed across Astro pages, weather conditions,
advice, date formatting and admin modules. Read `config.ts`, `settings.ts`,
weather `conditions.ts`/`morning.ts`/`view.ts`, `calendar/view.ts` and pages.
First slice: public dashboard modes in French/English; administration translation
can follow separately. Keep metric units and location timezone independent of language.

## Implementation

1. Inventory visible/accessibility/error strings and formatting sites. Define typed
   message keys and a lightweight formatter/dictionary module without a new framework.
   Preserve French default and choose explicit local preference precedence; language
   must not silently change schedules, coordinates or private settings.
2. Move public-mode strings into dictionaries, including plurals, stale dates, empty
   agenda and offline interruption text. Treat source event/holiday names as source
   content, not translated keys. Keep official attribution and warnings accurate.
3. Add a restrained accessible language choice for ordinary browsers, deciding how
   dedicated displays are provisioned. Persist only locale, not household content.
   Include static fallback translation only if self-contained size stays bounded.
4. Recreate cached Intl formatters when locale changes and update labels/aria text
   without duplicating timers or clearing private authorization state.

## Acceptance and rollback

Test missing-key fallback, plurals, midnight/year/DST, locale changes while offline
or stale, long English labels and 1280 × 800 Large/mobile layouts. Preserve numeric
unit semantics and existing French tests; add targeted English browser cases. Test
public artifacts for private data and no external translation requests. Revert to
French safely when a saved locale is unsupported. Document translated versus deferred
admin surfaces honestly and update the specification only for selected scope.

## Start a separate chat

> Implement Q02's public-display slice from docs/backlog/Q02-localization.md.
> Preserve French defaults, metric units and location timezone; use typed local
> dictionaries, test layout/freshness, and document untranslated admin scope.
