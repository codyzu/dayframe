# D01 — One useful home-automation integration: feasibility

Status: discovery only; Home deliberately removed; P3 / M.
Follow the [delivery contract](delivery-contract.md).

## Evidence and decision needed

Read specification §7, roadmap M7, dashboard settings/controller, Worker auth routes
and `docs/decisions/0005-display-scheduling.md`. A Worker cannot directly contact a
private Hue bridge. The repository supplies no proven household bridge/relay.
Select one actual device and action (for example one light's state/control) before
designing transport. Do not restore an empty Home screen.

## Discovery and next-slice plan

1. Obtain owner-provided model/API availability and whether an already-running local
   host exists. Keep device identifiers/addresses private. Recheck official vendor
   API scopes, local/remote support and current cost terms; document sources/date.
2. Compare a supported vendor remote API and an authenticated existing local relay.
   Reject inbound port forwarding, credentials in dashboard JavaScript and new paid
   hosting. Do not assume the frame's read-only role may now control household devices.
3. Write an ADR with data flow, pairing/revocation, permission matrix, relay health,
   request budget, stale state and a safe manual fallback. Decide whether display
   controls require a separately scoped capability or remain admin-only.
4. Specify a synthetic read-only status card as the first implementation milestone;
   only after transport/security proof add one explicitly authorized command with
   duplicate suppression, timeout, reconciliation and clear failure state.

## Acceptance and exit

This discovery is complete when a supported €0 architecture and exact bounded next
slice are documented, or a blocker is established. Do not claim integration complete
from mocked controls. Future tests must cover denied roles, offline relay, stale
state, command replay and revoke. Any hardware command requires its concrete scope.
Rollback disconnects credentials and removes the card while physical controls remain.

## Start a separate chat

> Run D01 discovery from docs/backlog/D01-home-automation.md. Identify one real
> household device/use case and produce a sourced, secure €0 implementation plan.
> Do not add a placeholder Home mode or assume a LAN relay already exists.
