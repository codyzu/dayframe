# M6 hardware stages and acceptance gates

**Documentation prepared 16 October 2026; no stage executed in this session.** H1 has partial evidence supplied by the owner. H2–H8 remain PLANNED; H8 also waits for delivery. This breakdown preserves the [main M1–M7 roadmap](../implementation-plan.md). M4 production acceptance and M5 display behavior remain dependencies for full hardware acceptance; early public-fixture browser experiments can be evaluated separately.

For every future stage: obtain authorization for the specific device actions, recheck identity/upstream changes, record date, firmware, browser/app version, Dayframe revision, actions and sanitized results. An acceptance checkbox requires actual evidence. Raw evidence stays private. Stop at the first unexplained identity, size, checksum or behavior mismatch; do not run a broader setup script as remediation.

## H1 — Hardware discovery

- **Prerequisites:** Classic 10 physically present; permission for read-only ADB inspection; trusted network and selected target.
- **Objective/actions:** Run the [identity](dragon-touch-classic10.md#next-session-read-only-discovery-planned) and [storage-map](backup-and-recovery.md#preflight-and-storage-map-planned) commands. Document ports, navigation, root, WebView, internal storage vs SD, all partition parents/ranges, boot areas and missing recovery information. Compare only measured fields with Modern10.
- **Expected result:** A sanitized inventory and private exact storage map; no changed Android configuration.
- **Verification:** Confirm model `Classic10` and supplied firmware; reconcile sysfs sizes, mount sources and by-name links. Identify tools available for clean binary reads.
- **Risks/stop:** Root ADB exposure, wrong DHCP target, unique data in outputs. Stop if not the identified unit, non-eMMC storage, unknown map or unclean binary transport.
- **Acceptance:** All H2 region paths/sizes derivable from evidence, known omissions recorded. Current status: identity/RAM/display/root partly confirmed; storage/WebView/recovery details pending.

## H2 — Firmware backup

- **Prerequisites:** H1 storage map reviewed, specific read-capture authorization, private encrypted host destination, enough disk space and stable power/network. No APKs or persistent changes yet.
- **Objective/actions:** Follow [backup runbook](backup-and-recovery.md), read complete user area and accessible hardware boot areas, retain metadata and per-region manifest. No device-side writes or offline boot experiments.
- **Expected result:** Complete defined region coverage saved privately, with live/non-atomic limitations explicit.
- **Verification:** Exact incoming/decompressed byte counts, raw/compressed SHA-256, gzip integrity, no unexplained filler/errors, independent boot/static-partition/header/system-data comparisons, map bounds and second private copy verified.
- **Risks/stop:** Truncation, disk exhaustion, mixed binary/text, mutable filesystems, unreadable region. Stop on any unexplained difference; no acceptance based only on a compressed file's existence.
- **Acceptance:** Reviewed manifest marks capture/readback/independent checks complete for every required region, coverage exclusions and recovery status explicit. Restore remains unproven unless separately tested. Firmware/system work remains blocked until a usable recovery route exists.

## H3 — Firefox installation

- **Prerequisites:** H2 accepted, H3 installation authorization, trusted official APK with all host checks including signature, stock Settings/home exit available. M4 production acceptance required before private provisioning.
- **Objective/actions:** [Download/check/install/open procedure](firefox-installation.md); install only Firefox 143.0.4 ARMv7, finish onboarding, open deployed Dayframe frame profile. Keep launcher, WebView and manufacturer packages unchanged. Use public/synthetic content first.
- **Expected result:** Actual Dayframe renders in Firefox on Classic 10.
- **Verification:** Installed package/version, TLS, engine/API features, clock/chart/icons/WebP/touch. Physically exit and manually relaunch. Provision only a read-only display credential when backend is ready.
- **Risks/stop:** Old engine security, insufficient RAM, install/signature errors, unusable exit, TLS failure. Stop and preserve evidence; no unofficial APK, system trust-store change or automatic root-install fallback.
- **Acceptance:** Usable initial rendering, exact browser identity and known UI limitations; undo/reprovisioning documented. Fullscreen/boot automation not required yet.

## H4 — Firefox performance testing

- **Prerequisites:** H3 works; H4 test authorization and synthetic dataset; separately approved network interruptions if needed.
- **Objective/actions:** Execute [validation matrix](firefox-installation.md#h4-validation-matrix), sample memory/process CPU, compare animated/still Meteocons, chart/touch/photos, short/long outages and browser restart. Complete ≥48-hour run. Schedule acceptance waits for M5.
- **Expected result:** Measured operational envelope for approximately 1 GB RAM and the actual GPU/engine.
- **Verification:** Time-series measurements and incident log; ≤1 s ordinary touch-response target, no unexplained blank/crash, no sustained growth, correct protected images and expiry/revocation behavior.
- **Risks/stop:** Continuous animation cost, thermal/power instability, renderer kills, sensitive logs. Stop on repeated hangs, instability or credential leakage; reduce motion only through an approved setting/test, not system tuning.
- **Acceptance:** 48-hour evidence and operating choice recorded, or precise blocker/fallback. Desktop tests and two upstream days are insufficient.

## H5 — Fullscreen browser experience

- **Prerequisites:** H4 acceptable; specific shortcut/optional launcher/reboot approvals; tested physical exit and recorded undo.
- **Objective/actions:** [Evaluate current launcher shortcut](geckoview-kiosk.md#h5-incremental-fullscreen-evaluation), Dayframe manifest needs, chrome/navigation, persistent cookie and touch. Evaluate Rootless only if needed in a separate action. Later measure reboot/cold-boot/manual launch behavior.
- **Expected result:** Largest practical 1280 × 800 touch display without routine browser chrome, with known manual restart path.
- **Verification:** Open shortcut physically, test Back/Home/Settings/return, credential persistence and approved boot cycles. Record automation gaps.
- **Risks/stop:** Launcher incompatibility, hidden navigation, lost profile/session, vendor foreground takeover. Stop before launcher replacement/database edits if safe exit is unproven.
- **Acceptance:** Fullscreen usable and exit demonstrated; boot behavior accurately documented. Decide whether H6 is needed for unattended startup/recovery.

## H6 — GeckoView kiosk

- **Prerequisites:** H4/H5 evidence justifies new shell; ADR/scope decision, source/license and pinned artifact checks, H2 backup; independently approved installation/configuration. A usable recovery route and specific approval are additionally required for any system change.
- **Objective/actions:** Execute [H6 design packages](geckoview-kiosk.md#h6-design-and-work-packages): independent native shell or licensed source, persistent profile, native fullscreen/maintenance, boot receiver, bounded Wi-Fi/load/stall/paint recovery. Preserve stock HOME during initial trials.
- **Expected result:** Unattended display with controlled retries and independent maintenance access.
- **Verification:** Compile/test pinned ARMv7/API 23 package, then actual-device auth/render/48-hour soak; physical gesture/Settings round trip, boot with late Wi-Fi/time, load stall, renderer and process death. Measure proposed ≤2-minute recovery after network/time returns.
- **Risks/stop:** Missing contributor source, permission overreach, profile loss, retry storms, inaccessible Settings, unsupported Gecko API. Stop if source rights or artifact compatibility unresolved, or no physical exit.
- **Acceptance:** All failure cases recover or have explicit blockers and fallback; no routine interaction; maintenance survives force-stop/install/reboot tests. Do not claim a page watchdog handles a killed process without evidence.

## H7 — Security hardening

- **Prerequisites:** H2 accepted; working display and physically tested maintenance. Specific authorization for router/device changes; independent recovery/maintenance route tested before restricting the only path.
- **Objective/actions:** Apply the network/credential policy below incrementally. Start with router isolation while preserving a restricted admin route. Test before/after each firewall or ADB change. Keep rollback instructions and access to the router outside the frame.
- **Expected result:** Reduced attack surface and display-only backend scope, with a practical maintenance route.
- **Verification:** Authorized admin host can maintain it, other IoT/guest clients cannot reach root ADB, frame cannot reach household LAN services, no WAN forwarding/UPnP mapping, HTTPS/DNS/time work, credential revoke/off-network denial tested. Later approved reboot verifies restrictions persist.
- **Risks/stop:** Guest client-isolation blocks maintenance; router ACL misses same-subnet traffic or IPv6; vendor init restores ADB; loss of access. Stop before disabling ADB if USB/recovery alternative is untested.
- **Acceptance:** Private network-rule evidence, restored-access test and physical exit, scoped credential, incident/rotation instructions; root ADB either safely restricted or disabled with proven alternative. State residual Android/engine risk.

## H8 — Modern10 Charm comparison

- **Prerequisites:** Ordered €62.27 device delivered; permission for its own read-only H1 checks. Separate private target/evidence/backup paths.
- **Objective/actions:** Repeat identity, WebView, RAM/storage/display/root and physical inspection. Compare actual results with Classic and upstream. Only after its own H2/H3 approvals, compare the same Dayframe/browser/profile/dataset/performance tests.
- **Expected result:** Evidence-based choice of which frame to keep; no firmware interchange.
- **Verification:** Device-by-device matrix of firmware, memory, speed/touch/readability, Wi-Fi, security/maintenance, power/stability and purchase price. Record differences from reported Modern10, not just matches.
- **Risks/stop:** Wrong ADB target or restoring/copying identity-specific partitions. Stop on ambiguous identity; never reuse Classic path/offset assumptions.
- **Acceptance:** Both actual-unit records and comparable measurements; keep/return decision by owner. Until delivery and inspection, RAM/storage/browser/boot behavior of our Modern10 remain unknown.

## Separate security boundaries

**Device/LAN risk:** Android 6.0.1 plus observed promptless root ADB grants extensive control to anyone able to reach TCP 5555. That can expose saved Wi-Fi credentials, display cookies and firmware, and let an attacker alter the dashboard or use the frame to reach other hosts. ADB disconnection on the Mac does not stop the service. No public port forwarding or internet exposure is acceptable. Vendor VPhoto/updater capabilities are not yet audited; do not attribute another model's AiMOR behavior to this unit.

**Backend risk:** M4's revocable display credential and privately configured home public IPv4/IPv6 restriction protect API access. They cannot prevent local root compromise; an attacker on the allowed home network may steal/use a valid display credential. Keep admin identities, Google/Apple/Mozilla primary accounts and broad service tokens off the frame. HTTPS validation stays enabled. Refer to [administration](../administration.md) for current production gaps, cookie provisioning, revocation and private-photo lease; the hardware plan does not weaken those controls or promise indefinite offline photos.

| Option                              | Evaluation / proposed later action                                                                                                                                         | Gate and limitation                                                                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing-router IoT VLAN/guest SSID | Prefer frame isolated from household LAN, allow required HTTPS/DNS/time, deny unsolicited traffic. No subscription/new billed service.                                     | Validate client isolation and routed ACLs on the actual router; a guest SSID name alone proves nothing. Preserve an authorized maintenance route. |
| Restrict TCP 5555                   | Router ACL permitting only a trusted admin host/maintenance segment; cover IPv4/IPv6 and WAN.                                                                              | Same-subnet clients may bypass router ACL; use real segmentation/client isolation. Test from an allowed and denied client privately.              |
| Disable network ADB                 | Evaluate firmware's adbd startup/persistence and a reversible supported setting only after backup and a tested independent USB or recovery path.                           | No universal disable command prescribed: `adb usb` can strand a unit without USB data and may not persist. No current authorization to change it. |
| Maintenance fallback                | Physical kiosk menu to Settings plus demonstrated cable/USB ADB or exact recovery mechanism; temporarily enable a narrow admin network route when needed.                  | A menu alone may not repair a dead kiosk/Android boot. Keep restricted ADB if no independent path exists, explicitly accepting residual risk.     |
| Long-term care                      | Maintain inventory, private backups, update/retest compatible engine when possible, rotate/revoke on loss/compromise, periodically recheck router rules and boot behavior. | Network isolation reduces exposure; it does not restore modern OS security support. No routine personal browsing.                                 |

Basic exposure assessment starts at H1; H7 is not permission to leave root ADB broadly reachable throughout testing. Network changes still need their own approval and access/rollback checks. Never publish private IPs, public home addresses, Wi-Fi identifiers, serials, MACs or whole-device hashes in results shared upstream.

## Unresolved questions and next evidence

| Question                                                            | Exact next evidence / stage                                                                                                                                                          |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Actual eMMC device, exact size and partition starts?                | H1 `cat /proc/partitions`, `/proc/mounts`, sysfs `size`/`start`, resolved `/dev/block` symlinks; [full command set](backup-and-recovery.md#preflight-and-storage-map-planned)        |
| Boot areas, configuration, RPMB, device-specific partitions?        | H1 sysfs/block inventory and private partition-map review; record exclusions explicitly                                                                                              |
| Clean binary ADB stream and usable >2 GiB reader?                   | H2 small independent clean-read tests and exact lengths before full capture; do not infer stock dd behavior                                                                          |
| WebView and vendor packages/version/permissions?                    | H1 `dumpsys package com.android.webview`, package list and exact discovered home/updater IDs                                                                                         |
| USB data/recovery/FEL/correct restore tooling?                      | Port inspection and approved Mac enumeration first; offline image research after H2. Actual entry/boot/write experiments require separate review; no Classic recovery route verified |
| Firefox authentic signer / actual rendering / 48-hour stability?    | API 23 signature check before H3, then H3/H4 actual-device matrix. Host hash/manifest/ABI already verified                                                                           |
| Dayframe shortcut fullscreen and current launcher compatibility?    | H5 manifest inspection/proposal and actual touch trial; no Dayframe web manifest found in current tree                                                                               |
| GeckoView variant source and license?                               | Reviewed upstream tree has only WebView wrapper; obtain source/rights or independently author after ADR                                                                              |
| Clock jump, boot receiver, process death and blank-screen recovery? | H6 pinned-engine implementation plus approved actual failure tests; no Classic evidence yet                                                                                          |
| Can network ADB be safely restricted/disabled persistently?         | H7 router capability, denied/allowed tests, independent maintenance path and later authorized restart                                                                                |
| Our Modern10 RAM, storage and firmware?                             | H8 after delivery; do not infer from upstream or Classic                                                                                                                             |

The next execution slice is H1 completion only. H2 is the highest-priority follow-on, reviewed from H1's exact map. Documentation readiness does not mark M6 complete.
