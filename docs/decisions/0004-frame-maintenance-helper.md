# ADR 0004: A standalone maintenance helper for H3.1

**Status:** Accepted for the limited H3.1 device trial on 17 October 2026. Owner explicitly approved the native-maintenance scope exception, exact APK installation/launch, normal UI overlay consent and physical round-trip tests. Physical H3.1 acceptance passed using Settings through stock Home; direct Settings launch is unavailable.

**Date:** 17 October 2026

## Problem and scope

Firefox 143.0.4 renders Dayframe on our Classic10, but physical edge gestures do not reveal Android Home/Back. Stock Settings has no visible app list. A normal owner-approved restart returned to stock Home and retained Firefox, but does not supply a manual return route. Remote ADB navigation cannot satisfy H3.

Propose a small, independently authored Android **maintenance utility**, separate from the browser application. This is a narrow exception to specification §1.2's native-app non-goal, requiring the owner's explicit scope decision before device installation. Dayframe remains the Astro/Workers web application in the existing Firefox profile. The utility renders no website and stores no cookies, credentials or household data.

## Selected design

`hardware/maintenance/` contains original MIT-licensed Java source, manifest and an offline host build script. Package `dev.dayframe.maintenance`, version `0.1.0` / code `1`, minimum/target SDK 23; overlay operation explicitly restricted to API 23. Pure DEX has no native libraries and therefore no additional ARM ABI dependency. It uses platform widgets and no third-party runtime dependencies.

After an explicit start, a foreground service places one 64dp **DF** button at the right edge, vertically centered. Touching it opens a French maintenance menu with Firefox, stock Home and stock Settings actions. Firefox uses its package's launcher intent, preserving its current tabs/profile; it does not navigate to a hardcoded URL. Home uses the stock package's launcher intent. Settings targets the observed vendor activity, with an error message and retained menu if cross-app launch is denied. The physical trial later confirmed this activity is not exported: use stock Home's visible Settings control instead; the owner subsequently passed that fallback by touch. The overlay remains available on stock screens so the owner can return to Firefox without an app drawer.

The only requested permission is `SYSTEM_ALERT_WINDOW`. Android 6 requires explicit overlay consent; first try its normal per-app permission screen. If that screen is absent or unusable, stop and review before any alternative grant. No accessibility service, content inspection, global key injection, Internet/storage permission, root code, HOME handler, boot receiver or settings-write permission. The service is private; only the launcher activity is exported, with no automatic actions from intent extras. The foreground notification uses Android's built-in maintenance icon.

The menu can hide the overlay only after a warning/confirmation. It keeps a visible enable button for restoring it before leaving. The helper cannot recover itself after force-stop, reboot or process death; `START_NOT_STICKY` deliberately leaves unattended recovery to H5/H6. Keep trusted Mac ADB available. The overlay may obscure a small part of the dashboard and must be physically tested for legibility, missed taps, vendor takeover and permission-screen behavior. This is a maintenance trial, not fullscreen or kiosk acceptance.

## Alternatives evaluated

- Existing Firefox/vendor UI and edge gestures: tested by the owner; no physical exit/manual relaunch found.
- Rootless 3.9.1 plus Firefox shortcut: upstream has a Modern10 success, but launcher installation alone does not provide a Home control while Firefox is visible. Replacing HOME adds scope without resolving both directions on this Classic. Defer to H5.
- Upstream navigation accessibility service: targets the upstream WebView kiosk, not standalone Firefox. Source license unresolved. Its broader accessibility enablement is unnecessary for two explicit app launch actions. Do not copy or install it.
- GeckoView shell: moves browser profile and introduces engine/lifecycle work; reserve for H6 if justified by H4/H5.
- SystemUI/framework or WebView replacement: larger device scope and unproven recovery. Excluded.

## Upstream and platform evidence

Refreshed upstream `main` on 17 October: `e97c50ba459c49ea8237259f69b95cd28054b628`. Read `docs/devices.md`, `docs/dragontouch-modern10-charm.md`, `dashboard/kiosk/README.md`, `dashboard/kiosk/AndroidManifest.xml` and `dashboard/kiosk/src/com/wesbos/homehq/NavigationService.java`. Retain only the idea of native physical maintenance independent of web content. Original implementation uses an ordinary overlay and explicit app intents, rather than upstream's accessibility navigation/WebView wrapper. No upstream source or assets copied; no LICENSE/COPYING file at that revision.

Refreshed open issues/PRs, including #143, #152, #158, #165 and #166. Read #165 and #166 bodies and the full #166 device diff. [PR #166](https://github.com/wesbos/photo-frame-dashboard/pull/166), head `d02eb8b1f20d68b3f87c8d3bb041e172cf37c76c`, reports the same Classic firmware with USB and replaced WebView 106; it does not validate our maintenance utility, recovery or USB route. [PR #165](https://github.com/wesbos/photo-frame-dashboard/pull/165), head `70c29e9ef349324fea266873db22fab004d24380`, concerns a different Classic10 Charm/Frameo firmware and accessibility navigation. Neither authorizes reproducing vendor disabling, settings changes or system writes here. #158 concerns the upstream kiosk's gesture handling, which this utility does not use.

Primary API contracts: Android [overlay consent](<https://developer.android.com/reference/android/provider/Settings#canDrawOverlays(android.content.Context)>), [API 23 overlay window type](https://developer.android.com/reference/android/view/WindowManager.LayoutParams#TYPE_PHONE), and [non-sticky service behavior](https://developer.android.com/reference/android/app/Service#START_NOT_STICKY). Compile against the official API 23 SDK; current API documentation alone is not a compatibility test. Android SDK binaries retain their own license and are not committed or redistributed.

## Approval and acceptance

Exact proposed device actions, rollback and physical checks are in the [H3.1 runbook](../hardware/h31-maintenance.md). Approval must cover this native-maintenance scope exception, installing/launching the reviewed APK and granting only its per-app overlay permission through the normal UI. A broader fallback grant, boot/system/launcher change or reboot requires a new specific decision. Host compilation and artifact inspection are preparation, not device acceptance.

The owner repeated the Home/Firefox round trip and separately confirmed stock Settings through Home → DF → Firefox/Dayframe by touch; [recorded evidence](../hardware/h31-maintenance.md#acceptance-and-operating-limits) closes H3.1 and H3 with the direct Settings shortcut limitation explicit. No private provisioning or H4–H6 acceptance follows from this trial.

## H5 extension prepared — 18 October 2026

H5’s approved Firefox/Rootless trial established fullscreen rendering but measured that the helper’s existing Firefox launcher intent returns ordinary browser chrome. Source version 0.2.0 / code 2 therefore adds **Raccourcis Dayframe** via the same explicit-package launcher helper, targeting the installed `amirz.rootless.nexuslauncher`. The owner can then select the normal Dayframe shortcut. It adds no web engine, profile/URL access, HOME filter, boot receiver, accessibility service or permission; the original maintenance-only boundary is preserved.

The same-signed APK passed API 23 compilation/desugaring, ZIP/alignment and v1/v2/v3 checks. The [H5 artifact and undo record](../hardware/h5-fullscreen.md#proposed-maintenance-shortcut-access) contains its exact hash/size and proposed `adb install -r`/menu/overlay restart. Device installation approval and the new physical fullscreen Home/Settings round trip remain pending. H3.1’s historical 0.1.0 acceptance remains intact; it is not used to claim acceptance of this update. All earlier skipped H4/M4/stability checks remain deferred.
