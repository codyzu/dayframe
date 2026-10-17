# H3.1 — Physical maintenance and manual Firefox relaunch

**17 October 2026: host implementation prepared; native scope/device approval and physical acceptance pending.** H3 remains incomplete. This runbook is a reviewable proposal, not authorization to execute its device commands.

## Scope and artifact

[ADR 0004](../decisions/0004-frame-maintenance-helper.md) proposes a narrow native-maintenance exception. Original MIT source is under [hardware/maintenance](../../hardware/maintenance/README.md). Package `dev.dayframe.maintenance`, version `0.1.0` / `1`. One 64dp floating **DF** button opens a French menu with Firefox, stock Home and stock Settings. Its single declared permission is `android.permission.SYSTEM_ALERT_WINDOW`; API 23 only. No browser/profile migration or private provisioning.

The existing frame was reidentified read-only on 17 October as `Classic10`, firmware `Classic10_A33M187_20250910-1617_V09`, API 23, `armeabi-v7a`, root shell. Firefox remains 143.0.4 / 2016118128. The new package ID was absent. Read-only package inspection also found Android Settings installed and advertising the normal overlay-permission intent; opening/using that screen is still untested. Private raw evidence is ignored under `diagnostics/h31/`. Recheck these fields immediately before installation and stop on a mismatch; do not infer target identity from an ADB address alone.

## Exact proposed device trial

Owner approval must explicitly cover the native scope exception, this APK installation, opening the helper/normal per-app overlay permission page, granting only this app's overlay permission, starting its foreground service, and the touch round trip. A root app-op grant, accessibility enablement, launcher replacement, reboot, system/settings write or another package is outside this proposal. If the normal permission UI cannot be used, leave the helper menu available and stop for review.

After that approval, select the confirmed private target for every command. The placeholders below contain no household address. Confirm H2's retained private backup is available; restore and independent recovery remain unproven. Inspect the current stock foreground and APK identity again, keeping logs private.

```sh
# Only after specific approval; FRAME_ADDR is the privately confirmed target.
# APK is the reviewed local build; first compare its SHA-256 to the recorded value.
adb -s "$FRAME_ADDR" install hardware/maintenance/build/dayframe-maintenance-0.1.0.apk
adb -s "$FRAME_ADDR" shell dumpsys package dev.dayframe.maintenance
adb -s "$FRAME_ADDR" shell am start -n dev.dayframe.maintenance/.MaintenanceActivity
```

Use standard `adb install`, without `-r`, root-install fallback or broad permission flags. On an error or timeout, inspect package/transfer state before retrying; do not assume failure permits replacement or alternate installation. Verify installed version/code and the installed base APK's readback hash against the reviewed artifact. The package's overlay app-op must be recorded before permission consent, then after the owner uses the normal UI; never overwrite unrelated grants/settings.

1. With the owner present at the frame, use **Autoriser le bouton flottant** to open its per-app overlay consent page. The owner enables the overlay permission there. Return to the existing helper menu; if Android Back is missing on this consent page, a single separately included host launch of the same helper activity above can return to it for setup. This setup assistance does not count as physical round-trip evidence.
2. Touch **Afficher le bouton DF**. Confirm DF appears and reopens the helper menu. Check foreground service/window and absence of launch errors privately. If consent or the overlay fails, keep the stock Home accessible with ADB and stop.
3. Touch **Firefox / Dayframe**. Confirm the existing Dayframe tab/profile and its touch controls still work. Do not issue a display credential or sign in as an administrator.
4. Perform **Dayframe → DF → Accueil du cadre → DF → Firefox / Dayframe** by physical touch. Repeat at least twice without ADB navigation. Record owner observations and any timing/missed taps.
5. Perform **Dayframe → DF → Réglages du cadre → DF → Firefox / Dayframe** by touch. Enter only a harmless visible stock Settings/About page; do not choose reset/update or modify settings. If the vendor Settings activity rejects cross-app launch, test access through stock Home's visible Settings control and document that route.
6. Record that DF remains reachable on both sides, no chooser/default-HOME change occurs, and Firefox retains its profile/Dayframe tab. Record any dashboard area obscured. Stop on a lost overlay, blocked return, repeated blank page or vendor takeover. Host screenshots/window/activity evidence corroborate the test but never replace owner physical confirmation.

Leave the tested overlay running only if the owner wants this trial retained. A reboot is not part of this approval; an APK that works now does not establish unattended recovery. No H4/H5/H6 gates pass from this test.

## Undo

While ADB remains reachable, first return to stock Home and then uninstall only the new helper:

```sh
adb -s "$FRAME_ADDR" shell am start -n com.waophoto.smartframe/.ui.MainActivity
adb -s "$FRAME_ADDR" uninstall dev.dayframe.maintenance
```

Confirm the stock screen is accessible, the helper package/service/window is gone, and Firefox remains installed with its existing profile. Uninstall removes the helper's overlay grant and private app data. No launcher/default-HOME change needs undo. If the helper is merely force-stopped or its overlay hidden, its menu can be reopened using the explicit host launch above, then the owner can start DF again. This is a maintenance fallback, not H3 acceptance. Keep the private signing material to update the same trial package later; losing it requires uninstall/reinstall of the helper, not Firefox.

## Validation record

Prepared and inspected locally on 17 October 2026 using OpenJDK 26.0.1, official Android API 23 platform revision 3 and official build-tools 36.0.0. Platform ZIP size 70,433,421 bytes and repository SHA-1 `027fede3de6aa1649115bbd0bffff30ccd51c9a0` matched before extraction. The build-tools archive was previously verified in H3; its local tools are reused, not redistributed.

- API 23 Java compilation and D8 desugaring passed. The JDK reports Java 8 source/target obsolescence warnings; this target is deliberate for Android 6.
- ZIP integrity, 4-byte alignment and APK signatures passed, including **v1** required by Android 6 (also v2/v3).
- Binary manifest reports the exact package/version, minimum/target SDK 23 and only `SYSTEM_ALERT_WINDOW`; DEX is present and there are no native libraries.
- APK: `hardware/maintenance/build/dayframe-maintenance-0.1.0.apk`, **12,631 bytes**, SHA-256 `8c16f18dbaa4a3f396234ab388d681b63a4544b279a3e023c359f3b5247462ac`.
- Trial signing certificate SHA-256: `3d65500a884b71fa37bdee1ca5e0ad3e7470119c45563f62c9cc3c5eceb347d4`. Key/password stay private; neither is a production browser credential.

No installation or permission change has been performed. No runtime, physical round-trip, boot or stability acceptance is inferred from compilation. Keep APKs, signing keys, raw ADB output and screenshots ignored/private. Only sanitized results go in source control.

Additional host checks passed: Python build-script syntax, compiled API 23 DEX version 035 with lambda desugaring, permission/exported-component boundary inspection, local Markdown links, formatting and `git diff --check`. `pnpm lint` passed with the same two pre-existing photo complexity warnings. No web application behavior changed; browser/unit suites were not repeated for this native utility. Actual runtime, layout and touch checks require the approved device trial.
