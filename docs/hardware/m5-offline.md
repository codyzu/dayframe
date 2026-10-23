# M5.O5 — Classic 10 offline integration

23 October 2026. **Kiosk 0.1.5/code 6 is installed and the enabled web release is
live. Online integration and owner short desk checks passed; full O5 acceptance
remains open.** See the dated owner observations below for the subsequent
clock-gated offline cold-power result and successful network-assisted recovery. The owner
specifically authorized installation/deployment and checks without physical
intervention, deferring outage, overnight and cold-power tests. O1–O4 retain their
recorded software acceptance; the remaining gates below are device acceptance.

## Implemented integration

Native **0.1.5/code 6** recognizes two fallback surfaces through the
existing isolated liveness extension: decoded, visible offline photos; and a
visible status/retry screen for empty, expired or unavailable storage. The fallback
publishes only fixed `loading`, `playback` and `retry` readiness labels. A bare
background, unfinished decode, missing retry UI or stopped JavaScript does not
satisfy readiness. Neither labels nor native messages contain photo IDs, private
metadata, credentials or retention timestamps. Messages keep their existing
`kind`/`ready`/`denied` shape; no native photo bridge is added.

Empty/expired fallback is a healthy retry screen, not a private-API authorization
success. The web store still clears/denies private playback on invalidation, and
live API denial still enters the native terminal authentication state. A return
to the live page revalidates access normally.

Native navigation no longer waits for Android to report a connected network:
GeckoView must be allowed to navigate to the existing HTTPS dashboard address to
find its installed service worker. Missing fallback uses the existing bounded
backoff; stalled loads, heartbeat/paint failures and replacement circuits retain
their protections. A healthy fallback does not reload merely because Wi-Fi
returns; its own validated health/reconnection policy controls the return.

The clock/profile gate, allowed top-level addresses, TLS rejection, two-finger
maintenance, independent DK, boot flags, permissions and engine remain unchanged.
In particular, `/offline.html` is still **not** an allowed native top-level URL.
The fallback is served at the dashboard URL by O4.

## Actual unit and upstream review

Read-only inspection of the existing saved ADB transport on 23 October matched
Classic10 / exdroid / sun8i, firmware
`Classic10_A33M187_20250910-1617_V09`, Android 6.0.1/API 23, ARMv7. Installed native
0.1.4 matched the previously accepted APK hash. Firefox 143.0.4 and maintenance
helper 0.3.0 remain installed; the current clock was plausible. No reconnect,
input, reload, profile/credential read, setting or network change occurred.
Private inspection evidence: `private/m5-o5-readiness-20261023/result.json`.
The candidate retains GeckoView `143.0.20251003115653` from the engine lock.

