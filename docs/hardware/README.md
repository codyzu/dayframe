# Dayframe hardware integration

Planning record, 16 October 2026. This is the detailed breakdown of [M6](../implementation-plan.md#8-m6--dragon-touch-classic-10), not a replacement for M1–M7. Astro, TypeScript, UnoCSS, Workers/KV, protected photo delivery and the €0 recurring-cost requirement remain unchanged. A native kiosk would be an optional device shell, requiring a separate implementation decision under the specification's native-app non-goal.

**This session made documentation changes only. No ADB commands, device reads, backups, installations, settings changes, reboots or firmware writes were performed.** Host-only upstream inspection and Firefox APK verification are recorded below. Commands in these documents are proposals for separately authorized sessions, not instructions to execute now.

| Evidence label        | Meaning                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **CONFIRMED**         | Supplied diagnostic results from our Classic 10; not re-run in this session. Host-only findings explicitly say so. |
| **UPSTREAM VERIFIED** | A contributor reports execution on their identified device; not independently reproduced by Dayframe.              |
| **PLANNED**           | Prepared action, not executed on our devices.                                                                      |
| **UNVERIFIED**        | Inference, unknown detail or candidate mechanism requiring evidence.                                               |

Read in order:

1. [Classic 10 inventory and Modern10 Charm comparison](dragon-touch-classic10.md).
2. [Backup capture, verification and recovery limitations](backup-and-recovery.md).
3. [Firefox installation and performance testing](firefox-installation.md).
4. [Fullscreen and GeckoView kiosk design](geckoview-kiosk.md).
5. [H1–H8 stages, security and unresolved questions](implementation-plan.md).
6. [Research sources and provenance](sources.md).

The Classic 10 (€49.99) is received and partly inspected. Our Modern10 Charm (€62.27) is ordered, awaiting delivery and has no local diagnostic evidence. Its upstream namesake is only a comparison unit.

Keep raw diagnostics, screenshots with identifiers, manifests, APK signing keys, credentials and firmware images outside this public repository, preferably on an encrypted local volume with a second private copy. Backups can contain Wi-Fi passwords, photos, account tokens and pairing data, even before we install anything. Public notes must omit serials, pairing IDs, MACs, eMMC CIDs, home IPs, DHCP addresses and whole-device backup hashes. Existing ignored folders are a fallback, not the chosen backup destination. No paid hosting or monitoring is needed.

The next device session should be **H1 read-only completion**, with explicit permission to contact the frame. Review its results before filling the H2 paths/sizes. H2 must precede every APK or persistent Android change. Firmware/system changes additionally require an established recovery route and explicit authorization for the specific action. A successful live backup alone does not establish that route.
