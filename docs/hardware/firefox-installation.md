# Firefox installation and performance plan

**H3 executed on Classic 10, 17 October 2026; final physical exit/relaunch confirmation pending.** See the [execution record](h3-firefox.md) for verified installation, actual rendering/API evidence and limitations. Commands below are the reusable procedure; installation/launch writes application state and requires its own H3 authorization after H2 acceptance. No launcher replacement, WebView modification, vendor-app disabling, CA changes or system writes are included.

## Host verification evidence, 16 October 2026

Downloaded on the Mac from the [official Mozilla archive APK](https://archive.mozilla.org/pub/fenix/releases/143.0.4/android/fenix-143.0.4-android-armeabi-v7a/fenix-143.0.4.multi.android-armeabi-v7a.apk), outside the repository. Host `shasum -a 256` returned:

```text
af560738627d4efc9ace75e708fc48aad6a24c78ef43a89daca27e16ff3829f8
```

This independently matches the owner's value and [upstream report](https://github.com/wesbos/photo-frame-dashboard/blob/e97c50ba459c49ea8237259f69b95cd28054b628/docs/dragontouch-modern10-charm.md). A host-only binary AndroidManifest.xml inspection found package `org.mozilla.firefox`, versionName `143.0.4`, versionCode `2016118128`, minimum SDK **21**, target SDK **36**. ZIP inspection found native libraries under `lib/armeabi-v7a/`. Our API 23 / ARMv7 unit therefore meets declared OS/ABI requirements. These checks do not prove graphics-driver compatibility, sufficient memory or successful execution.

The upstream contributor reports Android signature validation and execution on Modern10 Charm. **At initial planning, local cryptographic APK signature verification had not been performed:** Android SDK build-tools were not available in the inspected host locations. The [17 October H3 preflight](h3-firefox.md) now records successful official-tool verification; installation has since succeeded, while final physical exit/relaunch acceptance remains pending. Hash agreement with an upstream value is useful integrity evidence, not an independently authenticated signer identity. Firefox 143 is a historical compatibility experiment, not a current-security baseline; review maintenance options before long-term use.

## H3 procedure for a later session

Prerequisites: H2 accepted with verified region coverage and manifest (including its recorded owner exceptions for encryption and single-copy retention); device identity rechecked; stock launcher/Settings accessible by touch; specific installation authorization. Review current upstream changes and any new Mozilla compatibility information. Work in a private host directory.

```sh
APK='fenix-143.0.4.multi.android-armeabi-v7a.apk'
curl --fail --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  'https://archive.mozilla.org/pub/fenix/releases/143.0.4/android/fenix-143.0.4-android-armeabi-v7a/fenix-143.0.4.multi.android-armeabi-v7a.apk' \
  --output "$APK"
printf '%s  %s\n' \
  'af560738627d4efc9ace75e708fc48aad6a24c78ef43a89daca27e16ff3829f8' "$APK" \
  | shasum -a 256 -c -
unzip -t "$APK"
aapt dump badging "$APK"
apksigner verify --verbose --print-certs --min-sdk-version 23 "$APK"
```

Use `aapt` and `apksigner` from official Android SDK build-tools, with explicit paths if necessary. Require valid signature for API 23 (Android 6 needs v1/JAR signing), exact package/version, minimum SDK ≤23 and ARMv7 native code. Privately record signer SHA-256, verification output and tool versions; compare signer identity with an independently trusted official Mozilla distribution record when available. Stop if provenance/signature is ambiguous, any hash differs or the package is already installed under another signer. Do not choose an unofficial APK mirror as a workaround.

Recheck identity/root, `/data` space and initial Firefox absence with the selected target. Leave generous room for installed native code/profile/cache; APK size alone understates installed usage.

```sh
adb -s "$FRAME_ADDR" shell dumpsys package org.mozilla.firefox
adb -s "$FRAME_ADDR" shell df /data
# WRITE: only after the H3 approval and all checks pass.
adb -s "$FRAME_ADDR" install "$APK"
adb -s "$FRAME_ADDR" shell dumpsys package org.mozilla.firefox
# WRITE/LAUNCH: package-scoped HTTPS VIEW intent, no credential in the URL.
DAYFRAME_URL='https://REPLACE_WITH_APPROVED_DAYFRAME_HOST/?display=frame'
adb -s "$FRAME_ADDR" shell am start -a android.intent.action.VIEW \
  -d "$DAYFRAME_URL" -p org.mozilla.firefox
```

Require `Success`, correct installed version and a visible Firefox onboarding/window. `adb install` is the minimal first attempt; do not silently fall back to root `pm install`, downgrade flags, replacement flags, permission grants or system remounts. If unsupported on this firmware, stop and prepare the exact alternative for review. Upstream used a staged `/data/local/tmp` APK plus root-shell `pm install`; that is a possible later revision, not authorization here.

Complete onboarding by touch, without signing into Mozilla/Google or storing an admin account. Open the approved deployed HTTPS Dayframe, not the upstream mock dashboard as proof of our app. Do not bypass certificate errors; record device date and TLS failure. Use public/synthetic data first. Only after M4 production acceptance is complete, provision the read-only display cookie through `/setup` using the [administration flow](../administration.md#provision-rotate-or-replace-the-frame) and privately entered key. Open `/?display=frame`; never put the key in a URL or ADB command. The current local M4 implementation is not evidence of production activation.

Before leaving H3, physically demonstrate returning to stock Settings/home and manually reopening Firefox. A later approved undo is `adb -s "$FRAME_ADDR" uninstall org.mozilla.firefox`, which removes its profile and display session; record reprovisioning requirements. Do not run it as a routine test or undo a pre-existing Firefox installation.

## H4 validation matrix

Record firmware, installed browser version, Dayframe revision/deployment, profile/density and test duration. Use synthetic photos until privacy/authentication passes. Retain raw logs/screenshots privately and publish sanitized summaries only.

| Check           | Action / expected evidence                                                                                                                                                                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Engine and APIs | Load built ES modules; exercise `fetch`, HTTPS, JSON, `Intl.DateTimeFormat` with `Europe/Paris`, localStorage persistence, CSS grid/flex, `clamp`, dynamic viewport sizing and SVG. Check `crypto.subtle` in secure context where needed; do not test admin upload credentials on frame. Test actual features rather than relying on user-agent/version. |
| Layout / touch  | 1280 × 800 landscape, Large frame profile, no kiosk-mode scroll, legible at 1–3 m. Tap mode/text-size/photo controls repeatedly; record missed touches, clipping and visible response time. Target ≤1 second for ordinary local UI response, measured on this device.                                                                                    |
| Weather / chart | Clock/date/timezone correct; live weather, stale/error state, temperature line, precipitation encoding, labels and current-time marker visible. Compare screenshot with desktop fixture.                                                                                                                                                                 |
| Meteocons       | Test animated current/hourly day/night/rain icons and existing reduced-motion still variants. Compare CPU and touch/clock behavior in equivalent states; document a reduced-motion operating choice if animation is costly. No app code changes in this session.                                                                                         |
| Photos / auth   | WebP decode, contain/cover, sequential transitions, bounded preload. Confirm cookie-protected images, no admin session, unauthorized writes denied, restart cookie persistence and revoked credential denial. Honor the current five-minute private in-memory lease; offline photos are not promised indefinitely.                                       |
| Connectivity    | With a separately approved router-side interruption, exercise short and ≥5-minute outage, restore Wi-Fi/internet and observe retry/stale behavior. H4 does not alter Android Wi-Fi settings. Document app-shell cold-load limitations and manual reload needs.                                                                                           |
| Fullscreen      | Observe toolbar/nav-bar footprint and any existing fullscreen capability. H3/H4 can pass rendering with browser chrome; fullscreen is an H5 gate. Do not presume fullscreen API or a home shortcut works.                                                                                                                                                |
| Memory / CPU    | Sample before browser launch, after first render, at 15 min, 1 h, 24 h and 48 h. Include browser child/content processes and system headroom, not only the main PID. Record low-memory kills, restart count, swap and progressive growth.                                                                                                                |
| Long run        | Minimum 48 hours including weather refreshes, repeated photo transitions, scheduled behavior once M5 exists, touch and outages. No unexplained blank screens/crashes, no sustained upward memory trend, no repeated large downloads. H4 preliminary results do not complete M6 before M5 exists.                                                         |

Read-only measurement commands for the later authorized session:

```sh
adb -s "$FRAME_ADDR" shell dumpsys meminfo org.mozilla.firefox
adb -s "$FRAME_ADDR" shell cat /proc/meminfo
adb -s "$FRAME_ADDR" shell cat /proc/swaps
adb -s "$FRAME_ADDR" shell ps
adb -s "$FRAME_ADDR" shell dumpsys cpuinfo
adb -s "$FRAME_ADDR" shell cat /proc/stat
adb -s "$FRAME_ADDR" shell date
adb -s "$FRAME_ADDR" shell uptime
```

Use `ps` to identify all relevant Firefox processes and read `/proc/VERIFIED_PID/stat` twice over a known interval if CPU attribution is unclear. Parse the parenthesized process name correctly; fields 14/15 are user/system ticks. Convert tick deltas with the measured `CLK_TCK` (if available), and sum child/content processes without double counting. CPU hotplug makes one `top` snapshot misleading. Do not clear logs (`logcat -c`), force-stop or change settings just to measure. Read-only logcat capture, if needed, stays private and must be reviewed for URLs/keys.

Issue [#143](https://github.com/wesbos/photo-frame-dashboard/issues/143) and PR [#147](https://github.com/wesbos/photo-frame-dashboard/pull/147) report continuous-animation CPU cost on other A33/WebView frames. This motivates the paired test; it is not a Firefox/Classic 10 performance result.

Stop on reboot loops, overheating/power instability, persistent UI lockup, credential exposure, unexplained package identity, signature mismatch or failure to exit. Preserve evidence and review one change at a time. No swap, WebView or vendor-package changes are automatic remedies.
