# H5 — Firefox fullscreen shortcut

## Scope and current state

Implementation in progress on 18 October 2026. The owner requested H5 while keeping previously skipped checks deferred. Use the identified Classic10 / `Classic10_A33M187_20250910-1617_V09`, Android 6.0.1/API 23, Firefox 143.0.4 and accepted DF maintenance overlay. No firmware, WebView, vendor-package, accessibility, root permission or launcher-database changes are part of H5.

The stock VPhoto package advertises no shortcut receiver in current package inspection; Firefox’s ordinary production menu has no **Add to Home screen** entry. It has **Add to shortcuts**, which is a Firefox start-page action and is not proof of an Android home-screen shortcut. The web manifest was missing before this slice. Recheck after serving the manifest before declaring the stock route exhausted.

## Web implementation

The dashboard alone links `/manifest.webmanifest`. Its public metadata requests `fullscreen`, landscape orientation, a stable identity and launch URL `/?display=frame`, and root scope for the existing display/setup routes. It contains no household settings, credentials, photos or private API responses. Admin/setup pages do not advertise installation. Original launcher PNGs at 192 and 512 pixels are rendered from the existing Dayframe `public/favicon.svg`; no new artwork or dependency is imported. Browser support determines the actual display mode; a manifest is not fullscreen acceptance. No service worker or persistent photo cache is added.

## Optional Rootless trial prepared for review

This is a separate proposed app action if the stock launcher cannot host the Firefox shortcut. Do not install until the owner approves this concrete trial.

