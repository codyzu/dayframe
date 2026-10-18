# H4 — Firefox measurements and baseline

Prepared 17 October 2026. H3/H3.1 are accepted. H4 is **not accepted**: the one-hour preliminary production Photos run completed; weather/paired-motion testing and a controlled 48-hour result remain pending. Actual-frame provisioning, browser restart persistence, rotation invalidation and reprovisioning have passed. The owner deferred standalone revocation and further key entry; unresolved network-path checks stay explicit during preliminary testing. See the [validation matrix](firefox-installation.md#h4-validation-matrix) and [M4 acceptance sequence](#m4-display-acceptance-before-the-baseline).

## Scope and prerequisites

This slice uses the existing Classic 10, Firefox 143.0.4 and DF maintenance helper. No installation, reboot, launcher, firmware, Android setting, permission, swap or vendor-package changes. Browser restart is a separate explicit test action; the sampler never performs it. Network interruption requires its own approval and a tested rollback. Keep stock Home → Settings → DF → Firefox physically available.

Before every run, verify the selected target against the owner's unit and the [inventory](dragon-touch-classic10.md). The sampler pins model, firmware, board, hardware, Android/API/ABI and browser version; a match does not uniquely identify a physical unit. Never select the first ADB device automatically. Stop on unexplained identity/version drift.

Use a small fixed synthetic album (at least three landscape/portrait WebPs, approximately 1600px maximum edge), the same location/forecast state, Large frame profile and photo interval for comparisons. Existing household photos need not be deleted or replaced to construct fixtures: use a separate local synthetic environment if needed and label the production photos check separately. Never publicly expose the real catalog to make testing easier.

Record deployment revision/version **actually served**, host Git revision/dirty state, fixture IDs/count/byte sizes, browser tab count, selected mode, density, motion setting, power, room conditions and visible browser chrome privately in a run note. Browser chrome/clipped navigation is an H5 limitation, not a new H4 fix. Do not put a key in a URL, command argument, shell history, screenshot, incident note or Git. No administrator login on the frame.

## Host sampler

Python 3 standard library and existing `adb` only; no new service or recurring cost. From the repository root, substitute the privately verified target and deployed revision:

```sh
FRAME_ADDR='OWNER_VERIFIED_ADB_TARGET'
DEPLOYED_REVISION='VERIFIED_PUBLIC_DEPLOYMENT_REVISION'
python3 hardware/h4/measure.py --target "$FRAME_ADDR" \
  --out private/h4-prelaunch --deployment "$DEPLOYED_REVISION" \
  --label prelaunch --duration 0
python3 hardware/h4/measure.py --target "$FRAME_ADDR" \
  --out private/h4-weather-baseline --deployment "$DEPLOYED_REVISION" \
  --label weather-animated --duration 3600 --interval 60
```

Each destination must be new and below ignored `private/`; the sampler sets a restrictive umask and creates directories with mode 0700. Target is never written to run metadata. Raw process/memory output can contain private paths; keep the entire directory private. Share only a manually reviewed sanitized summary. A host sleep/disconnection invalidates continuous collection; keep the Mac powered/awake using its existing approved settings. The sampler is a foreground command, not a durable monitor or scheduled task. Ctrl-C stops it without changing the frame.

Outputs:

- `run.json`: measured device/browser identity, host revision, supplied deployment label, mode and cadence. The supplied label is not independently verified by the sampler.
- `samples.csv`: UTC/elapsed time, collection status, Firefox process count and total PSS, kernel free/available memory and swap, CPU capacity share, online CPUs, process-set/main-process changes.
- Numbered JSON: raw measurement evidence and parsed process start times/counters. Main, content, GPU and crashhelper processes matching `org.mozilla.firefox` or its `:` children are included once per PID.
- `incidents.csv`: fill manually with UTC, event, visible symptom, action and recovery time. Never log credentials or private URLs.

PSS is summed across individual processes, rather than adding shared RSS repeatedly. Collection is sequential and takes several seconds; it is not an atomic snapshot. A missing `MemAvailable` remains blank: Android's kernel does not provide it on this unit. `MemFree` alone is not usable-memory headroom; review buffers/cache and swap in raw evidence. No fixed memory pass threshold is invented.

CPU capacity share is the sum of matched process user/system tick deltas divided by aggregate `/proc/stat` tick deltas, excluding duplicate guest counters. It measures a percentage of accounted CPU capacity, **not percent of one core**. Hotplug and collection skew limit comparisons; online CPUs are retained. No host `CLK_TCK` assumption or multiplication by four. CPU is blank on first sample, process churn/PID reuse or device uptime reset. Exited-process final ticks are unknown. Process changes are incident candidates, not proof of a crash or low-memory kill; investigate privately without clearing logs. The sampler does not capture logcat, screenshots, browser history or cookies.

Failures/timeouts stop collection and record an incomplete row; identity mismatch also stops. Do not automatically reconnect, force-stop or relaunch to hide a failure. Preserve the interrupted run and start a separately named run after diagnosis. Kernel/process evidence cannot prove that the page remained painted, touch stayed responsive, downloads were bounded or authorization passed; those need separate observations.

Host-only checks:

```sh
python3 -m unittest discover -s hardware/h4 -p 'test_*.py'
python3 hardware/h4/summarize.py private/h4-weather-baseline
```

The summary reports first/last/minimum/median/maximum, missing samples, process changes and maximum sampling gap. It grants no automatic acceptance. Review raw evidence and incidents before sharing even aggregate statistics.

## M4 display acceptance before the baseline

### Optional owner-run local key entry

The owner requested automated entry after reporting that physical typing is painful. A narrowly scoped helper is available on the trusted Mac while the real frame is on `/setup/`:

```sh
python3 hardware/h4/fill_setup.py
```

Run it in your own interactive terminal. Paste the replacement key at its hidden prompt and press Enter. It reads the explicit verified target from ignored `private/m4-display-checks/frame-target.txt`; it does not discover/select the first device. Identity and Firefox version must match. After the original focus check falsely rejected owner-confirmed focus, the owner explicitly requested type-only operation. First open the real setup page and select its empty key field yourself. The helper does not inspect the page/focus, tap, clear text or submit; it types into the currently selected field. Do not touch or navigate the frame during entry. Tap **Connecter** yourself afterward; the helper does not submit or claim provisioning success.

The key travels over the already trusted ADB connection through host stdin. It is not put in host argv/history, printed, saved to a file or included in command errors. No clipboard reading, browser profile/cookie extraction, installation or new permission is used. This deliberately permits transient device-side `input text` entry: Android's input process briefly receives the key in its arguments, visible to device root, which already controls the Firefox profile. This is a local trusted-maintenance convenience, not a new secure remote provisioning protocol. The longer-term proposal is short-lived pairing with admin approval. Do not shorten the persistent credential or put a key into a URL.

Eight host tests cover measurement parsers, key validation and secret transport via stdin. The previous read-only live field preflight did not establish reliable focus detection; that check has been removed at the owner’s request. Actual key entry still needs owner execution and visible setup success. If the helper stops, leave the key private and report only its generic error.

The owner authorized finishing these checks on 17 October; use the existing single administrator, deployment, home allowlist and Free services. Second-admin acceptance remains deferred. Separate gates remain for unrelated device/network changes.

1. Sign in on the Mac at `/admin/settings/`. Confirm access and save/reload the existing settings without changing household preferences; verify recovery/reload. Keep any export private.
2. Create the frame's read-only key through the admin UI. Browser access-grant confirmation applies at this action. Transfer its one-time value privately to the owner's frame; never read/print it through general page snapshots. The owner can enter it physically on `/setup/`; no admin session is transferred. The key is hidden when the admin page loses visibility. If lost, rotate and retry.
3. On the actual frame confirm setup success, `/?display=frame`, correct saved settings, catalog and a decoded protected photo. Record that the frame remains display-only: `/api/config` and `/api/display` admin reads and photo/config mutations must deny the display identity. A headerless mutation's 403 proves origin protection only; a valid-origin display mutation must also deny the role. Use the real edge checks separately from local synthetic tests.
4. Exercise a controlled Firefox process restart (no device reboot, profile clearing or data removal), then verify photos/settings still work without key entry or admin sign-in. Record main PID before/after. A tab reload, Home/return or recreated desktop browser context is not process-restart evidence. If controlled stop/relaunch is used, record the exact action and preserve the DF exit route; it is outside the read-only sampler.
5. Revoke on the Mac. Confirm new protected frame requests deny and private pixels clear on the first authorization denial, or by the five-minute in-memory lease while offline. Preserve exact acknowledgement/denial/clear times. Previously authorized responses may finish. Do not call revocation passed solely because the admin button reports success.
6. Issue a replacement, provision again and verify final working display. Check logout on a separately controlled session so the frame can be left provisioned. Test invalid credentials and anonymous reads through the real edge. Read-only role, rotation and successful restart persistence need separate evidence.
7. Test a valid display credential from a real off-home connection: deny. Test the admin off-home: allow. Cover actual allowed IPv4 and IPv6 paths; absent IPv6 connectivity is a recorded limitation, not a pass. Never spoof `CF-Connecting-IP` or temporarily widen `HOME_NETWORKS` as a substitute. The owner may use cellular for this; no router changes are implied.

Track each result as PASS / FAIL / PENDING / BLOCKED with evidence and reason. Do not mark full M4 accepted while off-home, role, settings recovery, quota/CPU review or actual-frame checks remain unresolved. Existing local tests remain valuable but do not prove edge/device behavior.

## Short baseline and paired motion trial

After M4 display acceptance, run a preliminary 60-minute weather baseline and a separate 60-minute photos baseline. Include first render, 15-minute and 1-hour observations, one weather refresh and repeated photo transitions. Start with synthetic content where possible; label separately any approved household-content check. Do not deploy M5 into the page being measured.

At first render, 15 minutes and one hour, physically check clock/date/timezone, weather/chart/icon layout, contain/cover and touch controls. Record at least ten ordinary taps with visible latency/missed-tap count; a short private video with visible timing can support the ≤1 s target. Readability at 1–3 m and the physical DF maintenance round trip require owner observation.

For motion comparison, use equivalent weather states and warmed-up tabs for at least 15 minutes each, with the same cadence. Test existing reduced-motion still variants only through a specifically agreed browser/app setting. If no safe existing control is available, mark the still trial blocked; do not inject arbitrary CSS or tune the Android system. Restore the original setting and record it. Compare medians/ranges and touch behavior; do not infer animation cost from a single CPU snapshot.

Short and ≥5-minute router-side outages follow separate approval and a recovery plan; leave Android Wi-Fi settings alone. Record clock continuity, stale weather, private-photo expiry, automatic retries and whether manual reload is needed, including cold-load limitations. A retained photo beyond its lease is a privacy failure. A load requiring manual recovery is recorded honestly for H5/H6 decisions.

Stop for persistent lockup, repeated blank/crash, heat/power instability, credential exposure or lost physical exit. Preserve evidence and review one change at a time. Do not change firmware, swap, WebView or vendor packages as remediation.

## 48-hour acceptance and M5 handoff

Preliminary results allow M5 development while evidence is collected against a fixed deployment. Schedule execution, overrides, Night and resume behavior remain M5 work. After M5 passes its software gates, pin a new deployment and run at least 172800 seconds with one-minute samples, observations at 0/15 min/1 h/24 h/48 h, weather refreshes, photo transitions, schedule boundaries, touches and approved outages. Do not combine disjoint short runs into 48-hour acceptance.

Review post-warm-up PSS/headroom/swap over time, process churn and independently observed failures. Record animation/still choice, operating limits, missing checks and recovery behavior. No sustained upward memory trend, unexplained blanks/crashes or repeated large downloads; touch remains ≤1 s for ordinary controls. If a failure changes implementation or configuration, start a new controlled run. H4 ends with measured acceptance or a precise blocker/fallback, not a desktop result. H5 fullscreen and H6 unattended recovery remain separate.

## Provenance and execution evidence — 17 October 2026

Upstream HEAD was refreshed using `git ls-remote`: `e97c50ba459c49ea8237259f69b95cd28054b628`. Reviewed `docs/devices.md` and complete `docs/dragontouch-modern10-charm.md` including the two-day GeckoView/blank-paint follow-up from the pinned local checkout, and refreshed the live Modern10 report and [#143](https://github.com/wesbos/photo-frame-dashboard/issues/143). [#147](https://github.com/wesbos/photo-frame-dashboard/pull/147) browser fetch still failed; no merged claim is made. Adopted paired motion measurements, whole-browser process accounting and painted-content observations as test ideas. The Modern10 two days are not Classic acceptance. No upstream license grant found in the pinned tree; all tooling here is independently authored, with no upstream source/assets copied.

Actual read-only identity recheck matches Classic10, documented firmware, exdroid/sun8i, Android 6.0.1/API 23, ARMv7 and Firefox 143.0.4. Two sampler validation snapshots include five Firefox processes (main, two content, GPU, crashhelper), approximately 352–360 MiB total PSS; `MemAvailable` is absent and CPU hotplug changed the online set. This validates collection mechanics only: uncontrolled page/tab state, no motion comparison, no trend, no M4 acceptance and no baseline/soak claimed. Raw evidence is ignored under `private/h4-tool-validation/`. The host revision was recorded; the supplied deployment label in that validation run was not verified and must not be used as deployment evidence.

M4 live progress in this session:

| Check                                                                                            | Result / next evidence                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Existing administrator session recovery                                                          | PASS: Access sign-in returned to protected production settings. No identity expansion.                                                                                                                                                                                                                                                                 |
| Settings save                                                                                    | PASS: saved existing values and observed “Réglages enregistrés.”; reload returned to the settings page. Final production form readback passed for the saved location, coordinates, timezone, interval, override duration, fit and daily periods.                                                                                                       |
| Anonymous IPv4 / IPv6 display configuration                                                      | PASS: actual edge requests both returned 401. This does not establish valid-credential network filtering.                                                                                                                                                                                                                                              |
| Production smoke                                                                                 | 19 route/status/cache checks passed; overall command FAILED its exact homepage build comparison. Fresh local HTML differs only in stylesheet fingerprint; public/local styles have equal byte lengths and equal token multisets but different declaration ordering. No deployment, source change or weakened assertion used to suppress this.          |
| Display key / provisioning                                                                       | PASS, owner-observed: created key, entered it physically on `/setup/`, returned to Dayframe, selected Photos and saw protected photos. Key never transferred into chat or source.                                                                                                                                                                      |
| Actual frame protected photo, role denial, restart, rotation/revocation and final reprovisioning | Protected photo PASS by owner observation. Firefox process restart PASS: PID change/absence verified and owner confirmed photos display afterward without re-entering the key. Rotation invalidation PASS by owner observation; role, standalone DELETE revocation remain pending; final replacement provisioning subsequently passed by owner report. |
| Valid display off-home denial / admin off-home access / allowed frame IPv4 and IPv6              | Admin off-home PASS: owner signed in on cellular and saw private dashboard photos. Valid display off-home denial and separately forced credentialed IPv4/IPv6 paths remain untested; no network or key changes made.                                                                                                                                   |
| Current Free metrics / quota / CPU review                                                        | Reviewed: Workers Free $0 current; Worker CPU/errors, administration-object requests/duration/SQL and photo KV usage below the displayed Free allowances. Private dashboard evidence retained.                                                                                                                                                         |

Host verification: six Python tests passed; production build passed; XO passed with the two existing photo complexity warnings; modified Markdown formatting and `git diff --check` passed. No baseline process remains running. The sampler is not a background service.

### Provisioning and Firefox restart follow-up — 17 October 2026

The owner completed production key creation and physical `/setup/` entry. Setup returned to the dashboard, then the owner selected Photos and confirmed private photos render. This establishes actual-frame allowed-home provisioning and image delivery; the address family used by Firefox is not yet identified. The owner reported that entering the 64-character hexadecimal key is painful. Record a future short-lived pairing/approval UX as a proposal; do not shorten the long-lived credential or weaken home-network/role checks to solve this.

Performed the planned Firefox-only process restart: rechecked Classic identity/firmware/browser, recorded existing Firefox processes privately, ran `am force-stop org.mozilla.firefox`, confirmed no Firefox processes remained, then issued an HTTPS VIEW intent to Dayframe explicitly in the existing Firefox package. Main PID changed and three Firefox processes were observed after launch. No browser data/profile clearing, credential rotation, frame reboot or maintenance-helper change. The immediate private screen capture shows the DF maintenance menu, so it is not proof of post-restart page/photo rendering; the owner subsequently confirmed that Photos displays private images without entering the key again, completing the restart-persistence check. Action/PID/screen evidence stays ignored under `private/m4-display-checks/`.

Rotation/revocation test is now handed to the owner: replace the key on the administrator device, preserve the replacement privately, then select another mode and return to Photos on the frame before entering the replacement. Observe whether the old credential is denied and private pixels clear. Replacement-key entry follows only after that observation. This tests invalidation by rotation; the separate DELETE revocation endpoint is not claimed tested by rotation alone.

Owner confirmed the rotation result: the old credential is denied and private photos clear after switching away/back. This is real frame/edge evidence for rotation invalidation and denial cleanup, not an inference from the admin success message. The owner is now entering the replacement privately on `/setup/`; final reprovisioning confirmation remains pending. No key value was read by the agent or included in chat, commands, logs or Git.

### Owner-run type-only entry result — 17 October 2026

The original helper rejected focus despite the owner observing focus. At the owner's explicit request it was simplified to type into an already selected, empty field, retaining hidden terminal input, exact frame/browser identity checks, hexadecimal validation and stdin transport. The owner ran the revised helper and confirmed it worked and the frame is working again. Replacement provisioning is accepted from that owner report. No actual key was supplied to the agent, stored in source or added to Git. Repository audit confirms the explicit target file is ignored under `private/` and no private files are tracked. Runtime trust remains local: the owner selects the input field, and Android's input process briefly receives the key as previously documented.

### Remaining non-disruptive checks and preliminary baseline — 17 October 2026

The owner confirmed administrator sign-in and private dashboard photos on cellular, and explicitly authorized remaining checks plus a short H4 baseline **without another key entry**. Standalone DELETE revocation is deferred; do not rotate/revoke, clear browser data, move the frame off its network or transfer its credential to another device to complete a test. Second-admin acceptance remains deferred. These are explicit remaining limits, not full M4 acceptance.

Production settings were reloaded and reread from the ordinary authenticated settings form. Values match the previous save, including the 20-second interval, contain fit, timezone/location/coordinates, inactivity duration and daily periods. No settings write occurred in this follow-up. On the actual frame, a normal browser address-bar navigation to `/api/session` returned role `display`, and `/api/config` returned `FORBIDDEN`. External Android VIEW intents returned anonymous `UNAUTHORIZED`; they do not prove display-role denial. This is consistent with the existing Strict cookie's same-site boundary ([Mozilla reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value)), but no cookie inspection was performed. A separate `/api/display` GET role result was not established (one typed navigation landed at `/api`; external/refreshed navigation remained anonymous). Do not count those as authenticated role evidence. Origin-valid mutation-role checks remain covered locally, not newly proven on the real frame; no production mutation was attempted. Protected Photos was restored and visually confirmed afterward.

Authenticated Cloudflare dashboard review: Workers Free **$0 / Current plan**. Worker metrics for the displayed last-24-hour window show 196 invocations, zero runtime/CPU-limit/memory-limit errors, CPU P50 1.43 ms / P99 6.01 ms, wall time P50 20.34 ms / P99 152 ms. Administration usage shows 86 requests, zero errors, 0.039 GB-s duration, 80 SQL rows read and 3 written; displayed storage rounds to 0 B, not proof of missing persisted state. Photo KV shows 91 reads, 13 lists, no writes/deletes in the displayed window, about 2 MB storage. These are observed low-volume snapshots, not load-test guarantees; Free limits are account-wide. No plan/service/permission/billing change.

The active Worker version from current deployment metadata is `ad24fea6-831f-4075-804a-d7c4a0d0e24c` at 100%, matching the dashboard and the upload log of [successful deployment run 39025857342](https://github.com/codyzu/dayframe/actions/runs/39025857342), revision `2888aabd41867d8437cedcc973646094ce8bf0ba`. Its own live smoke passed all 20 routes, including exact uploaded HTML. This resolves the deployed-build acceptance concern: the earlier failure compares a separate local rebuild whose CSS declarations/fingerprint differ. No strict smoke assertion was weakened and no new deployment was made. Byte-for-byte cross-build reproducibility remains a tooling follow-up, not a failed deployed-artifact smoke.

Upstream HEAD refreshed: still `e97c50ba459c49ea8237259f69b95cd28054b628`; the previously reviewed Classic/Modern10 distinction and animation/blank-paint research remain applicable. No upstream source/assets copied.

The one-hour preliminary Photos baseline started at **2026-10-17T19:22:19.304621+00:00** (Paris expected finish approximately **2026-10-17T22:22:19.304621+02:00**), with 60-second sampling. The first sample succeeded and included six Firefox processes. The actual provisioned production photo collection is used, with four observed browser tabs, visible chrome and Large frame profile; this is not a fixed synthetic benchmark, paired-motion comparison, outage trial or 48-hour acceptance. Power/room-temperature instrumentation is unavailable. A temporary host `caffeinate -i` assertion prevents idle sleep only for the sampler lifetime, without changing saved power settings. The runner saves completion/failure and a statistical summary privately, stops on collection errors and does not reconnect/restart the frame. No automatic visual/touch-health or acceptance claim follows from process samples. Current run/status and raw evidence are ignored under `private/`; no key is read, logged or changed.

### Morning review — 18 October 2026

The preliminary production Photos collector completed successfully on 17 October at 22:22:26 Paris time (exit 0): 61/61 samples OK spanning 3600.6 seconds, maximum sample gap 63.61 seconds, no observed main-PID or process-set change. Summed Firefox PSS ended lower (436786 → 423702 KiB; range 417001–437556 KiB). This supports one-hour collection/process stability, not proof of continuous painted content, touch responsiveness or absence of all visual incidents; no independent overnight observation is claimed.

One CPU capacity reading is invalid: sample 60 reports 101.846%, with 607 Firefox ticks against 596 aggregate system ticks and online CPUs changing from `0` to `0-2`. Collection skew/hotplug accounting is a candidate explanation, not a proven diagnosis. Preserve raw data and do not use the current CPU summary as a reliable load/animation comparison until the measurement is reviewed. No device fault or system tuning is inferred.

Next preliminary run: 60 minutes of weather, including a weather refresh, clock/chart/icons and physical touch/readability observations. Paired animated/still comparison remains a separate trial once CPU accounting and an approved still-mode control are available. These can run against the unchanged deployed build while M5 is developed locally. The ≥48-hour acceptance run follows a fixed deployment with M5 scheduling behavior ready. No credential re-entry is required for these measurements.
