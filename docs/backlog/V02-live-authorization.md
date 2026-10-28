# V02 — Live authorization and independent administrator acceptance

Status: M4 implementation exists; owner-deferred live checks remain; P1 / M.
Follow the [delivery contract](delivery-contract.md). This plan does not reopen deferrals.

## Evidence

Read `docs/administration.md`, ADR 0003, the [validation register](../status.md),
`worker/{photo-api,admin-api,administration}.ts`, `worker/auth/{access,network}.ts`
and current calendar/day-context routes. Rotation denial and pixel cleanup passed;
standalone DELETE revocation is a different unpassed case. Admin cellular access has
evidence; do not label all off-home access absent.

## Preparation and execution

1. Derive a current route/method/role table from routing code: anonymous, admin and
   read-only display; include photos, config, display management, session, calendar
   and day context. State expected codes/cache headers and browser cleanup effects.
2. Close missing synthetic matrix coverage first in existing auth/calendar tests.
   Prepare sanitized result fields and private credential transport. Never put keys
   in command history, query URLs, screenshots or public test artifacts.
3. Ask to reopen only the selected live cases: credentialed home/off-home IPv4/IPv6,
   display mutation denial, standalone revocation, or second identity. Preserve the
   working key until a recovery/reprovisioning window is explicitly agreed.
4. For second admin, use independently approved email in both Access and Worker
   allowlist; test actual sign-in, upload/delete and expiry. No shared login or invite
   system. For revocation, record online denial and clearing separately from accepted
   offline retention; offline copies cannot observe a server revocation immediately.

## Acceptance and recovery

Record exact deployed revision, role/network family, route/method, result and timestamp
without private identifiers. Negative mutation tests must not accidentally modify
household records. Confirm recovery using existing owner account and approved new
display provisioning after any destructive credential test. Run affected auth tests
and production smoke only as appropriate. Do not mark M4 complete if any required
case remains deferred. Update administration/status/roadmap with evidence scope.

## Start a separate chat

> Prepare V02 from docs/backlog/V02-live-authorization.md, starting with the current
> authorization matrix and synthetic gaps. Retain existing live-check deferrals and
> request a concrete window before credential revocation or second-admin changes.
