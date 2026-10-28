# V03 — Offline, deployment-update and storage acceptance

Status: M5.O5 partially accepted; P1 / M. Follow the [delivery contract](delivery-contract.md).

## Evidence and limits

Read ADR 0009, `docs/hardware/m5-offline.md`, `docs/photos.md`,
`src/lib/offline/*`, `src/lib/photos/offline.ts`, native heartbeat and recovery policies.
Short owner desk disconnect, offline app restart and reconnection passed. Sustained
offline playback, update recovery, destructive expiry/storage cases and overnight
acceptance remain open. Offline cold power failed at the plausible-clock gate;
network restoration recovered photos in about 45 seconds. Do not bypass that gate.

## Execution plan

1. Build a case matrix distinguishing live-page outage, warm offline navigation,
   partial startup, empty cache, expired cache, eviction, reconnect, new build and
   worker retirement. Use existing offline fixture tests before any device action.
2. Reverify actual unit, app/engine and web build, initial authenticated sync, stored
   count/bytes and usable maintenance route. Prepare per-case recovery and stop rules.
3. Obtain a bounded interruption window for selected physical cases. Begin with
   non-destructive sustained playback and normal reconnection. Measure duration,
   shown-photo progress, recovery latency and reload count; heartbeat alone does
   not establish painted photos. Preserve privacy in any visual observation.
4. Run expiry, cache deletion/eviction or credential cases only on an agreed synthetic
   profile/device or with explicit destructive-test approval and reprovisioning plan.
   Test new-build reload at a transition and old/new fallback compatibility without
   forcing an unreviewed production deployment.

## Acceptance and recovery

Use `playwright.offline.config.ts`, `pnpm test:offline-navigation`, offline unit tests
and native heartbeat/policy tests for changes. Verify seven-day/100-photo/100 MB
bounds, denial clearing, no private API caching, bounded retries and maintenance.
Record offline-at-night playback as accepted design, not a missing Night feature.
Separate wrong-clock cold-start limitation from warm offline capability. Restore
network and verified online private access after each authorized case. Update O5
evidence; a passing warm outage cannot close cold startup or 48-hour stability.

## Start a separate chat

> Prepare V03 from docs/backlog/V03-offline-acceptance.md and execute only selected,
> authorized device checks. Reuse synthetic coverage, preserve clock/privacy policy,
> and record measured outcomes and remaining limitations in the O5 runbook.
