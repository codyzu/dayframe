# D03 — Network hardening after H7 is reopened

Status: explicitly deferred by owner on 19 October; P2 / L.
Follow the [delivery contract](delivery-contract.md). Selection must explicitly reopen H7.

## Evidence and constraints

Read H7 in `docs/hardware/implementation-plan.md`, current operating guide,
`docs/status.md`, ADR 0003 and `worker/auth/network.ts`. The device has root network
ADB; disabling it without a proven independent route can strand maintenance.
Application home-IP restrictions do not secure the Android LAN root shell.
Do not recreate or execute the withdrawn H7 draft as already authorized work.

## Plan after explicit reopening

1. Identify exact device/firmware, router model, current network topology and existing
   independent maintenance path privately. Prefer D02 evidence before changing ADB.
2. Draft a rule matrix for owner-approved isolation: trusted maintenance host access,
   required outbound DNS/time/HTTPS, no unsolicited inbound internet access, and
   household access needed by any selected integration. Verify router capabilities;
   do not invent generic commands or expose a port for convenience.
3. Prepare concrete reversible router changes one at a time, baseline measurements,
   owner physical recovery instructions and stop conditions. Show intended changes
   before applying them. Keep application credential checks independent of network rules.
4. Consider ADB restriction only with a verified alternate path and specific approval;
   never blindly issue `adb usb`, disable services or modify system partitions.

## Acceptance and rollback

Verify allowed maintenance, blocked untrusted access, time sync, boot/network recovery,
photo authorization and physical exit using the agreed test window. Record actual
router/device evidence privately, sanitized results publicly. Undo only the changed
rules if access or operation breaks. A partially isolated device must be described
with residual risk; this audit is not a security certification. No paid networking
service or router replacement is implied.

## Start a separate chat

> Review D03 in docs/backlog/D03-network-hardening.md. Start with a concrete H7
> proposal; preserve the existing deferral until I explicitly reopen it, and require
> a verified maintenance fallback before any router or ADB changes.