Refreshed upstream HEAD with `git ls-remote`: still
`f1e0820918c926396e0ccafb4839568825f63edc`. Re-read its root MIT `LICENSE`,
`dashboard/kiosk/README.md`, its `src/com/wesbos/homehq/MainActivity.java`
retry/load/paint handling, `docs/devices.md` and
`docs/dragontouch-modern10-charm.md`, including the GeckoView failed-load,
background-paint and wrong-clock follow-up. Refreshed current issue/PR listings
and read [#228](https://github.com/wesbos/photo-frame-dashboard/pull/228),
[#216](https://github.com/wesbos/photo-frame-dashboard/pull/216) and
[#201](https://github.com/wesbos/photo-frame-dashboard/pull/201).
Keep measured readiness separate from first paint and preserve the clock and
physical return gates. Deliberately retain Dayframe's restricted origin and
same-origin recovery rather than upstream's bundled local server, arbitrary URLs,
captive-portal navigation, accessibility repair or system changes. Independently
authored implementation; no upstream code/assets copied. Modern10 reports remain
research, not Classic 10 acceptance.

## Candidate and host evidence

Signed private APK:
`hardware/kiosk/build/dayframe-kiosk-0.1.5-offline-reviewed.apk`.
SHA-256: `9ca37ee61aba7f7c5f1d3a39dfd6b86e08dcc34db7671be8df75ab045b255873`;
147,061,355 bytes. Its companion JSON records the signer, engine and source hashes.
Installed in place under the owner's specific authorization; full installed hash,
version and code matched. The accepted 0.1.4 APK remains the native rollback
artifact. The prior owner exception for retained backup/reverification remains
recorded; the external backup was not mounted and no firmware/system change occurred.

Host checks: 37 Java policy tests; eight isolated probe tests; 24 Python
observer/fault-safety tests; strict offline Android dependency verification,
release compilation and lint (no issues), ARMv7/permission/export/engine/license
checks, ZIP alignment and API-23 v1/v2/v3 signatures passed. The Java policy test
simulates ten hours of ready heartbeats; it is not a physical overnight run.
Temporary-file cleanup had removed build-tools metadata; restored official
build-tools 36.0.0 from Google's archive after matching its published size/checksum.
No dependency lock or engine change was needed.

All 28 standalone browser checks passed across Chromium, Firefox, WebKit and
mobile WebKit, executing the packaged heartbeat against the generated document's
real DOM. This covers virtual overnight playback, expiry/invalidation, storage
absence, decoding/visibility, retry and reconnection. It does not establish
GeckoView extension isolation/injection, Android callbacks or storage persistence.
Type checks, lint (four existing complexity warnings) and all 131 web
unit/integration tests passed. All 44 navigation/update checks passed after the fixture corrections described
in the implementation plan. The exact tested enabled build `5ab0a6a7-2f8e-4394-9e48-7acbe8d015fd`
is staged under ignored `private/m5-o5-release-20261023/web`; its companion
`manifest.json` records all 38 file hashes. The ordinary `dist` was restored
byte-for-byte afterward. This initial build was subsequently deployed, then
superseded by the canonical-URL correction in the online rollout below.

The read-only observer now accepts `--apk` and a builder `--artifact-json` for
exact-artifact inspection at preflight/finalization. It verifies local and installed
hash, version and code. This does not authorize faults or change the fault runner's
0.1.3 pin; observation explicitly resets inherited fault acceptance. It still
records sampled native health/processes, not photo content, page mode or continuously
painted pixels.

## Authorized online rollout — 23 October 2026

Installed the reviewed APK before activating the web release. A preflight string
comparison stopped before transfer because persisted Android CRLF output was
normalized on readback; Home content matched after line-ending normalization.
Transfer hash, in-place install, full installed hash/version and retained native
preferences/Home/boot/supervision passed. The temporary LAN transfer server closed
and its exact temporary APK was removed. No grant, system setting, network or
credential change occurred.

The first enabled deployment exposed a production routing mismatch: Workers Static
Assets returns `307 /offline.html → /offline`, so the redirect-rejecting worker
could not install its fallback. Corrected only the installation fetch to canonical
`/offline`, retaining redirect rejection, the fallback content hash and logical
Cache Storage key `/offline.html`. The fixture now reproduces that redirect.
[Cloudflare's HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
explains the canonicalization. No native URL exception or global HTML routing change
was introduced. All 44 four-engine navigation/update checks passed again, and
expanded production smoke checks now cover the canonical fallback, worker and
version bytes with the same bounded deployment-propagation retries as route checks.

Final live web build: **`ae262aaf-c44c-4977-97df-23006ca4d373`**.
Cloudflare version: **`1ff5939e-d73d-4ba4-a85b-9b408f6e4e93`**.
Exact tested assets/manifest are staged under ignored
`private/m5-o5-release-20261023-canonical/`; rollout evidence is under
`private/m5-o5-rollout-20261023/`. The first build/deployment is historical,
not the current release. No commit/push is implied by this manual deployment.

Public production route/privacy and exact HTML/worker/fallback/version checks
passed. Fresh online Chromium and Firefox profiles loaded the correct build,
installed a controlling worker and cached exactly the public fallback. Actual
Classic online restart through Settings → independent DK returned HEALTHY in
19.38 seconds with the same supervisor. Injected normal mode navigation rendered
private Photos without key entry in the same healthy main/session. Private
screenshots/accessibility observations establish remote rendering, not physical
readability or two-finger acceptance.

The native profile contains persistent `/sw.js` registration, the matching named
fallback cache with one successful public document, and a photo IndexedDB database.
Only the public cache metadata was read; Gecko's internal worker-script namespace
is separate from the web-exposed Cache Storage namespace. Private photo/credential
databases were not read. UI reports **storage subject to eviction / progressive
synchronization**; do not claim permanent storage, eviction survival or offline
cold-start acceptance.

Production CI now selects `DAYFRAME_RELEASE_ASSETS=1` on main pushes: ordinary
browser checks still run against the disabled build first, then the exact enabled
build is retained only after the navigation checks pass. Local/PR verification
restores the ordinary build by default; failure always restores it. Three host
handoff tests cover default restoration, successful enabled release and failed
release restoration. This prevents the next push from silently handing a disabled
build to the production upload. Final `DAYFRAME_RELEASE_ASSETS=1 pnpm verify` passed types, XO (four existing
warnings), all 134 web unit/integration tests, production build, 300 ordinary
browser checks (four existing skips) and all 44 enabled navigation checks. The
retained `dist` was independently confirmed enabled with matching build metadata.
The first full run exposed an existing WebKit test's clock/decode race; the fixture
now waits for native decode completion before advancing virtual time, and the
focused case plus full rerun passed. Production photo code was unchanged.

## Device trial sequence at rollout

This list records the initial rollout gates. Subsequent owner desk and cold-power
results are recorded below; their completed observations supersede the initial
physical-maintenance and short-outage deferrals here.

1. **Rollout authorization — done.** Owner explicitly approved 0.1.5 installation,
   enabled deployment and checks without physical intervention. Exact artifacts,
   actual Classic identity, prior backup acceptance/owner exception and rollback,
   Home/boot/supervision state were rechecked. Outage, overnight and cold-power
   work remains deferred; this authorization does not include firmware changes.
2. **Native installation and online checks — done, with physical hold deferred.**
   Exact 0.1.5/code 6 installed hash, retained native preferences, Home/boot/supervision,
   fullscreen rendering and private Photos without key re-entry passed. Settings →
   independent DK → ordinary online restart passed with the same supervisor. The
   physical two-finger hold on this exact version remains untested; its code is
   unchanged and previous version-scoped acceptance is retained.
3. **Enabled deployment and initial synchronization — done within online scope.**
   Corrected live build `ae262aaf-c44c-4977-97df-23006ca4d373`; exact public assets,
   native persistent worker registration, matching public-only fallback cache and
   photo IndexedDB presence passed. Photos reported progressive synchronization
   with eviction possible; permanent storage was not granted. No photo database
   or credential bytes were read. Restart/outage retention and detailed playback
   preference/lease acceptance remain separate checks.
4. **Short outage and restart.** Block only the frame's WAN access, if the router
   supports this while preserving LAN/ADB. Verify actual Dayframe requests fail;
   Wi-Fi state alone is insufficient. Restart the kiosk with a plausible retained
   clock, and check fullscreen rotating photos, native HEALTHY, stable session and
   working maintenance. Also cover partial dashboard-script startup failure at
   the same allowed address. Do not count desktop tests as this gate.
5. **Recovery/update/storage checks.** Restore reachability, confirm live access and
   schedule, fit/interval/density and valid override lifetime. Exercise the controlled
   new-build reload on this profile, verify the loaded ID and no watchdog/reload
   loop. Record actual retention/persistence/usage and eviction limits. Empty,
   expired, quota/eviction and authorization-denial trials that require clearing or
   altering household storage/credentials need a separately agreed disposable
   fixture/profile; do not wipe the provisioned collection or change its clock to
   manufacture evidence. Host tests already cover these failure paths.
6. **Ten-hour offline Photos run.** After the short gates pass, begin with the frame
   already rendering the offline fallback. Keep WAN blocked and LAN available for
   minute-cadence private native observation. Record the block's start/end, loaded
   web build, saved-collection readiness and physical photos at both ends; inspect
   span/gaps, restarts/session changes, CPU/PSS growth and supervisor health.
   Offline fallback deliberately plays Photos during scheduled Night hours.
   Preserve interrupted evidence; do not automatically reconnect/restart a failed
   collector or add separate spans together. Restore internet in the morning and
   confirm live/private recovery. Router capability/control remains unverified.
7. **Separate cold-power trial.** An actual power loss can reset this frame's clock.
   The plausible-clock gate may correctly prevent profile opening while offline.
   A kiosk/process restart with retained time does not prove this cold-power case.
   Record what happens, and verify return after time/network recovery without
   weakening retention or TLS rules. Owner operates the specifically approved
   power cycle. No offline-power-start guarantee is claimed in advance.

For a future specifically authorized observation, after installing the exact
candidate and passing the short/physical gates:

```sh
python3 hardware/kiosk/soak.py \
  --target-file private/m4-display-checks/frame-target.txt \
  --apk hardware/kiosk/build/dayframe-kiosk-0.1.5-offline-reviewed.apk \
  --artifact-json hardware/kiosk/build/dayframe-kiosk-0.1.5-offline-reviewed.json \
  --output private/NEW_M5_OFFLINE_OBSERVATION_DIRECTORY \
  --duration 36000 --interval 60
```

No overnight observation has started. If Wi-Fi is disabled instead of WAN blocked, ADB
monitoring is lost; physical checks alone provide weaker overnight evidence.
Even with LAN monitoring, state samples do not prove every pixel stayed visible.

## Desk checks for the owner

These are future manual checks, not actions performed during the online rollout.
Allow roughly 20–30 minutes with the frame powered and initially online. Do not
combine this first session with a power cut, clock change or storage clearing.

1. **Physical maintenance.** Hold two fingers still for about 1.5 seconds. Confirm
   native maintenance opens and closes. Open Android Settings and use the independent
   DK button → **Retour au kiosk**. Check fullscreen private Photos without key entry.
2. **Short disconnect.** With saved Photos already rendering online, open Wi-Fi
   through native maintenance and disable only the frame's Wi-Fi for 5–10 minutes.
   Return through independent DK and watch several rotations. Record any freeze,
   blank screen, native retry loop or missing-photo state. This route loses host
   monitoring; a router per-frame WAN block is preferable for instrumented acceptance.
3. **Offline app restart.** While Wi-Fi remains off and the clock is still sensible,
   open Android Settings through maintenance, tap independent DK and choose
   **Redémarrer le kiosk** once. This restarts the app, not the frame. Expect the
   standalone offline slideshow at the dashboard address. If it has not recovered
   within two minutes, restore Wi-Fi and stop; do not repeatedly restart, clear
   storage, change the clock or enter a new key to make the check pass.
4. **Online return.** Re-enable Wi-Fi in Settings and return through DK. The fallback's
   **Réessayer la connexion** can expedite its normal validated recovery. Confirm
   return to the live dashboard/private Photos without a key, then check text size,
   mode controls and the next-photo button. Record the result and approximate times;
   do not count a useful empty/retry screen as successful photo playback.

Passing these checks supplies physical and short offline/restart/reconnection
observations. It does not complete measured update recovery, storage eviction/expiry,
continuous overnight playback, cold-power startup or broader M6 acceptance.
Coordinate those separately, particularly destructive storage/credential fixtures
and any cold cycle where the clock could reset.

## Owner desk observations — 23 October 2026

Owner-reported physical checks on the installed kiosk 0.1.5 and enabled release:

- Stationary two-finger maintenance and Android Settings → independent DK →
  Retour au kiosk passed; fullscreen private Photos returned without key entry.
- With the frame’s Wi-Fi disabled, photos continued rotating normally and the
  saved-photo offline notice appeared. The owner reported no playback problem;
  the elapsed outage duration was not measured.
- One app restart with Wi-Fi still disabled recovered to the standalone saved-photo
  slideshow, identified by its bottom offline notice and Réessayer la connexion
  button. Recovery time was not measured.
- After Wi-Fi was restored, returning to kiosk immediately recovered the full app
  without key entry; the offline notice disappeared. Text size, mode controls and
  the next-photo button worked. There is no rotation interval control in this UI;
  the desk checklist was corrected accordingly.

These observations close the physical maintenance and short Wi-Fi disconnect,
offline app restart and reconnect checks for this session. They are owner visual
reports, without host telemetry or a measured WAN-only outage. Weather remaining
visible during the disconnect was also observed; this alone does not verify the
45-minute stale-reading threshold. No power cut was part of this short session; the separately authorized cold-power
trial follows below. No overnight run, update recovery, storage clearing, expiry
or credential test was performed. Full O5 remains open.

## Owner offline cold-power observation — 23 October 2026

Owner explicitly authorized one offline power-cycle trial after the short desk
checks. After power restoration, the frame progressed from the Rootless launcher
prompt to the kiosk startup screen, then displayed « Attente d’une horloge plausible
avant ouverture du profil ». No offline photos appeared during the owner’s
three-minute wait, timed from the launcher prompt rather than power restoration.
This establishes clock-gated offline cold startup on this trial; it does not
establish the exact reset date/time or a measured boot duration.

After the owner re-enabled Wi-Fi in Android Settings and returned through DK, the
full app and private photos recovered in approximately 45 seconds, without any
reported key entry. The online UI displayed « Stockage soumis à éviction ·
synchronisation progressive », matching the pre-power-cycle storage limitation.
This notice does not itself establish lost photos, completed synchronization or
a new fault. No clock bypass, manual clock change or storage clearing was used.

Cold-power observation and network-assisted recovery are now recorded. Offline
photo startup after a power loss did not pass: the plausible-clock gate prevented
profile opening. Retain this limitation unless a separately reviewed solution is
implemented; do not weaken clock, retention or TLS checks to make startup pass.
Overnight playback, measured update recovery and destructive storage/expiry/
credential trials remain deferred. Full O5 acceptance remains open.

## Rollback and acceptance boundaries

Keep the accepted Firefox/helper/launcher fallback and native 0.1.4 artifact.
For a web rollback, restore network reachability and use the existing explicit
O4 retirement build/message to remove fallback caches and registration, then
navigate/reload and confirm retirement before returning to the older native APK.
An ordinary build with registration disabled does not retire an installed worker.
Never clear the entire browser profile or uninstall the app to roll back; that
would destroy provisioned access and saved photos. Any APK downgrade must use the
reviewed same-signer route under specific authorization, without clearing data.

O5 closes only with measured integration, recovery, storage and sustained offline
evidence (or explicitly accepted limitations). H4/M4/M6 security, physical/lifecycle,
performance and 48-hour deferrals remain separate; this slice adds no service,
permission, paid dependency, firmware or system change.