- APK: [F-Droid Rootless Pixel Launcher 3.9.1 / 30911](https://f-droid.org/packages/amirz.rootless.nexuslauncher/), package `amirz.rootless.nexuslauncher`, minimum SDK 21 / target 27. F-Droid identifies Apache-2.0 licensing; the APK/source are not vendored into Dayframe.
- SHA-256: `7fa44d560dc4577374d45176220de2c0b00a71e09d6d148cdea4e0a52d38404a`, matching the pinned upstream Modern10 artifact. Host ZIP/manifest and Android API 23 v1 signature verification required before installation.
- F-Droid signing certificate SHA-256: `dc6d5235d36f29d79e6a5965116323d27c26fad38b97f988e9365066a1309a44`. v1 verifies; v2/v3 are absent. APK verifier reports unsigned ancillary `META-INF/*.version` entries; record that limit rather than treating the entire archive as v2-signed.
- Declared permissions include launcher settings, status-bar expansion, wallpaper, widgets, boot reception, phone calls and shared-storage reads. Do not use `-g`, grant phone/storage permissions, enable notification/accessibility access, install a companion/feed bridge or sign in to another account. Trial uses Firefox and a shortcut only.
- Before installation: recheck exact target, Firefox/helper versions, absence of this package, retained H2 backup availability, current HOME resolution and stock Home/Settings/DF/Firefox access. Stop on an unexplained mismatch.
- Proposed approved actions: standard `adb install` of this exact APK, open Rootless as an app, create the Dayframe shortcut through Firefox’s normal UI, launch it, and verify viewport/profile/exit. Retain stock Home and the DF overlay. Any default-HOME selection must be separately explicit in the owner’s approval; test a non-default launcher first.
- Undo: use DF → stock Home first, then uninstall only `amirz.rootless.nexuslauncher`. This removes its shortcut/database and leaves Firefox/profile, DF and VPhoto installed. If a HOME preference was explicitly changed, restore the recorded prior choice through normal UI before uninstalling. Removing only the Dayframe shortcut leaves the launcher installed. Do not clear Firefox data.

## Device acceptance sequence

1. Deploy and verify the manifest/icons; refresh the existing production tab without VIEW-intent tab accumulation. Inspect the Firefox menu and current launcher support.
2. On an approved launcher route, add/open **Dayframe** through the normal UI. Record the exact Firefox activity, full 1280 × 800 usable viewport, toolbar/system bars and document dimensions. Check all modes and touch controls without scrolling.
3. Confirm protected photos and saved settings use the existing read-only profile without admin login or secret-bearing URLs. If the standalone profile differs, stop and document before reprovisioning.
4. Owner physically launches the shortcut and performs fullscreen → DF → stock Home → Settings → DF → return to the fullscreen display. Repeat and document whether DF’s generic Firefox button returns to the standalone activity or ordinary browser. Injected input is separate evidence.
5. Record manual recovery/undo and any launcher/vendor foreground behavior. Normal restart and cold-power tests require specific action authorization and owner participation. Do not infer boot startup or shortcut persistence from a current session. H6 is needed only if the documented unattended startup/recovery gaps justify it.

All earlier skipped checks remain deferred: motion comparison, shortened H4 baselines, HTTP-failure/offline-lease/recovery, router outages, physical performance/readability/thermal checks, deferred M4 authorization matrix and 48-hour stability. H5 physical fullscreen navigation checks above are specific to this new route and do not silently close those older deferrals.

## Upstream provenance

Refreshed upstream main on 18 October: `e97c50ba459c49ea8237259f69b95cd28054b628`. Inspected `dashboard/public/manifest.webmanifest`, `dashboard/kiosk/README.md`, `docs/devices.md`, the complete Modern10 report and relevant issue #143 / open PRs #147, #138, #165 and #166. The Classic/Classic Charm reports retain different firmware and system-change scopes; none is adopted as a device procedure. Adopt the manifest/Firefox-shortcut research and preserve an independent native maintenance route. Dayframe uses its own identity, public frame launch URL, artwork and protected display cookie; the upstream demo URL/people/assets, launcher database edits, system changes and native WebView wrapper are not reused. No upstream LICENSE/COPYING grant was found at that tree; no upstream source/assets are copied. Other-model observations are not Classic acceptance.

## Local web validation — 18 October 2026

`pnpm verify` passed: Astro/TypeScript (60 files, zero diagnostics), XO/Prettier (the same two existing photo complexity warnings), 84 unit/integration tests, production build and 113 browser checks with three existing duplicate-viewport skips. The PNGs finished rendering after the first build copied public files, so the final build was repeated and explicitly checked for the dashboard manifest link, absence of that link on admin/setup pages, frame start URL, fullscreen/landscape metadata and both actual PNG dimensions. That final artifact check passed. No application controller, authentication, cache or photo behavior changed. Device acceptance and deployment remain pending below.

## Device preflight and authorization — 18 October 2026

The owner approved the optional Rootless trial as proposed: install/open verified 3.9.1 and create the shortcut after the manifest recheck, leaving phone/storage permissions ungranted, preserving stock Home/DF and without a default-HOME change or reboot. All three retained H2 images are present and match manifest compressed sizes; a stale pre-final capture-path reference was resolved against the accepted external manifest, not treated as a missing final image. No backup was rewritten.

The normal HOME intent reached stock VPhoto; the host `am start -W` wait timed out, so the result was inspected rather than repeating it. Window/UI evidence confirms stock `com.waophoto.smartframe/.ui.MainActivity` is foreground. This is a navigation observation, not an unexplained device crash. The owner physically confirmed stock Home → DF → Firefox/Dayframe before launcher installation. No Home preference write was performed.

## Web deployment — 18 October 2026

Commit `3763694` was pushed to main and [production run 39126495363](https://github.com/codyzu/dayframe/actions/runs/39126495363) completed successfully, including verification, Cloudflare upload and exact-build live smoke. The deployed manifest and both PNGs were fetched and compared byte-for-byte with their committed public files before device evaluation. This supersedes the local validation paragraph’s pending deployment state.

## Rootless trial execution — 18 October 2026

After the live manifest recheck, Firefox still had no Add to Home screen / Install entry on stock VPhoto. The approved standard `adb install` of Rootless succeeded. Installed version 3.9.1 and a full installed `base.apk` readback matched the reviewed hash exactly. Package runtime-permission grants were empty; phone/storage were not granted. Preferred-activities XML is byte-for-byte unchanged. Rootless opened by its explicit app activity without a default-HOME choice, feed bridge, notification/accessibility access or account sign-in. Its launcher UI and Firefox icon rendered. Stock VPhoto and DF remain installed and available. Raw evidence stays ignored under `private/h5-20261018/`.

Firefox initially retained its pre-install menu state after Rootless opened. Read-only package checks showed the shortcut receiver enabled and Firefox already granted the legacy shortcut permission; no permission repair was needed or performed. A controlled Firefox-only force-stop/relaunch, with no profile/data clearing or VIEW intent, surfaced the normal Dayframe Add to Home screen prompt. The owner was asked to complete that normal UI flow. This restart does not establish device boot behavior.

## Proposed maintenance shortcut access

The 0.1.0 helper’s generic Firefox button resolves the Firefox launcher activity (`HomeActivity`), whereas installed web apps use `ExternalAppBrowserActivity`. To preserve a physical route to the new shortcut, a reviewed local 0.2.0 / code 2 helper adds **Raccourcis Dayframe**, using the existing explicit-package launcher helper for `amirz.rootless.nexuslauncher`. Existing Firefox/stock Home/Settings/overlay actions remain. It introduces no URL input, browser engine/profile access, boot receiver or permission. This is an extension of the original maintenance-only exception, not H6.

Prepared APK: `hardware/maintenance/build/dayframe-maintenance-0.2.0.apk`, 12,631 bytes, SHA-256 `5a2a8779f2a3ddc98e57216acd83424f505d89113d56f05bcca3e667f4296eaa`. Offline API 23 compilation/desugaring, ZIP/alignment and v1/v2/v3 signature checks passed with the original trial signer. Manifest still requests only `SYSTEM_ALERT_WINDOW`; no native libraries. No installation is inferred from this host build.

Runtime confirmed that the ordinary Firefox button returns browser chrome. Installation approval is pending for this exact same-signed `adb install -r` update, opening its menu and restarting the overlay through **Afficher le bouton DF** using the retained normal-UI grant. An update may stop the old foreground service, so do not leave setup until DF is visible and usable. If consent is lost, stop for normal-UI review; no root app-op repair. Undo can remove this helper and reinstall the reviewed 0.1.0, then repeat its normal overlay-consent/start flow with the owner; Firefox/profile, Rootless and stock Home are untouched. Host ADB remains the fallback while restoring the helper. A source rollback can alternatively ship a higher-version same-signed maintenance build; do not force an unverified downgrade.

The normal Firefox install prompt opened Android’s Home chooser. Rootless was selected with **Just once**, not Always. The Rootless workspace now exposes a **Dayframe** icon. Physical shortcut launch and the complete fullscreen Home/Settings return remain pending owner confirmation. The separate remote return test below established the old helper’s limitation. No fullscreen acceptance is inferred from icon creation alone.

## Standalone rendering and return measurement

Normal shortcut launch reached `org.mozilla.fenix.customtabs.ExternalAppBrowserActivity`. Actual Android UI bounds for the web-content surface are `[0,0][1280,800]`, versus the old toolbar-limited 1280 × 744 surface. Injected controls selected Morning, Home, Night and Photos; every capture reported the full surface, `scrollable=false`, expected panel content and no Firefox toolbar/tab counter. The Morning capture was visually reviewed with the complete Large footer visible. Production protected photos painted in the standalone context using the existing read-only cookie; no key entry or administrator session was used. This is measured native content-surface evidence, not an instrumented CSS `innerWidth` reading or physical tap-latency test.

The existing DF → Firefox action was exercised and returned ordinary browser chrome. Therefore the prepared **Raccourcis Dayframe** helper button is needed for the practical physical return route. Its conditional installation approval remains pending; the built source is not claimed installed. Previously skipped checks stay deferred.
