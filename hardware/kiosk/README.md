# Dayframe GeckoView recovery trial

A separate H6 package, `dev.dayframe.kiosk`, for the identified ARMv7 Classic 10 on Android 6/API 23. Reviewed **0.1.3/code 4** is installed with native boot/supervision on and old helper startup off. Current physical maintenance, UI-stall (61.476 s), load-stall (68.014 s), protected Photos and actual Settings lifecycle/repaint passed. The approved normal reboot passed (healthy at 66.950 s, fullscreen Night capture by 106.040 s, protected Photos afterward). The owner completed the cold cycle and confirmed automatic startup without taps; a late host connection confirmed healthy fullscreen Night/DK. **H6 is complete for the approved operational scope, with the verification limits below: the owner passed post-cold Photos without key entry and both maintenance paths.** Cold two-minute timing and an isolated paint-reset fault remain unverified with explicit reload/manual Firefox fallback. Older renderer/main-death/force-stop checks retain their exact version scope, including historical failures. [ADR 0007](../../docs/decisions/0007-geckoview-recovery-trial.md) and the [current audit](../../docs/hardware/h6-recovery.md#current-requirement-by-requirement-audit) record artifacts, limits, undo and deferrals.

The original MIT shell includes a pinned, unmodified GeckoView 143 runtime; it does not use system WebView. A private persistent profile, strict display/setup origin policy and a narrow built-in liveness probe support load/paint/renderer recovery. A separate opt-in supervisor process handles main-process/UI liveness and supplies native DK access outside Settings. Boot and supervision default off, require normal overlay consent and must not compete with the accepted helper's boot action. A private `health.json` provides state/generation/timing evidence without page data. Force-stop remains a documented manual fallback, not an automatic-recovery promise.

Only Internet, network state, boot, overlay and the engine's normal wake lock are requested; an AndroidX signature-only private permission is merged. No accessibility, root/settings-write, media/camera/location/storage grant, HOME alias or inbound URL configuration. Only the launcher and protected boot receiver are exported; the unused AndroidX profiling receiver is removed. Full source/dependency notices ship under [assets/licenses.txt](app/src/main/assets/licenses.txt), including the official graph's Google SDK-licensed components; do not relabel them MIT/Apache. APKs and SDK tools remain private/ignored.

## Reproducible host checks

Use JDK **21** (check the actual `release` file, not just an `openjdk@21` symlink), Gradle **8.11.1**, official Android SDK platform **35 revision 2**, build-tools **36.0.0**, existing official platform-tools, Python 3 and Node. `engine-lock.json`, `app/gradle.lockfile`, `gradle/verification-metadata.xml` pin the reviewed tool/runtime graph; no wrapper binary is vendored. Use a private Gradle cache and signing key. `local.properties` is ignored and written by the builder. No Google Play release or modern-Android compatibility is claimed.

For an empty cache, separately resolve the pinned graph using the installed reviewed Gradle/JDK/SDK and the checked-in strict verification metadata. Ordinary builds below use `--offline --dependency-verification strict`; do not regenerate lock/checksum files to silence an unexplained mismatch. The only configured repositories are Google Maven, Maven Central, the Gradle plugin portal and official Mozilla Maven. The host preparation used the official publisher's Gradle/JDK/platform digests and the official Mozilla AAR checksum; exact engine/tool identifiers are in `engine-lock.json`. No paid service is involved.

```sh
python3 hardware/kiosk/build.py \
  --gradle "$H6_GRADLE_BIN" \
  --java-home "$H6_JAVA21_HOME" \
  --sdk "$H6_ANDROID_SDK" \
  --gradle-user-home "$H6_PRIVATE_GRADLE_CACHE" \
  --keystore "$H6_PRIVATE_KEYSTORE" \
  --password-file "$H6_PRIVATE_PASSWORD_FILE" \
  --alias dayframe-h31-trial \
  --output hardware/kiosk/build/dayframe-kiosk-0.1.3-trial-reviewed.apk
```

The builder refuses to overwrite an artifact. It runs Java policy tests, native release/lint checks and the isolated JavaScript probe tests; verifies the official engine digest, release manifest/permission/export scope, min/target API, packaged licenses and ARMv7-only native libraries; then signs, checks API-23 v1/v2/v3 signatures and ZIP alignment. It writes an ignored companion JSON with artifact hash/size, public signer metadata and source hashes. It never downloads tools, calls ADB, installs an APK or changes device settings. Keep keystore passwords out of command arguments and source.

Standalone probe checks:

```sh
node --test hardware/kiosk/tests/heartbeat.test.mjs
pnpm exec xo hardware/kiosk/app/src/main/assets/heartbeat/heartbeat.js hardware/kiosk/tests/heartbeat.test.mjs
```

Android lint remains enabled. Narrow documented exceptions cover the API-23/ARMv7-only non-Play trial, fixed landscape/French UI, a synchronous supervisor-state commit and a removed runtime-only receiver marker. No certificate, permission, exported-component or missing-runtime error is suppressed globally. Source/API compilation and policy tests cannot establish native rendering, touch, process recovery or cookie behavior on the frame.

## Operator controls

DK or a stationary two-finger hold opens native maintenance. The first explicit configuration is a public `https://host/?display=frame` address; no key in a URL. **Connecter cet affichage** opens only that origin's `/setup` in the new profile. Use an approved read-only key through the ordinary page, never an administrator login. Authentication denial stops automatic reloads.

**Recharger la page** preserves the current session; **Nouvelle session** deliberately replaces it. The probe and a successful load must both confirm readiness; a first background paint does not clear the watchdog. Normal Android settings/Wi-Fi access requires DK consent/supervision first; stock Home remains the supported fallback if the vendor rejects a settings intent. The service's independent DK menu can return/restart the kiosk, open stock Home/Firefox or disable supervision. Configured flags are private presence files so both processes see disables without a preferences-cache race.

Do not enable kiosk boot until the staged physical maintenance tests pass. Before any approved boot trial, disable only the old helper's startup toggle through its normal UI; keep the old package/profile/Rootless as fallback. Undo is documented in the runbook. Full H6 and the existing performance/privacy/network/48-hour deferrals remain open until actual acceptance evidence exists.

`faults.py` is a host collector and guarded fault runner. Observation defaults to read-only private evidence. Live faults require a private acceptance record for this exact reviewed APK covering the owner's physical maintenance pass on that installed artifact and native profile checks; observation remains the default. The signal child drops to the installed trial UID, verifies all UID slots and zero effective/permitted/inheritable capabilities, then rechecks target name/UID/start time. An explicit remote acknowledgement is required. The UID and target guards passed on this frame with the signal statement removed; 0.1.1 fault results are recorded separately and do not authorize faults before current-artifact physical acceptance. PID checks and signals are not atomic, so the kernel UID boundary is essential to protect other apps/system processes. The supervisor is excluded by name. This host tool does not change the reviewed APK.

Host safety tests (no ADB or device signals):

```sh
python3 -m unittest discover -s hardware/kiosk/tests -p '*_test.py' -v
```

Seventeen tests cover the UID/capability shell guard, target scope/reuse, remote acknowledgement, ambiguous renderer refusal, bounded timeout/cleanup and independent paint acceptance. They do not establish actual failure/repaint recovery.

`load-stall` is separate from `renderer-stall`. It validates native maintenance/reload controls before STOP, triggers only the ordinary same-session reload, and requires actual same-session LOADING before counting session-replacement recovery. It never substitutes a manual new session for the load watchdog. The existing exact-PID cleanup and two-minute deadline apply; no device fault is executed by host tests.

The current host fault runner pins installed **0.1.3**. The 0.1.2 acceptance record remains retired after its boot stop; the owner physical 0.1.3 pass enabled the exact-artifact gate and both approved faults passed. The additional normal reboot passed; the owner-operated cold cycle is used and automatic startup is owner-confirmed, with timing unverified and final physical maintenance passed. No extra fault/reboot allowance is inferred. `events.json` in the 0.1.3 candidate is private, bounded to 64 fixed-label monotonic events and never accepts page/URL/credential data.

## Bounded overnight observation

`soak.py` samples the current installed 0.1.3 native package (including its supervisor and renderer children), using the H4 sampler's per-process PSS and device-tick core equivalents. It rechecks Classic identity, exact installed artifact at preflight/finalization, native state/foreground and device boot identity. State timestamps in `health.json` change only when state changes; they are not periodic liveness heartbeats. This tool therefore reports sampled operational state and process stability, not independently verified continuous painting or touch responsiveness.

The observer defaults to ten hours at one-minute cadence, retains every raw sample privately and stops on read/identity/health errors or a host-sleep collection gap. It never connects a new target, signals a process, injects input, reloads a page, changes mode/settings/credentials/network or restarts anything. Use only for an owner-authorized observation on the saved verified unit. The earlier Firefox sampler remains Firefox-specific by default; native reuse explicitly supplies `dev.dayframe.kiosk` for process accounting.

```sh
python3 hardware/kiosk/soak.py \
  --target-file private/m4-display-checks/frame-target.txt \
  --output private/NEW_NATIVE_OBSERVATION_DIRECTORY \
  --duration 36000 --interval 60
```

Output must be a new directory below ignored `private/`. `run.json` is updated atomically with progress/terminal status; `samples.jsonl` is flushed after each complete sample. A progress file alone is not proof that its collector is still live. Keep the host on the maintenance network and awake; an optional process-lifetime `caffeinate -i` does not survive host shutdown/lid sleep. Do not silently restart interrupted observations or add separate shorter runs together as uninterrupted stability evidence.

Host-only observer checks: `python3 -m unittest discover -s hardware/kiosk/tests -p 'soak_test.py' -v`. The new four checks passed; the nine existing measurement checks also passed after the process-selector extension. No web suite, APK rebuild or completed boot/fault test was repeated. Morning versus Night workload and the actual observed span must be reported separately from any 48-hour acceptance claim.
