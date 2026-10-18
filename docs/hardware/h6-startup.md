# H6 — Automatic Firefox startup

**18 October 2026: H6 startup slice accepted.** Helper 0.3.0 is installed/configured; hands-off normal restart and cold-power startup are verified by actual-frame observation and owner confirmation. Owner requested automatic Dayframe startup after a power cycle and retained every previously skipped check as deferred. This closes the bounded startup slice under [ADR 0006](../decisions/0006-firefox-boot-helper.md), not the broader GeckoView/watchdog/failure-recovery scope.

## Reviewable device trial

Prepared artifact: `hardware/maintenance/build/dayframe-maintenance-0.3.0.apk`, **16,727 bytes**, SHA-256 **`3a04418cde01103dc37ec0e0937d171c7488c09bbd948ede47658f5181283af0`**. Same existing trial signing certificate (`3d65500a884b71fa37bdee1ca5e0ad3e7470119c45563f62c9cc3c5eceb347d4`), package `dev.dayframe.maintenance`, version code 3, min/target API 23, pure DEX. API 23 build, ZIP integrity, alignment and v1/v2/v3 verification passed; Java host policy/address checks passed. SDK tools remain outside the repository; APK/signing material are ignored.

Reviewed trial actions, subsequently explicitly approved by the owner:

1. Recheck the identified Classic firmware, Firefox 143.0.4, installed helper 0.2.0, existing overlay grant and unchanged Home preferences. Save the old helper APK and baseline metadata privately; verify prepared hash and signer. Preserve the accepted Firefox profile/preference.
2. Standard same-signed `adb install -r` of this exact APK, without `-g`. Its only added permissions are normal boot reception and reading network state. Read back installed APK/version/hash and verify retained overlay grant/Home preferences. Open the menu and restore DF; stop if consent was lost instead of repairing app-ops.
3. Through the normal helper UI, save the existing public production `/?display=frame` address and enable startup. No private key or URL credential. Test **Ouvrir Dayframe plein écran** and verify the standalone activity, full surface, protected photo access and DF. Opening maintenance cancels pending boot navigation.
4. One normal Android reboot, then verify changed boot ID, firmware/browser identity, clock/network readiness, automatic standalone foreground, DF and protected-photo rendering without key entry or host navigation. Record timing and Home preference equality. Observe vendor competition after settling; do not repeatedly force Firefox foreground to mask a failure.
5. One owner-operated cold power cycle with no manual taps after power returns. Observe automatically from the existing target; owner confirms Dayframe/DF/private photos on the physical display. ADB observations are labelled remote evidence. Request physical power handling only when the frame is ready.

Authorization for implementation is recorded by the owner's H6 request. The owner subsequently answered **Approve this H6 trial**, authorizing the exact actions above. Installation, normal-UI configuration and pre-reboot checks passed as recorded below; normal/cold startup acceptance is complete within this slice; broader H6 recovery remains open.

## Behavior, limitations and undo

The helper restores DF, then launches the existing fullscreen Firefox shortcut once after a minimum 20-second vendor settling period, a plausible clock and ten connected seconds. It checks every two seconds and gives up after ten minutes, leaving DF for manual recovery. No default Home change; no system or firmware writes. Firefox retains its own TLS validation and existing profile. A connected network does not prove Internet reachability; the helper neither reads browser content nor retries a failed web load. Rootless stays available for the accepted manual route.

The existing Firefox WorkManager receiver may start Firefox before network time. The accepted H5 `network.cookie.maxageCap=0` preference remains applied; delaying this helper's launch is not a replacement for it. Boot startup does not establish handling of load stalls, blank paint, renderer death, Firefox/helper process death or force-stop. Force-stop requires manual helper relaunch before later boot reception can work. No claim of two-minute recovery or long-run reliability.

Undo: **DF → Désactiver le démarrage automatique** cancels the pending job and disables later automatic starts, while retaining manual DF/Firefox/Rootless access. For complete removal of the new permissions, first reach stock Home, uninstall only the helper and reinstall the retained reviewed 0.2.0 APK, then repeat normal overlay consent/start and physical maintenance validation. This loses helper preferences only; Firefox/profile/Rootless/stock Home remain. Do not force a downgrade or clear Firefox data. Keep trusted Mac ADB available throughout. A higher-version same-signed source rollback is another option.

All earlier skipped checks remain deferred: shortened H4 baseline, motion comparison, HTTP-failure/private-photo lease/recovery, router outages, physical performance/readability/thermal checks, deferred live security matrix and ≥48-hour stability. Full H4/M4/M5/M6 and broader H6 acceptance remain open.

Raw preflight and shortcut evidence: ignored `private/h6-20261018/`. Provenance, device identity and source/license decisions: [ADR 0006](../decisions/0006-firefox-boot-helper.md).

## Approved installation and configuration

Standard same-signed `adb install -r` succeeded for the exact reviewed 0.3.0 artifact; the full installed APK readback matches its SHA-256. Version, existing overlay grant and unchanged preferred-HOME XML passed. No `-g`, new overlay consent or app-op repair. DF was restored from the normal menu. The public production frame address was entered and startup enabled through the helper UI; no secret was read or entered.

**Ouvrir Dayframe plein écran** reached the existing Firefox standalone activity. A protected photo painted at 1280 × 800 with DF visible and no Firefox toolbar, verified by private XML and visual screenshot review. The initial host assertion used a nonexistent photo label; the captured XML supplied the actual application alt text (`Photo de la collection familiale`), and the assertion was corrected without changing the device. This is injected navigation/remote visual evidence, not fresh physical touch acceptance. The normal reboot observation then began; no second reboot is authorized by a failed observation.

