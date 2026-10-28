# F06 — One-date planning exceptions

Status: optional enhancement; P3 / M. Follow the [delivery contract](delivery-contract.md).

## Evidence and scope

`docs/day-planning.md` explicitly leaves personal leave and one-date overrides for
later. `src/lib/dashboard/{day-planning,settings,schedule}.ts` supports weekday and
day-off profiles; `worker/school-calendar.ts` supplies official dates. A household
exception should not require changing a recurring weekday or Google events.
Proposed first scope: one civil date chooses an existing profile; no date ranges,
new academy, recurrence language or event-writing API.

## Implementation

1. Approve precedence: temporary manual mode override, explicit date exception,
   official holiday/vacation, weekday, weekend/day-off, daily fallback. Specify
   schedule/checkpoint inheritance independently and whether an explicit working-day
   exception re-enables habits. Official holiday notices remain factually visible.
2. Add a bounded optional date→profile map (proposed 64 entries) to private planning.
   Validate real YYYY-MM-DD dates, configured timezone and profile references; old
   settings default empty. Keep existing PATCH byte limit unless measured need exists.
3. Add admin list/add/remove and effective-day preview. Expired entries can be hidden
   from the active list but not silently deleted. Display-safe settings include only
   necessary data; reset private state on denial and do not persist it in the browser.
4. Resolve exceptions at local midnight/resume/settings refresh without renewing
   manual overrides. Include them in existing settings export/restore validation.

## Acceptance and recovery

Extend day-planning/schedule/administration tests and browser specs for leap day,
invalid dates, DST, opposite browser timezone, holiday overlap, unknown official
coverage, empty migration and removal. Confirm no Google mutation and no public
routine leakage. Update day-planning docs and spec with accepted precedence.
Rollback must define how older validators handle the new optional field; export
settings first and remove only the new field through a reviewed migration if needed.

## Start a separate chat

> Implement F06 from docs/backlog/F06-date-overrides.md, settling precedence and
> inheritance before coding. Keep exceptions private, bounded and backward compatible,
> and test local-date resolution with existing schedule/auth behavior.
