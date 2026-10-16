# H1 — Classic 10 read-only discovery

Executed 16 October 2026 at the owner's request, against the owner-confirmed network target. Dayframe revision: `381d6568c5ab7276f9377ee93c749e57fdac3242`. **H1 complete: software discovery/storage reconciliation passed, and the owner supplied the visual physical inventory.** No APK installation, Android configuration change, reboot, block-content capture or recovery experiment was performed.

## Measured inventory

| Check               | Actual Classic 10 result                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Identity            | `Classic10`, manufacturer `joyhong`; firmware `Classic10_A33M187_20250910-1617_V09` matches the supplied record              |
| Platform            | `sun8i` / `exdroid`; Android 6.0.1, API 23; security patch property `2016-07-05`; ARMv7 (`armeabi-v7a,armeabi`)              |
| Memory / screen     | `MemTotal: 1027008 kB`; 1280 × 800 at 160 dpi                                                                                |
| Root / security     | Existing `uid=0(root)` shell; `ro.adb.secure=0`; TCP port property 5555; SELinux `Permissive`                                |
| WebView             | `com.android.webview` 44.0.2403.119, version code 246011900                                                                  |
| Vendor app          | `com.waophoto.smartframe` 2.1.3.71, version code 2010371; privileged package with granted install/reboot permissions         |
| Updater             | `com.waophoto.fota` 1.0, version code 1; privileged package with granted install/reboot permissions                          |
| Browser packages    | Package inventory contains no Firefox, Chrome or package name containing `browser`; no Dayframe rendering trial performed    |
| Internal storage    | `/dev/block/mmcblk0`, sysfs type `MMC`, 61,079,552 sectors × 512 = **31,272,730,624 bytes**                                  |
| Hardware boot areas | `/dev/block/mmcblk0boot0` and `mmcblk0boot1`, each 8,192 sectors = **4,194,304 bytes**; `ro=1`, `force_ro=1`, left unchanged |
| Removable storage   | No second MMC/SD block device exposed during inspection; this does not establish slot capability                             |

The A33 chip identification remains an inference from firmware/platform properties. Network ADB was already connected; this session did not test fresh key rejection or reboot persistence. The insecure property and existing root access are direct observations. Vendor permissions do not by themselves prove remote execution behavior.

## Storage reconciliation and H2 handoff

The private `diagnostics/h1/storage-map.json` records canonical paths, resolved sysfs parents, sector starts, lengths, exact bytes, aliases, mount sources and uncovered ranges. Raw command output is in `discovery.json` and `verification.json` in the same ignored directory. Files are private host evidence, not an encrypted firmware backup or a second copy. Do not commit or upload them.

- All 18 MMC nodes (whole device, two boot areas, 15 partitions) agree across sysfs sector counts, `blockdev --getsize64`, and `/proc/partitions` KiB counts.
- Every partition is inside the identified parent. No partition overlaps another. Two ranges outside exposed partitions remain covered by a future whole-user-area capture.
- Every `/dev/block/by-name` alias resolves to an observed canonical partition. Platform/by-number aliases refer to the same nodes, not additional capture regions.
- `/data` uses `UDISK` (p1); `/system` uses `system` (p7); `/cache` uses `cache` (p10); `/logger` uses `alog` (p15); `/bootloader` uses `bootloader` (p2). `/system` is mounted read-only; the other four are writable, including bootloader. H2 must treat their contents as potentially mutable.
- Other observed labels are `env`, `boot`, `misc`, `recovery`, `metadata`, `private`, `frp`, `empty`, and `media_data`. These are labels, not proof of contents. Unlabelled p3 is 1,024 bytes; its role/table format remains unknown until offline inspection. No p4 is exposed; none was invented.
- No RPMB node or inspected boot-configuration/EXT_CSD sysfs file was exposed. Physical RPMB presence and configuration-register coverage remain unknown. No RPMB read was attempted. SoC fuses, controller firmware and inaccessible configuration data are outside the proposed raw capture.

H2's measured candidate regions are the whole user area plus both boot areas above, totaling **31,281,119,232 raw bytes**. Using a conservative 2.2 × raw working-space budget, reserve at least **68,818,462,311 bytes** on the chosen private encrypted working destination, plus separate capacity for a second private copy. No encrypted destination or recovery route was established in H1. Recheck identity and the private map before H2; these values are specific to this Classic 10.

## Reader and transport findings

Host ADB is platform-tools 37.0.1 (`adb` protocol version 1.0.41). Existing Android tools include `blockdev`, stock `dd`, `cat`, `head`, `readlink`, and BusyBox. BusyBox lists `cat`, `dd`, `head` and `sha256sum`; standalone `sha256sum` was not found by `command -v`.

A generated six-byte stream containing NUL, LF, CR and 0xFF passed `adb exec-out` byte-for-byte, with no stderr and a successful host return code. **This reads no block content and does not accept H2's block-reader preflight.** Stock `head --help` advertises only `-n`, so do not assume its `-c` form works. Stock `dd --help` reports an invalid option; the legacy shell still returns host status zero. Review command output as well as status. BusyBox's listed readers are candidates, not demonstrated large-offset/whole-region readers. H2 must separately verify clean, independently matching small block reads and exact lengths before capture.

## Physical inventory and recovery

Owner-reported visual inspection: the only visible physical button is Power. Ports are SD, barrel-style power input, USB-A, owner-identified mini-USB (connector type not independently verified), and headphones. The power adapter is labelled **5 V, 2.0 A, 10.0 W**. Port roles/data support remain untested. No enclosure opening, cable connection, USB enumeration, reset, recovery entry or physical exit test was attempted. USB data, FEL, recovery and restore remain unverified. A partition called `recovery` is not a demonstrated recovery path.

H1 acceptance is complete with the omissions above explicitly recorded. The private map is reconciled and ready for H2 review; H2 requires its own read-capture authorization and private encrypted destination. H3 installation and later changes remain behind the existing backup/recovery gates.

## Upstream provenance

Rechecked upstream `main` at **`e97c50ba459c49ea8237259f69b95cd28054b628`**. Reviewed `docs/devices.md` and the complete `docs/dragontouch-modern10-charm.md`, including its follow-up, plus current issue/PR listings and discussions [#143](https://github.com/wesbos/photo-frame-dashboard/issues/143), [#138](https://github.com/wesbos/photo-frame-dashboard/pull/138) and [#152](https://github.com/wesbos/photo-frame-dashboard/pull/152). The browser fetch of [#147](https://github.com/wesbos/photo-frame-dashboard/pull/147) failed; its linked animation findings in #143 were reviewed. These later performance/kiosk reports do not change H1's read-only scope.

Adopted exact-unit identification, full-storage discovery and private evidence principles. Independently collected and reconciled Classic 10 data; intentionally did not reuse Modern10 capacities/offsets or execute upstream setup/backup scripts. The Classic user area is larger than the reported Modern10's 15,758,000,128 bytes; matching WebView/platform properties do not imply firmware interchangeability. No LICENSE/COPYING file found in the reviewed tree; no upstream code/assets copied.

## Validation

Host reconciliation checked all 18 MMC nodes, every by-name alias and block-backed mount, partition parentage/bounds/non-overlap and uncovered ranges. The generated six-byte binary stream matched exactly. Documentation formatting, 65 local Markdown targets and `git diff --check` passed; ignored evidence files use mode 0600 inside the private H1 directory. Public edits were checked for the live target address and 64-digit hashes. No application code changed, so application tests/build were not rerun.