## Normal reboot observation

Exactly one approved `adb reboot` completed. The read-only observer verified changed boot ID and matching Classic/Firefox identity, without manually launching either app. Firefox standalone was first observed foreground at device uptime **59.62 seconds** and remained there through the final sample at **139.53 seconds** (24 samples). DF and helper process were present, the clock was within 120 seconds of host time, and overlay grant/preferred-HOME XML were retained. The final screenshot was visually reviewed: full-surface scheduled **Night** display, no Firefox toolbar, DF at the right edge. No photo element is expected in Night; this result alone does not test post-boot photo authentication.

The cold-cycle baseline and read-only observer were then prepared. The owner was handed the frame for the approved unplug/reconnect and asked to confirm automatic fullscreen/DF, then private Photos without key entry and DF → **Ouvrir Dayframe plein écran** return. At that handoff, cold-cycle and fresh physical acceptance were pending; the subsequently reported result follows below. No extra power operation is inferred.

## Cold-cycle result and Home chooser clarification

The owner performed the approved cold cycle and reported that fullscreen, private Photos without key entry and DF → **Ouvrir Dayframe plein écran** all worked, but that **Just once** was selected at the Home chooser. Therefore this is **not hands-off cold-start acceptance**. No Home default was written. The observer verified a changed boot, matching identity, retained Home XML/overlay grant, protected photo element and DF, with standalone first observed at uptime **64.17 seconds** and retained through **154.51 seconds** (24 samples).

Retained ActivityManager logs show the chooser appeared during early boot; Rootless was selected at corrected device time **21:31:02.299**, then the helper itself launched Firefox’s PWA target at **21:31:09.267**, with standalone displayed at **21:31:13.122**. This establishes that the tap preceded the helper launch by about seven seconds; it does not establish that the tap was necessary. The preceding normal reboot retained the chooser at sampled uptime 47.33/51.35 seconds and then reached Firefox through the helper with no Rootless HOME selection in the retained startup log. That supports a transient chooser during the intentional boot wait, rather than requiring a default-HOME change.

One further normal reboot with no taps for two minutes was proposed to isolate the question without changing HOME. The owner subsequently approved it; the completed observation follows below. No Home-preference change was authorized. The owner’s physical Photos/DF result is accepted within its stated scope; previously skipped checks remain deferred.

## Additional untouched reboot — chooser replaced automatically

The owner explicitly approved **one untouched reboot**. Exactly one further normal Android reboot was issued; no browser/helper navigation, Home selection or credential repair was sent by the observer. Changed boot ID and matching identity passed. Standalone Dayframe was first observed at **58.68 seconds uptime** and remained foreground through **137.91 seconds** (24 samples), with DF/helper present, correct clock, retained overlay grant and unchanged Home preferences. Final screenshot review confirms full-surface scheduled Night with DF and no browser chrome.

ActivityManager shows the chooser at early boot, followed by the helper UID launching Firefox’s explicit PWA activity and Firefox displaying standalone. No Rootless HOME launch appears in the retained startup sequence. The chooser is transient during the startup wait; selecting **Just once** is not required for this observed normal-reboot route. No default-HOME change or further APK update is necessary to address it. The earlier cold cycle included an owner tap and, by itself, did not establish hands-off cold startup; the subsequent untouched cold test below resolves that gap. The owner subsequently confirmed **Yes, no taps needed**, accepting hands-off normal-reboot startup for this slice. All previous skipped checks and broader H6 recovery/soak gates remain deferred/open.

## Final untouched cold cycle — startup slice accepted

Following the owner’s request about repeating the cold boot, a fresh read-only baseline and observer were prepared without issuing a power command. The owner performed the unplug/wait/reconnect test and confirmed **Yes, it worked by not touching it!** No **Just once** or **Always** selection was needed.

Changed boot ID and exact Classic/Firefox identity passed. Standalone Dayframe and DF were already foreground in the first available sample at **57.71 seconds uptime**, remaining through **148.12 seconds** (24 samples). The helper process, corrected clock, existing overlay grant and unchanged preferred-HOME XML passed. ActivityManager records the helper UID launching Firefox’s explicit PWA target, with no Rootless HOME launch in the retained startup sequence. The final capture includes the protected photo element; visual review shows the photo filling the fullscreen content surface according to its fit setting, DF visible and no Firefox toolbar. The observer did not navigate, inject a tap or repair credentials. Owner confirmation supplies physical hands-off startup evidence; the remote capture supplies post-boot photo/DF evidence.

**Acceptance:** the requested H6 startup slice is complete: normal restart and power removal/restoration return automatically to the accepted fullscreen Firefox display with DF, preserving the existing profile and Home preferences. During the roughly one-minute startup wait, leave the transient Home chooser alone. No launcher-default change is needed. Earlier assisted cold results remain historical and are not retroactively counted as hands-off tests. No new APK or browser preference was required after helper 0.3.0.

**Still open:** full H6 stalled-load/blank-paint/process/renderer recovery, force-stop behavior beyond the documented manual fallback, late/unusable network tests, and all previously deferred performance/privacy/security/outage/48-hour checks. Full H4/M4/M5/M6 acceptance remains open. Raw evidence and owner confirmations stay ignored under `private/h6-20261018/`.
