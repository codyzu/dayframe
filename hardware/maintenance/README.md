# Dayframe maintenance trial

Host-prepared H3.1 utility for the Classic10 on Android 6/API 23. The owner approved the limited native scope and device trial on 17 October; the APK is installed and normal UI overlay consent is granted. Physical H3.1 acceptance passed using stock Home for Settings; direct Settings launch is unavailable. See [ADR 0004](../../docs/decisions/0004-frame-maintenance-helper.md) and the [trial/undo runbook](../../docs/hardware/h31-maintenance.md).

H5 source 0.2.0 adds **Raccourcis Dayframe**, opening the installed Rootless launcher so its Dayframe shortcut can be selected. The owner-approved update is installed, its installed hash and retained overlay grant were verified, and DF was restored through the normal menu. Physical fullscreen-route acceptance is recorded in the [H5 artifact/execution record](../../docs/hardware/h5-fullscreen.md); the H3.1 acceptance above describes 0.1.0. No additional permission or boot behavior is added. **Raccourcis Dayframe** may open the first workspace page with only Firefox visible; swipe left once to the retained Dayframe shortcut on the second page. In 0.2.0, reboot required manually starting the maintenance app and its DF button; the 0.3.0 H6 extension below adds opt-in startup.

Touch **DF** at the right center edge to open the menu; select stock Home or Firefox. For Settings, use stock Home’s visible Settings control; the direct “Réglages du cadre” button in 0.1.0 displays an error because the vendor activity is not exported. The Home → Settings → DF → Firefox route passed owner touch testing. Firefox opens its existing profile/tab. The helper requests only permission to draw over other apps, granted separately through Android's normal UI. Start its floating button explicitly from the menu. Hiding it requires confirmation because stock Home has no known app drawer.

This utility is original MIT-licensed source (see LICENSE). It contains no web engine, accessibility service, third-party Java dependencies or native libraries. It does not read browser content or credentials. It is intentionally limited to this API 23 trial; foreground-service and overlay rules on newer Android versions differ.

## H6 startup extension

Owner-approved version 0.3.0 is installed/configured and adds opt-in boot reception and network-state reading. It restores DF and launches the exact retained Firefox fullscreen shortcut after vendor/clock/network settling, with a ten-minute bound and no ongoing watchdog. It stores only the configured public `https://host/?display=frame` address and enable flag. Opening maintenance cancels pending startup; disabling startup provides the immediate undo. No Home registration/preference or Firefox profile change. Exact artifact, device approval gate, limitations and uninstall/reinstall rollback: [H6 runbook](../../docs/hardware/h6-startup.md), [ADR 0006](../../docs/decisions/0006-firefox-boot-helper.md). The 0.2.0 description above records the accepted historical manual fallback; its buttons and Rootless route remain available in 0.3.0. Hands-off normal/cold startup is accepted with owner confirmation and actual-frame evidence in the H6 runbook. Leave the transient Home chooser untouched for about one minute; do not select **Always**.

## Host build

Install a JDK, Python 3, the official Android API 23 platform revision 3 and Android build-tools 36.0.0 outside the repository. Use a private signing keystore with alias `dayframe-h31-trial` and the same password for keystore/key, supplied as a private one-line password file. Keep signing material under ignored `private/`, separate from source. The build makes no downloads, ADB calls or device changes. APKs/output must stay in ignored `build/`.

```sh
python3 hardware/maintenance/build.py \
  --android-jar "$ANDROID_API23_JAR" \
  --build-tools "$ANDROID_BUILD_TOOLS" \
  --keystore "$H31_KEYSTORE" \
  --password-file "$H31_PASSWORD_FILE" \
  --output hardware/maintenance/build/dayframe-maintenance-0.3.0.apk
```

The script refuses to overwrite an existing artifact. It compiles against API 23 plus the build-tools' compile-only lambda stubs, desugars Java 8 lambdas with D8 for API 23, packages the manifest/DEX, aligns, signs and verifies the APK, checks ZIP integrity/absence of native libraries, and prints the artifact hash/size and manifest badging. The lambda stubs are not shipped. Tool provenance and the tested artifact identity are recorded in the runbook; another signing key or changed source yields a different artifact to review.

Host verification is not a runtime or physical touch test. A build can pass even if vendor policy rejects the overlay or a stock activity. Keep ADB reachable for rollback. After force-stop, reboot or process death, the helper may need manual host relaunch; H5/H6 own unattended recovery.

Host-only startup checks (does not connect to a frame):

```sh
mkdir -p hardware/maintenance/build/tests
javac -cp "$ANDROID_API23_JAR" -d hardware/maintenance/build/tests \
  hardware/maintenance/src/dev/dayframe/maintenance/*.java \
  hardware/maintenance/tests/dev/dayframe/maintenance/StartupChecks.java
java -cp "hardware/maintenance/build/tests:$ANDROID_API23_JAR" \
  dev.dayframe.maintenance.StartupChecks
```
