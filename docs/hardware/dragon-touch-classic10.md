# Dragon Touch Classic 10 inventory

**CONFIRMED** below combines the owner's supplied diagnostics with the [executed H1 read-only inspection](h1-discovery.md) on 16 October 2026. Model/firmware were checked before discovery. Rounded filesystem figures are not raw disk sizes. H1 is complete; physical details are owner-reported visual observations.

| Property          | Our Classic 10                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Brand / model     | Dragon Touch / `Classic10`                                                                                                  |
| Purchase          | Amazon.fr ASIN `B0GXVW13YP`, €49.99; received                                                                               |
| Manufacturer      | `joyhong`                                                                                                                   |
| Android / API     | `6.0.1` / `23`                                                                                                              |
| Firmware          | `Classic10_A33M187_20250910-1617_V09`                                                                                       |
| Build fingerprint | `joy/astar_ococci/astar-ococci:6.0.1/MOB30R/20250910:user/test-keys`                                                        |
| Hardware / board  | `sun8i` / `exdroid`                                                                                                         |
| ABI               | `armeabi-v7a`                                                                                                               |
| RAM               | `MemTotal: 1027008 kB`, approximately 1 GB                                                                                  |
| Storage           | Internal MMC user area 31,272,730,624 bytes; hardware boot areas each 4,194,304 bytes; `/data` 25.7 GB (rounded)            |
| Screen            | Physical 1280 × 800; physical density 160 dpi                                                                               |
| ADB               | TCP 5555 reachable at a temporary DHCP address; connection succeeded without an observed authorization prompt               |
| Shell             | `uid=0(root)`, `gid=0(root)`, `context=u:r:su:s0`; no rooting or unlocking needed                                           |
| WebView           | `com.android.webview` 44.0.2403.119 (version code 246011900)                                                                |
| Browser search    | H1 package inventory: no Firefox, Chrome or package name containing `browser`; rendering untested                           |
| Vendor settings   | Application version `2.1.3.71`, distinct from Android 6.0.1                                                                 |
| Ecosystem         | VPhoto `com.waophoto.smartframe` 2.1.3.71; updater `com.waophoto.fota` 1.0; both privileged with install/reboot permissions |

**UNVERIFIED:** Allwinner A33 family is likely from `A33` in the firmware plus `sun8i`; no physical chip inspection. H1 verified MMC type, exact capacity, partition parents/ranges, boot-area sizes and WebView version; the full map stays private. Chip-level eMMC identity was not collected. USB data/recovery access and browser compatibility remain unknown; physical inventory is recorded below. SELinux is measured `Permissive`; root does not prove recovery capability.

## Physical inventory (owner-reported, H1)

One visible Power button; SD slot, barrel-style power input, USB-A, owner-identified mini-USB and headphone ports. Adapter output label: **5 V, 2.0 A, 10.0 W**. Connector type and data/host roles are not independently verified. No cable or recovery tests performed. Physical exit to Android Settings remains a later gate.

## Comparison with the upstream Modern10 Charm

