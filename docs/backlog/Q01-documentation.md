# Q01 — Reconcile current operational documentation

Status: confirmed documentation drift; P2 / S.
Follow the [delivery contract](delivery-contract.md). No runtime change needed.

## Evidence

The roadmap header still emphasizes October 18 deployments, while its final entries
record the October 27 import rollout. `status.md` begins with October 23 offline work
and contains older “M7 future” wording although calendar/vigilance exist.
`operations.md` includes a present-tense M4 activation-pending sentence and early
disabled-endpoint smoke description alongside later active-photo operations.
Specification §3 removes Home, while older §7/M5 deliverables still mention it.
These contradictions can send a fresh chat toward already-completed work.

## Implementation

1. Build a compact current-capabilities table from source plus latest dated records,
   separating implemented, recorded deployed, device-accepted and deferred. Do not
   treat this audit's source HEAD as a newly verified live build.
2. Update top-level README/status/roadmap pointers and current operating instructions.
   Keep chronological execution records intact and label obsolete setup sections as
   historical. Preserve anchors consumed elsewhere or update all incoming links.
3. Reconcile Home and calendar/alerts/Share Sheet descriptions with accepted scope
   changes. Link canonical feature runbooks instead of duplicating long state logs.
4. Keep current outstanding acceptance in one register, with links from feature
   docs; old failures retain dates and any later resolution. Preserve H7, revocation,
   second-admin and physical-test deferrals exactly.

## Acceptance

Verify every current claim against a source path or dated release/device record.
Check local links/anchors, formatting and `git diff --check`. Search pending/future
claims and classify each rather than deleting history. A new chat must be able to
find active release evidence, current device configuration, open work and rollback
without reading 1,800 lines. No application suite/deployment is required. Review the
diff for accidental inclusion of private data or reauthorization of device work.

## Start a separate chat

> Complete Q01 from docs/backlog/Q01-documentation.md. Reconcile current status and
> operating instructions using code and dated evidence, preserve historical records
> and owner deferrals, and verify links/claims without making new deployment claims.
