# Dayframe hardware integration

Planning record, 16 October 2026. This is the detailed breakdown of [M6](../implementation-plan.md#8-m6--dragon-touch-classic-10), not a replacement for M1–M7. Astro, TypeScript, UnoCSS, Workers/KV, protected photo delivery and the €0 recurring-cost requirement remain unchanged. A native kiosk would be an optional device shell, requiring a separate implementation decision under the specification's native-app non-goal.

**Initial planning was documentation-only.** The later [H1 execution record](h1-discovery.md) documents owner-authorized read-only ADB discovery on 16 October 2026. H1 is complete: software/storage checks passed and the owner supplied the visual ports/power/buttons inventory. [H2 is accepted](h2-backup.md) as of 17 October 2026, with explicit owner exceptions for an unencrypted external destination and one retained copy after deletion of the verified Mac copy; the existing external filesystem was preserved. H3–H8 remain proposals requiring their own stage authorization. No installation, Android settings change, reboot or firmware write has been performed.

| Evidence label        | Meaning                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **CONFIRMED**         | Measured Classic 10 findings, with their source and execution date recorded. Host-only findings explicitly say so. |
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

H1 is complete with a private exact storage map, H2 candidate paths/sizes and owner-reported physical inventory; see [H1 results](h1-discovery.md). H2 is complete with documented owner exceptions; [its execution record](h2-backup.md) records final verification, coverage limitations and current single-copy retention. H2 acceptance must precede every APK or persistent Android change. Firmware/system changes additionally require an established recovery route and explicit authorization for the specific action. A successful live backup alone does not establish that route.