Source: [complete report at the reviewed revision](https://github.com/wesbos/photo-frame-dashboard/blob/e97c50ba459c49ea8237259f69b95cd28054b628/docs/dragontouch-modern10-charm.md), including the 14 October follow-up. These are **UPSTREAM VERIFIED** observations of one unit, not our pending delivery.

| Property                        | Classic 10 (CONFIRMED unless noted)                                              | Upstream Modern10 Charm                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Model / purchase                | `Classic10`, ASIN `B0GXVW13YP`                                                   | `Modern10 charm`, report purchase ASIN `B0DXV3HGH7`                                             |
| Firmware                        | `Classic10_A33M187_20250910-1617_V09`                                            | `Modern10 charm_A33MAU_202605151735_4.0_V01`                                                    |
| Android / API                   | 6.0.1 / 23                                                                       | 6.0.1 / 23                                                                                      |
| Manufacturer / board / hardware | joyhong / exdroid / sun8i                                                        | Same reported properties                                                                        |
| ABI / likely processor          | ARMv7 / likely A33 (inference)                                                   | ARMv7 / likely A33 (not physically inspected)                                                   |
| Screen / density                | 1280 × 800 / 160 dpi                                                             | Same                                                                                            |
| RAM                             | Approximately 1 GB                                                               | Not established in this report; do not infer from Classic 10                                    |
| Storage                         | User area 31,272,730,624 bytes                                                   | Captured user area 15,758,000,128 bytes; boot0 and boot1 each 4,194,304 bytes                   |
| Root network ADB                | Available without observed prompt                                                | Available without prompt; persists after reported reboot                                        |
| WebView                         | 44.0.2403.119                                                                    | 44.0.2403.119                                                                                   |
| Vendor packages                 | Same package IDs, measured in H1                                                 | VPhoto `com.waophoto.smartframe`, updater `com.waophoto.fota`                                   |
| Firefox                         | 143.0.4; H3/H3.1 rendering/API and physical round trips passed via DF/stock Home | 143.0.4 ARMv7; fullscreen shortcut with Rootless 3.9.1                                          |
| Kiosk                           | Not implemented/tested                                                           | Contributor's GeckoView 143 variant, boot receiver, physical exit gesture, two-day use reported |
| Recovery                        | Unknown                                                                          | Capture verified; firmware restore and factory reset untested                                   |

Shared platform properties make an ARMv7 Firefox experiment plausible. They do **not** establish identical boot loaders, RAM timing, storage devices, offsets, partition tables, Wi-Fi drivers or recovery entry. `A33M187` and `A33MAU` firmware are not interchangeable. Do not flash either device from the other device's backup.

## Next-session read-only discovery (PLANNED)

This checklist was executed for H1; see the [results and physical inventory](h1-discovery.md). For a future session, obtain scoped authorization to contact the particular unit first. Use the address currently displayed on its own screen; keep it and all output private. Host shell variables below are session-local. Select the device on every command, especially once two frames exist.

```sh
FRAME_ADDR='REPLACE_WITH_CURRENT_PRIVATE_ADDRESS:5555'
adb connect "$FRAME_ADDR"
adb -s "$FRAME_ADDR" get-state
adb -s "$FRAME_ADDR" shell id
adb -s "$FRAME_ADDR" shell getprop ro.product.model
adb -s "$FRAME_ADDR" shell getprop ro.product.manufacturer
adb -s "$FRAME_ADDR" shell getprop ro.build.display.id
adb -s "$FRAME_ADDR" shell getprop ro.build.fingerprint
adb -s "$FRAME_ADDR" shell getprop ro.build.version.release
adb -s "$FRAME_ADDR" shell getprop ro.build.version.sdk
adb -s "$FRAME_ADDR" shell getprop ro.build.version.security_patch
adb -s "$FRAME_ADDR" shell getprop ro.hardware
adb -s "$FRAME_ADDR" shell getprop ro.product.board
adb -s "$FRAME_ADDR" shell getprop ro.product.cpu.abilist
adb -s "$FRAME_ADDR" shell getprop ro.product.cpu.abi
adb -s "$FRAME_ADDR" shell cat /proc/cpuinfo
adb -s "$FRAME_ADDR" shell cat /proc/meminfo
adb -s "$FRAME_ADDR" shell df /data
adb -s "$FRAME_ADDR" shell wm size
adb -s "$FRAME_ADDR" shell wm density
adb -s "$FRAME_ADDR" shell dumpsys package com.android.webview
adb -s "$FRAME_ADDR" shell pm list packages
adb -s "$FRAME_ADDR" shell dumpsys package com.waophoto.smartframe
adb -s "$FRAME_ADDR" shell dumpsys package com.waophoto.fota
adb -s "$FRAME_ADDR" shell getprop ro.adb.secure
adb -s "$FRAME_ADDR" shell getprop service.adb.tcp.port
adb -s "$FRAME_ADDR" shell getprop persist.adb.tcp.port
adb -s "$FRAME_ADDR" shell getenforce
adb -s "$FRAME_ADDR" shell date
adb -s "$FRAME_ADDR" shell uptime
```

Inspect WebView `versionName`/`versionCode`, not just package existence. Missing package/output is an unresolved result, not permission to install a replacement. Package lists and CPU diagnostics can contain unique data; sanitize before publishing. A root shell says nothing about whether `adb root` is necessary: do not run it.

Complete the [storage discovery commands](backup-and-recovery.md#preflight-and-storage-map-planned) before proposing backup paths. Record visible ports, connector labels, power supply rating and physical navigation controls without opening the enclosure. USB enumeration on the Mac (`system_profiler SPUSBDataType`, or `SPUSBHostDataType` if supported) can be proposed after approving the specific cable/port connection; it does not prove FEL or recovery. Do not try reset buttons, recovery boots or boot-media changes in H1.

When the Modern10 Charm arrives, run the same approved checks into a separate private record. Identify it by firmware and screen confirmation, never by whichever ADB target was last used.
