# Classic 10 — setup and everyday operation

Current documented configuration: 19 October 2026, Classic10 firmware `Classic10_A33M187_20250910-1617_V09`, Android 6.0.1/API 23, ARMv7, 1280 × 800. This guide consolidates the accepted installation and H6 operational result. It does not install anything or establish the deferred performance/network/stability acceptance. [Evidence and limits](h6-recovery.md#current-requirement-by-requirement-audit).

## Installed configuration

| Component                                         | Current role                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Dayframe kiosk `dev.dayframe.kiosk`, 0.1.3/code 4 | Primary fullscreen GeckoView 143 display. Native startup and supervision enabled.         |
| Dayframe maintenance helper, 0.3.0                | Retained Firefox fallback; its automatic startup is disabled to avoid competing launches. |
| Firefox 143.0.4 ARMv7 and Rootless 3.9.1          | Retained manual browser/shortcut fallback with its existing profile.                      |
| Stock Home and Android Settings                   | Retained physical maintenance route; preferred Home configuration unchanged.              |

The current native APK, full digest and private artifact location are recorded at the top of [H6 recovery](h6-recovery.md). The GeckoView dependency graph, source licenses and build checks are documented in [the kiosk README](../../hardware/kiosk/README.md). Do not install an older artifact from a historical execution entry or clear either browser profile to troubleshoot.

## Setup on a replacement or reset unit

The existing Classic 10 is already configured. These instructions explain the required sequence for a future replacement; prior approval and measurements apply only to the identified unit and reviewed artifacts.

1. Identify the exact model, firmware, Android/API, ABI, storage map and display using [H1](h1-discovery.md). Another Dragon Touch model requires its own record; do not reuse Classic partition offsets. Follow [H2 backup and verification](backup-and-recovery.md), keeping private images/keys outside Git. A verified capture does not prove restore capability.
2. Establish working physical Home/Settings and browser fallback using the [Firefox installation](firefox-installation.md), [maintenance helper](h31-maintenance.md) and [fullscreen](h5-fullscreen.md) runbooks. Exact package/signature/ABI checks and physical exit are prerequisites for unattended operation. Keep firmware, system WebView and vendor navigation intact.
3. Prepare and verify the exact native APK with the locked [host build procedure](../../hardware/kiosk/README.md#reproducible-host-checks). Follow the [staged native trial](h6-recovery.md#proposed-staged-trial-requiring-specific-approval) rather than running all historical commands. Install normally, verify installed bytes/version and leave boot disabled during initial maintenance acceptance.
4. In native maintenance, set **Adresse publique** to the existing HTTPS dashboard origin with `/?display=frame`. This selects the Large display profile; explicit saved density preferences still take precedence. Do not include credentials in the address. Grant this app's **Autoriser le bouton DK** permission through normal Android consent and enable **Activer la surveillance**. Verify DK and the independent Settings return physically.
5. Choose **Connecter cet affichage**. Enter the existing approved read-only display key only through the same origin's normal setup page; never sign an administrator into the frame. Follow [provisioning and credential recovery](../administration.md#provision-rotate-or-replace-the-frame). Verify protected Photos, reload/session persistence and maintenance in the new native profile independently of Firefox.
6. After the physical and recovery gates pass, disable the old helper's startup through its normal menu before selecting native **Activer le démarrage**. Keep the helper package, Firefox profile and Rootless available. A future reboot/cold-power trial requires its own approved scope; the accepted current-device results do not authorize extra power cycles or prove behavior on another unit.

The Firefox cookie-cap preference is a documented exception in that fallback profile only; native GeckoView has its own persistent profile. Do not copy cookies/databases or apply the Firefox preference to a replacement as an undocumented default. Review the [H5 tradeoff and undo](h5-fullscreen.md) first.

## Everyday use

Leave a transient Home chooser untouched during normal startup: the native receiver opens Dayframe automatically. The accepted normal reboot showed a healthy app at 66.950 seconds uptime and painted fullscreen by 106.040 seconds. The owner confirmed no-touch cold startup; its two-minute timing was not measured because the host transport was offline.

The display follows saved schedule settings. Home or Night after a restart can be correct; Photos selected manually is a temporary in-memory override, and a reload resumes the schedule. Touch reveals mode navigation; select Matin, Photos, Maison or Nuit normally. Configure location, timezone, periods and photo duration from `/admin/settings` on a trusted administrator's device, not by signing into the frame. [Schedule and offline semantics](../decisions/0005-display-scheduling.md).

Tap **DK**, or hold two fingers stationary, for native maintenance. Choose **Retour au tableau de bord** / **Fermer** to return. **Réglages Android** and **Wi-Fi** require the service-owned DK route to be active first. In Android Settings, DK opens the independent service menu; **Retour au kiosk** returns to the display. Stock Home remains the fallback if a vendor Settings intent is rejected.

Night dims the page; it is not proof that the physical backlight turns off. Large text and the warm morning theme are implemented, but family readability/brightness at mirror distance and the current five-icon workload still require their deferred physical acceptance.

## Recovering a problem

| Visible problem                   | First action and limit                                                                                                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading or missing network        | Restore the normal network/time through existing controls and allow bounded recovery. The app waits for a plausible clock; keep TLS validation enabled. Actual router-outage and late-clock acceptance remain deferred.                         |
| Page stuck but DK works           | **Recharger la page** retains the session; **Nouvelle session** replaces the Gecko session in the same persistent profile. Recovery budgets prevent unlimited retries.                                                                          |
| Main app frozen, service DK works | Use service **Redémarrer le kiosk**. UI-stall and load-stall recovery passed on 0.1.3; an isolated lost-paint callback remains unverified.                                                                                                      |
| Access private required           | **Connecter cet affichage**, using normal setup and the approved read-only key. Check home-network policy/expiry from an admin device. Do not rotate a key solely because connectivity failed. Automatic reload stops on authentication denial. |
| Secure connection refused         | Check actual clock and deployment certificate. Do not bypass certificate validation or install a new system trust store as a workaround.                                                                                                        |
| Restart limit reached             | Use maintenance and inspect the cause; use **Firefox de secours** if needed. Do not repeatedly power cycle to hide recurring failure.                                                                                                           |
| Entire package force-stopped      | Its receiver, supervisor and DK are stopped too. Launch the retained app through stock/Rootless launcher or the trusted host; same-package automatic recovery cannot bypass force-stop.                                                         |

The native profile preserves the display cookie across accepted reload/session/restart and boot checks. Private Photos still obey the backend lease/denial policy; indefinite offline private-photo display is not promised. Real outage/painted-pixel expiry acceptance stays deferred.

To revert primary operation to Firefox, follow [H6 undo](h6-recovery.md#undo-and-independent-fallback): disable native startup/supervision through maintenance, restore the helper's startup through its normal UI and retained public address, then verify the existing Firefox shortcut manually. Keep native data until fallback works. Removing only the native package deletes its separate profile and requires reprovisioning if it is installed again. No firmware rollback or launcher database modification is involved.

## M6 requirement audit

| M6 requirement                                            | Evidence available                                                                                               | Remaining status                                                                                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Actual hardware/software inventory                        | [H1](h1-discovery.md), [inventory](dragon-touch-classic10.md)                                                    | Complete within recorded USB/recovery omissions.                                                                                    |
| Verified private firmware backup and recovery limitations | [H2](h2-backup.md)                                                                                               | Accepted with owner encryption/single-copy exceptions; restore remains unproven. Firmware/system changes stay gated.                |
| Compatible browser/kiosk, fullscreen and media            | [H3](h3-firefox.md), [H5](h5-fullscreen.md), [H6 audit](h6-recovery.md#current-requirement-by-requirement-audit) | Accepted operational rendering, WebP/protected Photos and native surface; exhaustive current-workload performance remains deferred. |
| Physical touch and maintenance                            | Owner H3.1 and current 0.1.3/post-cold maintenance passes                                                        | Maintenance accepted; distance readability and ordinary-touch timing remain deferred.                                               |
| Protected images without admin login                      | Native provisioning/persistence and owner post-cold Photos result in H6                                          | Accepted for recorded paths; full live role/dual-stack/off-network/revocation matrix stays deferred.                                |
| Automatic startup, manual fallback and bounded recovery   | Current native source, exact-artifact checks and [H6 execution](h6-recovery.md)                                  | Operational H6 accepted; isolated paint-reset and cold timing limits retain explicit fallback.                                      |
| Network recovery, sleep/resume and timezone behavior      | Implemented bounded recovery/scheduler; actual Settings lifecycle and short M5 boundary/override/Night checks    | Real outages, late clock, broader lifecycle/DST and backlight acceptance remain deferred.                                           |
| Performance/stability, including extended run             | [H4 measured evidence](h4-performance.md), current host/native tests                                             | Preliminary/short runs only; excluded 48-hour run and earlier performance/physical deferrals remain open.                           |
| Setup and operating instructions                          | This guide and linked exact-artifact runbooks                                                                    | Consolidated against committed source and acceptance records; no fresh device test implied.                                         |
| H7 hardening                                              | Existing network-security plan                                                                                   | Explicitly deferred by owner on 19 October; no router/device/ADB changes to implement now.                                          |
| H8 comparison                                             | Separate Modern10 plan                                                                                           | Delivery/own-unit inspection pending; does not establish Classic acceptance.                                                        |

Full M6 acceptance remains open. The user's instruction to avoid redundant tests is satisfied by reusing exact recorded evidence, not by converting deferred checks into passes. Schedule only genuinely missing acceptance when the owner reopens those checks.

## Provenance and document validation

Consolidated from current Dayframe native menu/receiver/configuration source and H1–H6 execution records at repository revision `2f18c01`. The prior upstream review at `e97c50ba459c49ea8237259f69b95cd28054b628` and [research provenance](sources.md) remain applicable. The upstream Modern10 report and current issue/PR listings were inspected on 19 October; an attempted fresh Git HEAD lookup failed DNS, so no new source revision is claimed. No upstream code/assets copied and no live device, network, credential or package action performed for this guide. Only local Markdown formatting, links and diff checks are appropriate for this documentation change.
