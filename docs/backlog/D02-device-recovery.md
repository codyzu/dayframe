# D02 — USB and recovery-path investigation

Status: missing evidence; P2 / L, discovery first.
Follow the [delivery contract](delivery-contract.md).

## Evidence

Read `docs/hardware/{dragon-touch-classic10,h1-discovery,h2-backup,backup-and-recovery}.md`
and `sources.md`. Our backup has accepted single-copy/unencrypted exceptions; USB
data, recovery and restore are unverified. Upstream's same-firmware Classic report
shows USB root ADB on another unit, but omitted cable/setup details and never tested
restore. This does not authorize WebView replacement or flashing.

## Stages

1. Inspect retained documentation and available backup manifest privately. Report
   coverage and availability without copying firmware, identifiers or hashes into Git.
   Do not silently reinterpret the owner's accepted retention exceptions.
2. Prepare a non-destructive port/cable/host-enumeration checklist for the actual
   identified unit. Ask for physical observations and a specific connection window.
   Keep working network ADB and physical maintenance intact; no reset or boot mode.
3. Research exact-board recovery tooling and image compatibility from primary sources
   and current upstream issues. Separate USB data, root ADB, boot recovery entry and
   successful restore: each is its own evidence gate.
4. Produce a recovery decision record with tools/provenance, backup prerequisites,
   failure scenarios and what can be rehearsed offline. Any recovery-entry trial or
   write needs its own reviewable plan and specific authorization; prefer a spare unit.

## Acceptance and recovery

First slice succeeds with a verified USB observation or a documented blocker plus
an evidence-based recovery plan. It cannot mark firmware restore “verified” without
an actual controlled restore result. No routine test suite is required for research;
test only newly added host parsing tools. End temporary host sessions and preserve
all existing access paths. Update hardware sources/inventory with dated evidence labels.

## Start a separate chat

> Run the non-destructive D02 investigation in docs/backlog/D02-device-recovery.md.
> Review exact-unit evidence and current upstream, prepare USB observations and
> recovery prerequisites, and do not perform system writes or boot-mode changes.
