# Dayframe maintenance trial

Host-prepared H3.1 utility for the Classic10 on Android 6/API 23. Device installation and the native scope exception await owner approval. See [ADR 0004](../../docs/decisions/0004-frame-maintenance-helper.md) and the [trial/undo runbook](../../docs/hardware/h31-maintenance.md).

Touch **DF** at the right center edge to open the menu; select stock Home, stock Settings or Firefox. Firefox opens its existing profile/tab. The helper requests only permission to draw over other apps, granted separately through Android's normal UI. Start its floating button explicitly from the menu. Hiding it requires confirmation because stock Home has no known app drawer.

This utility is original MIT-licensed source (see LICENSE). It contains no web engine, accessibility service, third-party Java dependencies or native libraries. It does not read browser content or credentials. It is intentionally limited to this API 23 trial; foreground-service and overlay rules on newer Android versions differ.

## Host build

Install a JDK, Python 3, the official Android API 23 platform revision 3 and Android build-tools 36.0.0 outside the repository. Use a private signing keystore with alias `dayframe-h31-trial` and the same password for keystore/key, supplied as a private one-line password file. Keep signing material under ignored `private/`, separate from source. The build makes no downloads, ADB calls or device changes. APKs/output must stay in ignored `build/`.

```sh
python3 hardware/maintenance/build.py \
  --android-jar "$ANDROID_API23_JAR" \
  --build-tools "$ANDROID_BUILD_TOOLS" \
  --keystore "$H31_KEYSTORE" \
  --password-file "$H31_PASSWORD_FILE" \
  --output hardware/maintenance/build/dayframe-maintenance-0.1.0.apk
```

The script refuses to overwrite an existing artifact. It compiles against API 23 plus the build-tools' compile-only lambda stubs, desugars Java 8 lambdas with D8 for API 23, packages the manifest/DEX, aligns, signs and verifies the APK, checks ZIP integrity/absence of native libraries, and prints the artifact hash/size and manifest badging. The lambda stubs are not shipped. Tool provenance and the tested artifact identity are recorded in the runbook; another signing key or changed source yields a different artifact to review.

Host verification is not a runtime or physical touch test. A build can pass even if vendor policy rejects the overlay or a stock activity. Keep ADB reachable for rollback. After force-stop, reboot or process death, the helper may need manual host relaunch; H5/H6 own unattended recovery.
