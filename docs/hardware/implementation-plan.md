# M6 hardware stages and acceptance gates

**Updated 17 October 2026:** [H1 complete](h1-discovery.md); [H2 accepted](h2-backup.md) after full-region capture/readback, independent comparisons, final structure/file-data review and identity checks. The owner accepted an unencrypted external destination and a single retained copy after deletion of the verified Mac copy; no reformatting occurred. [H3/H3.1 accepted](h31-maintenance.md#acceptance-and-operating-limits): Firefox rendering and physical maintenance round trips passed with the approved DF overlay; stock Settings is reached through Home; H4 preliminary Photos collection completed (weather/CPU review and acceptance pending); H5–H8 remain PLANNED, and H8 also waits for delivery. This breakdown preserves the [main M1–M7 roadmap](../implementation-plan.md). M4 production acceptance and M5 display behavior remain dependencies for full hardware acceptance; early public-fixture browser experiments can be evaluated separately.

For every future stage: obtain authorization for the specific device actions, recheck identity/upstream changes, record date, firmware, browser/app version, Dayframe revision, actions and sanitized results. An acceptance checkbox requires actual evidence. Raw evidence stays private. Stop at the first unexplained identity, size, checksum or behavior mismatch; do not run a broader setup script as remediation.

## H1 — Hardware discovery

- **Prerequisites:** Classic 10 physically present; permission for read-only ADB inspection; trusted network and selected target.
- **Objective/actions:** Run the [identity](dragon-touch-classic10.md#next-session-read-only-discovery-planned) and [storage-map](backup-and-recovery.md#preflight-and-storage-map-planned) commands. Document ports, navigation, root, WebView, internal storage vs SD, all partition parents/ranges, boot areas and missing recovery information. Compare only measured fields with Modern10.
- **Expected result:** A sanitized inventory and private exact storage map; no changed Android configuration.
- **Verification:** Confirm model `Classic10` and supplied firmware; reconcile sysfs sizes, mount sources and by-name links. Identify tools available for clean binary reads.
- **Risks/stop:** Root ADB exposure, wrong DHCP target, unique data in outputs. Stop if not the identified unit, non-eMMC storage, unknown map or unclean binary transport.
- **Acceptance:** All H2 region paths/sizes derivable from evidence, known omissions recorded. Current status: identity/RAM/display/root/WebView confirmed; all H2 candidate paths/sizes derived and reconciled privately. Generated binary transport passed; block-reader preflight remains H2. Owner visual physical inventory recorded; recovery/USB data unverified. H1 accepted with these omissions explicit. See [execution evidence](h1-discovery.md).

## H2 — Firmware backup (complete with owner exceptions)

- **Prerequisites:** H1 storage map reviewed, specific read-capture authorization, private encrypted host destination (owner exception recorded for this capture), enough disk space and stable power/network. No APKs or persistent changes yet.
- **Objective/actions:** Follow [backup runbook](backup-and-recovery.md), read complete user area and accessible hardware boot areas, retain metadata and per-region manifest. No device-side writes or offline boot experiments.
- **Expected result:** Complete defined region coverage saved privately, with live/non-atomic limitations explicit.
- **Verification:** Exact incoming/decompressed byte counts, raw/compressed SHA-256, gzip integrity, no unexplained filler/errors, independent boot/static-partition/header/system-data comparisons, map bounds and second private copy verified. The owner subsequently accepted deletion of the second copy and single-copy retention for this capture.
- **Risks/stop:** Truncation, disk exhaustion, mixed binary/text, mutable filesystems, unreadable region. Stop on any unexplained difference; no acceptance based only on a compressed file's existence.
- **Acceptance:** Reviewed manifest marks capture/readback/independent checks complete for every required region, coverage exclusions and recovery status explicit. Restore remains unproven unless separately tested. Firmware/system work remains blocked until a usable recovery route exists.

## H3 — Firefox installation

**17 October preflight:** official APK hash/ZIP/manifest/ABI and API 23 signature checks passed; Classic identity, space and Firefox absence rechecked. Owner confirmed initial physical Home/Settings access. Standard install succeeded after allowing the slow transfer to finish; installed version, public HTTPS Dayframe rendering and synthetic WebP/API checks passed. Owner confirmed touch works but cannot find Android Home/Back controls; physical exit/relaunch remains unresolved. One owner-approved normal restart restored Wi-Fi; a target-specific host reconnect restored root ADB and Firefox remains installed. Stock Settings/About inspection found no visible app-list/Firefox-launch entry. H3.1 subsequently supplies the approved, physically tested DF → stock Home/Settings → Firefox return route; direct Settings launch is unavailable. [H3 execution record](h3-firefox.md); H3 accepted after the H3.1 follow-up below.

- **Prerequisites:** H2 accepted, H3 installation authorization, trusted official APK with all host checks including signature, stock Settings/home exit available. M4 production acceptance required before private provisioning.
- **Objective/actions:** [Download/check/install/open procedure](firefox-installation.md); install only Firefox 143.0.4 ARMv7, finish onboarding, open deployed Dayframe frame profile. Keep launcher, WebView and manufacturer packages unchanged. Use public/synthetic content first.
- **Expected result:** Actual Dayframe renders in Firefox on Classic 10.
- **Verification:** Installed package/version, TLS, engine/API features, clock/chart/icons/WebP/touch. Physically exit and manually relaunch. Provision only a read-only display credential when backend is ready.
- **Risks/stop:** Old engine security, insufficient RAM, install/signature errors, unusable exit, TLS failure. Stop and preserve evidence; no unofficial APK, system trust-store change or automatic root-install fallback.
- **Acceptance:** Usable initial rendering, exact browser identity and known UI limitations; undo/reprovisioning documented. Fullscreen/boot automation not required yet.

### H3.1 — Physical maintenance and manual Firefox relaunch (ACCEPTED)

Accepted 17 October 2026, closing H3 before H4 acceptance. Stock Settings has no app drawer, but the approved DF overlay provides physical stock Home/Settings access and Firefox return. The direct Settings button fails because its vendor activity is not exported; the owner verified Settings through stock Home instead. [Execution and limits](h31-maintenance.md#acceptance-and-operating-limits).

- [x] Evaluate a minimal app-level navigation/maintenance solution that provides physical access to stock Home/Settings and a way to reopen Firefox. Reuse the H5/H6 research where relevant; record the selected source/license, compatibility, permissions and undo. Selected an independently authored API 23 overlay helper under MIT; source, permissions, alternatives and undo are in [ADR 0004](../decisions/0004-frame-maintenance-helper.md). The owner explicitly approved the limited native scope and device trial on 17 October.
- [x] Prepare the exact proposed installation/configuration for review: [H3.1 runbook](h31-maintenance.md), original helper source and verified local APK; [ADR 0004](../decisions/0004-frame-maintenance-helper.md) proposes the native-maintenance scope exception.
- [x] Obtain authorization for that scope exception and the specific device actions: owner approved the reviewed helper installation/launch, normal UI overlay permission and physical round-trip tests. The H3 Firefox installation approval and the single recovery-restart approval do not authorize another package, launcher replacement, permission grant or system modification.
- [x] Demonstrate the complete round trip by touch: Dayframe in Firefox → stock Home/Settings → Firefox/Dayframe. Repeat to establish a practical maintenance route; ADB navigation or a restart is not a substitute.
- [x] Record the measured result and limitations in [H3 execution evidence](h3-firefox.md), then close H3 only when its acceptance gates pass.

Keep stock Home available and the current Firefox profile intact during evaluation. No firmware/framework edits are part of this follow-up. Fullscreen, boot automation and extended stability remain H5/H6/H4 work respectively; this follow-up does not mark those stages complete.

## H4 — Firefox performance testing

**18 October progress:** preliminary Photos and weather hours collected with four tabs; weather 61/61 samples OK, no observed process churn, median whole-browser CPU 1.535 cores. This is multi-tab stress/functional evidence, not representative single-tab performance. Owner identified VIEW-intent tab accumulation; duplicate API/dashboard tabs were closed and exactly one retained synthetic tab verified. Subsequent tests reuse it. [Full evidence and limitations](h4-performance.md#weather-hour-result-and-single-tab-correction--18-october-2026). Paired motion, physical observations and approved router outages remain open; the owner excludes the 48-hour run from the current request.

**17 October preparation:** the owner authorized H4 tools/runbook preparation followed by M4 display checks and a short baseline. The [measurement runbook](h4-performance.md) and independent host sampler/summary/tests are prepared. An actual read-only two-snapshot collection verified all five Firefox processes; this is tooling validation only. A one-hour preliminary production Photos run subsequently started after the non-disruptive M4 checks; controlled synthetic baseline, paired motion trial and 48-hour acceptance remain pending. Network interruptions retain their separate approval gate.

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
| Actual eMMC device, exact size and partition starts?                | H1 completed: sysfs, blockdev and proc agree; private exact map plus mount/alias/bounds checks; [full command set](backup-and-recovery.md#preflight-and-storage-map-planned)         |
| Boot areas, configuration, RPMB, device-specific partitions?        | H1 completed: two 4 MiB hardware boot areas; no RPMB node exposed; private map reviewed, configuration/fuses/RPMB exclusions recorded                                                |
| Clean binary ADB stream and usable >2 GiB reader?                   | H2 small independent clean-read tests and exact lengths before full capture; do not infer stock dd behavior                                                                          |
| WebView and vendor packages/version/permissions?                    | H1 completed: WebView 44.0.2403.119; VPhoto 2.1.3.71 and Fota 1.0; both privileged with install/reboot grants                                                                        |
| USB data/recovery/FEL/correct restore tooling?                      | Port inspection and approved Mac enumeration first; offline image research after H2. Actual entry/boot/write experiments require separate review; no Classic recovery route verified |
| Firefox authentic signer / actual rendering / 48-hour stability?    | API 23 signature and H3 installation/rendering/WebP/API checks passed; final physical round trip pending, H4 stability untested                                                      |
| Dayframe shortcut fullscreen and current launcher compatibility?    | H5 manifest inspection/proposal and actual touch trial; no Dayframe web manifest found in current tree                                                                               |
| GeckoView variant source and license?                               | Reviewed upstream tree has only WebView wrapper; obtain source/rights or independently author after ADR                                                                              |
| Clock jump, boot receiver, process death and blank-screen recovery? | H6 pinned-engine implementation plus approved actual failure tests; no Classic evidence yet                                                                                          |
| Can network ADB be safely restricted/disabled persistently?         | H7 router capability, denied/allowed tests, independent maintenance path and later authorized restart                                                                                |
| Our Modern10 RAM, storage and firmware?                             | H8 after delivery; do not infer from upstream or Classic                                                                                                                             |

H1 is complete, including owner visual ports/power/buttons confirmation. H2 is accepted with the owner’s encryption and single-copy retention exceptions; all required read-capture and verification checks passed. See the [H2 execution record](h2-backup.md). H3–H8 and M6 remain incomplete; no additional device action is authorized by H2 acceptance.

**18 October accelerated H4 closeout (owner request to conserve credits):** retained the completed four-tab preliminary Photos/weather hours and shortened one-tab synthetic Photos run (10 samples / 539.73 s). Actual frame decoded all three WebPs with peak two instrumented Blob URLs; sustained rain animation **FAIL** from broken SVG timing references. Remaining duration, motion pair, HTTP-failure/lease/recovery, router-outage and unavailable physical checks were explicitly **skipped**, not passed; existing M4 deferrals and 48-hour exclusion remain. No H4/M6 acceptance. See [completed, failed and skipped checks](h4-performance.md#owner-requested-accelerated-closeout--18-october-2026).
