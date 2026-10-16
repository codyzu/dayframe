# Classic 10 backup and recovery plan

**H2 PLANNED, not executed.** [H1 read-only discovery](h1-discovery.md) measured the Classic 10 storage map; exact partition starts/ranges remain in ignored private diagnostics. Whole-user-area and hardware boot-area sizes are recorded in the H1 handoff. H2 still requires separate read-capture authorization, review of that map, and an encrypted private destination. Capture examples remain unconfigured until placeholders are replaced from that unit's reviewed evidence. No Android output files, `dd of=`, remounts, filesystem freezes, reboots or recovery payloads are part of capture.

The [Modern10 report](https://github.com/wesbos/photo-frame-dashboard/blob/e97c50ba459c49ea8237259f69b95cd28054b628/docs/dragontouch-modern10-charm.md) establishes an ADB live-capture precedent, not our storage map. Our strategy independently reads the entire identified eMMC user area, including `/data`, and each accessible hardware boot area. The Rockchip `biuframe-setup.sh backup` captures a device-specific prefix and is unsuitable here. `scripts/backup-flash.py` uses Rockchip loader commands; do not run it on this Allwinner candidate.

## Preflight and storage map (PLANNED)

1. Confirm the [identity checklist](dragon-touch-classic10.md#next-session-read-only-discovery-planned), root shell and selected target. Stop on firmware/model mismatch. Use stable power and stable trusted Wi-Fi, with no APK installations or intentional use during capture. Android background writes continue: this is not an atomic snapshot.
2. Prepare a private encrypted destination **outside the repository**, with no automatic public/cloud sync. Check available space there with `df -k /ABSOLUTE/PRIVATE/DESTINATION` on the Mac. Budget at least twice the sum of all raw region sizes plus 10% for capture/readback/extractions; do not budget from compressed size or `/data` free space. A second independent private storage copy needs its own capacity.
3. Discover storage without changing it. These commands use the `FRAME_ADDR` from the identity checklist. Failures or absent utilities must be recorded; do not install BusyBox to make backup possible before backing up.

```sh
adb -s "$FRAME_ADDR" shell cat /proc/partitions
adb -s "$FRAME_ADDR" shell cat /proc/mounts
adb -s "$FRAME_ADDR" shell cat /proc/cmdline
adb -s "$FRAME_ADDR" shell ls -l /dev/block
adb -s "$FRAME_ADDR" shell 'find /dev/block -type l -exec ls -l {} \;'
adb -s "$FRAME_ADDR" shell ls -l /sys/class/block
adb -s "$FRAME_ADDR" shell 'for b in /sys/class/block/*; do echo "$b"; cat "$b/size"; cat "$b/start" 2>/dev/null; cat "$b/partition" 2>/dev/null; done'
adb -s "$FRAME_ADDR" shell 'for b in /sys/class/block/mmcblk*; do echo "$b"; cat "$b/device/type" 2>/dev/null; cat "$b/queue/logical_block_size" 2>/dev/null; cat "$b/ro" 2>/dev/null; done'
adb -s "$FRAME_ADDR" shell 'command -v blockdev; command -v dd; command -v busybox; command -v sha256sum; command -v cat'
```

`/proc/cmdline` and symlinks can expose unique data; keep raw results private. If `find` is unavailable, inspect the observed `/dev/block/platform/…` directories using `ls -l` until all by-name maps are resolved. Do not infer a missing map. Use `readlink -f /OBSERVED/BY_NAME/PATH` only if available; record every resolved target.

4. Identify the **whole internal MMC device**, distinguishing it from an SD card, loop/device-mapper node and its partitions. Linux `device/type` should identify MMC rather than SD. Correlate mount sources, partition parentage, capacities and by-name links. `mmcblk0` is not assumed to be internal. If evidence shows raw NAND (`nanda`, MTD etc.), ambiguous storage, or a different platform, stop: this eMMC runbook needs revision.
5. For each actual region, record a private table: canonical `/dev/block/...` path, `/sys/class/block/...` name, role, sectors, exact bytes, parent and start sector. Linux sysfs `size` and `start` use **512-byte sectors**, independent of `logical_block_size`; calculate bytes on the Mac using arbitrary-width Python integers. `/proc/partitions` reports KiB, useful as a cross-check, not the primary exact count. If present, independently check with `blockdev --getsize64 /OBSERVED/BLOCK/DEVICE`; record unsupported-command errors rather than guessing.
6. Enumerate hardware `mmcblkNboot0` / `boot1`, and any RPMB region. Do not confuse eMMC hardware boot regions with a partition named `boot`, or Allwinner software boot stages also named boot0/boot1 inside the user area. Do not change `force_ro`—it prevents writes, not reads. RPMB is authenticated replay-protected storage, not an ordinary raw backup target; do not read it with this recipe or claim it is captured. Document whether it exists and why it is excluded. Record accessible eMMC configuration metadata only with already available, reviewed read-only tools; no `mmc` configuration writes.
7. Inventory **all** partitions, including unknown names and gaps. User-area capture preserves bytes regardless of labels. Identify candidates for device-specific data: private/userdata, misc, env, factory, persist, key/DRM, Wi-Fi calibration, bootloader configuration; actual names are unverified. Capture partition-table/header bytes within the user image plus sysfs start/size and by-name maps. Decode partition tables offline with read-only tools; do not assume GPT/MBR or transplant Modern10 offsets. Validate every partition range stays within its parent, and explain overlapping/duplicate aliases.

Record unavailable boot regions, unreadable sectors and configuration metadata as coverage gaps. Do not call the backup complete if required regions are unresolved. A full user-area image plus readable hardware boot areas still does not copy SoC fuses, RPMB secrets, controller firmware or every eMMC configuration register.

## Binary transport preflight (PLANNED)

H1 passed a generated six-byte `exec-out` stream, not a block read. Its stock `head` help advertises only `-n`; BusyBox lists `head`/`dd`/`cat`. Verify actual options and clean independent block reads before using the examples below. The old shell can report host exit zero despite a command error, so inspect content and exact lengths.

Use `adb exec-out` (no PTY); never `adb shell -t` for binary data. Review installed host platform-tools version (`adb version`). Confirm this old adbd's transport does not mix text diagnostics into image bytes. On the actual selected user-area path, compare two small reads using existing tools, keeping stderr separate on the Mac:

```sh
# Fill only from the reviewed storage map; uppercase placeholders must not remain.
REGION='/dev/block/REPLACE_WITH_VERIFIED_USER_AREA'
adb -s "$FRAME_ADDR" exec-out "dd if=$REGION bs=512 count=8" > header-dd.bin 2> header-dd.stderr
adb -s "$FRAME_ADDR" exec-out "head -c 4096 $REGION" > header-head.bin 2> header-head.stderr
wc -c header-dd.bin header-head.bin
cmp header-dd.bin header-head.bin
```

Run from the private destination. Require exactly 4096 bytes from each and identical content; inspect stderr for errors. Some old exec transports combine remote stderr with stdout, and `dd` writes a statistics trailer. If so, reject that test output. After confirming the only normal stderr is statistics, a reviewed `dd ... 2>/dev/null` can be used for samples, with mandatory byte-count checks (errors are then hidden). If `head -c` is absent, use another independently reviewed small reader already present. Do not continue without a clean binary test. Full-region capture below uses `cat`, which produces no normal statistics and avoids the upstream stock-`dd` >2 GiB seek problem.

## Host-side streaming capture (PLANNED)

For the later session, save the following independently authored example as `capture-region.py` **in the private backup directory**, review it, and invoke it once per approved region. It spawns only a read of an allowlisted MMC block node. Python, gzip, hashing, files and manifest writes happen on the Mac. No temporary image is stored on Android. It requires an operator to verify expected size and disk space first; it cannot discover the correct disk for you.

```python
import gzip
import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

addr, region, expected_text, destination = sys.argv[1:]
if not re.fullmatch(r'/dev/block/mmcblk[0-9]+(?:boot[01])?', region):
    raise SystemExit('Refuse unreviewed block path')
expected = int(expected_text)
if expected <= 0 or expected % 512:
    raise SystemExit('Invalid exact byte count')
out = Path(destination).resolve()
partial = Path(str(out) + '.partial')
meta = Path(str(out) + '.json')
log = Path(str(out) + '.stderr')
if not out.name.endswith('.img.gz'):
    raise SystemExit('Use a new .img.gz destination')
if any(p.exists() or p.is_symlink() for p in (out, partial, meta, log)):
    raise SystemExit('Refuse existing output')
os.umask(0o077)
started = datetime.now(timezone.utc).isoformat()
raw_hash = hashlib.sha256()
count = 0
cc_tail = 0
with log.open('xb') as errors:
    proc = subprocess.Popen(
        ['adb', '-s', addr, 'exec-out', 'cat ' + region],
        stdout=subprocess.PIPE, stderr=errors,
    )
    try:
        with partial.open('xb') as file:
            with gzip.GzipFile(filename='', mode='wb', fileobj=file,
                               compresslevel=1, mtime=0) as zipped:
                while True:
                    chunk = proc.stdout.read(1024 * 1024)
                    if not chunk:
                        break
                    count += len(chunk)
                    if count > expected:
                        raise RuntimeError('Excess bytes or text contamination')
                    leading = len(chunk) - len(chunk.lstrip(b'\xcc'))
                    if cc_tail + leading >= 65536 or b'\xcc' * 65536 in chunk:
                        raise RuntimeError('Suspicious 64 KiB 0xCC run; investigate')
                    cc_tail = (cc_tail + len(chunk) if leading == len(chunk)
                               else len(chunk) - len(chunk.rstrip(b'\xcc')))
                    raw_hash.update(chunk)
                    zipped.write(chunk)
            file.flush()
            os.fsync(file.fileno())
        if proc.wait() != 0 or count != expected:
            raise RuntimeError('Reader failure or truncated region')
    finally:
        if proc.poll() is None:
            proc.kill()
        proc.wait()
        proc.stdout.close()
if log.stat().st_size:
    raise SystemExit('Review nonempty stderr; partial remains unaccepted')
verified_hash = hashlib.sha256()
verified_count = 0
with gzip.open(partial, 'rb') as saved:
    while chunk := saved.read(1024 * 1024):
        verified_count += len(chunk)
        verified_hash.update(chunk)
if verified_count != expected or verified_hash.digest() != raw_hash.digest():
    raise SystemExit('Persisted gzip readback mismatch')
compressed_hash = hashlib.sha256()
with partial.open('rb') as saved:
    while chunk := saved.read(1024 * 1024):
        compressed_hash.update(chunk)
record = {
    'region': region, 'expected_bytes': expected, 'raw_bytes': count,
    'raw_sha256': raw_hash.hexdigest(),
    'compressed_bytes': partial.stat().st_size,
    'compressed_sha256': compressed_hash.hexdigest(),
    'started_utc': started,
    'finished_utc': datetime.now(timezone.utc).isoformat(),
    'gzip_readback_verified': True, 'independent_reads_verified': False,
    'live_non_atomic_capture': True, 'restore_tested': False,
}
with meta.open('x') as manifest:
    json.dump(record, manifest, indent=2)
    manifest.write('\n')
partial.rename(out)
print('Capture/readback complete; independent verification still required')
```

Example invocation, **after** replacing placeholders; not a runnable configured command today:

```sh
python3 capture-region.py "$FRAME_ADDR" /dev/block/VERIFIED_MMC_NODE EXACT_BYTES classic10-user.img.gz
```

Repeat separately for verified hardware boot0 and boot1 with their own exact sizes and filenames. Never substitute the upstream 16 GB capacity for this advertised 32 GB frame. Preserve `.partial` on any interruption; do not rename it manually or resume by appending another gzip stream. Restart into a new destination after investigating. If reads stall, cancel, record failure and retain the partial as failed evidence. Do not reboot the frame to fix capture without a separately reviewed action. Long runs need operator supervision; this example has no automatic stall timeout.

## Verification and acceptance (PLANNED)

A capture is **captured** when transport finishes; **verified** only after all checks below and coverage review; **restore-tested** only after an independently authorized successful restore on the exact unit. These are separate manifest states.

1. Require host reader success, exact raw size and no read errors for **each** region. Too few bytes, too many bytes, suspect filler or unexplained stderr rejects the image. A uniform filler test is a sanity check, not proof of genuine data; zero/FF erased areas can be legitimate. Inspect structure and representative data as well.
2. The example hashes incoming raw bytes and compares full persisted decompression length/hash; gzip readback checks CRC/trailer. Additionally run `gzip -t classic10-user.img.gz` and `shasum -a 256 classic10-user.img.gz` on the host. Repeat per region. Never use gzip's trailer size or `gzip -l` alone for >4 GiB images: the format's size field wraps at 2^32.
3. Independently re-read both hardware boot regions in full into new host files, using `adb -s "$FRAME_ADDR" exec-out "cat $REGION" > fresh-region.bin` after setting `REGION` to each verified node. Require the recorded size and SHA-256 of the decompressed original. Do the same for static partitions identified on this unit: boot, recovery, bootloader and env where present. No partition names are presumed to exist. Keep all samples private.
4. Compare each fresh static partition with its exact slice from the saved user image, using **this unit's** sysfs start sector × 512 and size × 512. The host extraction below avoids on-device large-offset seeks. Fill the byte values from the private map:

```sh
python3 - classic10-user.img.gz START_BYTE LENGTH_BYTE saved-partition.bin <<'PY'
import gzip, sys
image, start, length, output = sys.argv[1:]
start, length = int(start), int(length)
if start < 0 or length <= 0:
    raise SystemExit('Invalid range')
with gzip.open(image, 'rb') as source, open(output, 'xb') as target:
    source.seek(start)
    remaining = length
    while remaining:
        chunk = source.read(min(1024 * 1024, remaining))
        if not chunk:
            raise SystemExit('Truncated range')
        target.write(chunk)
        remaining -= len(chunk)
PY
wc -c saved-partition.bin fresh-region.bin
shasum -a 256 saved-partition.bin fresh-region.bin
cmp saved-partition.bin fresh-region.bin
```

5. Independently read a disk-header sample and at least one file-data sample in a mapped system partition, validating length and the corresponding saved range. Stock Android `dd` had a >2 GiB seek failure upstream. Prefer direct partition-node reads; for a sample offset inside a partition, test the existing tool at that offset before trusting it. Do not install a reader before backup. Full static-partition reads can be compared instead if range reads are unreliable. Whole user-area rereads can differ because Android is live; a hash mismatch is **not** automatically corruption, nor may it be waived. Localize it offline, preserve both reads, identify exact mutable filesystem fields and repeat static samples. Unknown differences block acceptance.
6. Record filesystem consistency separately. Live `/data`, journals and even mounted system superblocks can change during capture. Matching hashes prove retained bytes, not a consistent filesystem or bootability. Inspect cloned/extracted images with read-only offline tooling if available; never repair the sole original, mount it writable or apply host filesystem repairs. A truly offline consistent capture would require a separately researched and authorized boot/recovery route.
7. Create a second private copy on separate storage; compare compressed SHA-256 and run gzip integrity/readback there. Keep manifest alongside both copies. A sole copy on the capture Mac is not sufficient for H2 acceptance.

The aggregate private manifest must include: capture date/time, operator and host OS/tool versions; model/manufacturer/board/ABI/API; exact firmware and fingerprint; raw diagnostic filenames; storage map and size derivation; coverage/exclusions including RPMB/configuration; per-region paths, raw/compressed byte counts and hashes; actual commands/exit statuses; sample ranges, independent hashes/results; live-mutation findings; second-copy checks; and recovery status. Unique identifiers may be stored privately when necessary to prevent cross-device restore; never publish the manifest. No successful backup is asserted by these templates.

## Recovery limitations and gate

**CONFIRMED:** no tested restore route exists for our Classic 10. **UPSTREAM VERIFIED:** Modern10 capture and selective comparisons, but not firmware restore. Existing root ADB can support file-level maintenance while Android still boots; it is not a rescue mechanism for a broken boot chain.

| Candidate route                                   | Evidence and requirements                                                                                                                                                                                                       | Classic 10 status                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Root Android ADB                                  | Existing access; a restore would write live storage and can destroy the running system. Need safe offline environment, exact map, verified originals and readback plan.                                                         | Access confirmed; raw restore unsafe/unproven; no restore commands proposed      |
| Stock recovery / USB ADB                          | Requires exact recovery image analysis, known non-destructive entry/exit, working USB transport and correct privileged commands. PF1007L reports concern other firmware.                                                        | UNVERIFIED; do not boot recovery speculatively                                   |
| Allwinner FEL → compatible RAM boot → eMMC access | FEL is a Boot ROM USB protocol. Needs a working OTG/device port and cable, confirmed SoC/boot mode, exact DRAM/PMIC/MMC support, and an inspected RAM payload. `sunxi-fel` addresses RAM, not a universal eMMC flasher.         | UNVERIFIED on Classic 10; no entry/payload execution authorized                  |
| SD boot / U-Boot USB mass storage                 | Related A33 PF1007L research demonstrates board-dependent RAM boot and eMMC timing failures. Requires correct pin/DRAM/storage configuration, proving the exported disk is internal eMMC, and preventing host automount writes. | UNVERIFIED; do not reuse PF1007L boot patches or SD scripts                      |
| Vendor PhoenixSuit/LiveSuit/PhoenixCard package   | Would need an authentic exact-board factory package, validated host tooling and boot entry. A raw dump is not automatically a vendor flashable package; device-specific data must survive.                                      | UNVERIFIED; no authentic Classic 10 recovery package located in reviewed sources |

Before a firmware/system change, establish a usable recovery path: verified entry and exit, safe read access to the correct storage in that environment, exact-image compatibility, a reviewed region-specific restore/readback plan and explicit authorization. A destructive restore test is not demanded merely to accept H2; without it, label recovery **unproven**. If a usable recovery path cannot be established, do not progress to firmware/system changes. Limit later experiments to separately approved app-level work with tested navigation and recorded uninstall/undo.

Boot configuration, hardware boot areas, RPMB, fuses, Wi-Fi calibration and vendor packages can have different restore requirements. Never blindly write a whole disk back or replace board-specific firmware. A verified capture reduces loss risk; it does not guarantee recovery from a bricked board, dead eMMC or power interruption.

Sources: [upstream Modern10 report](https://github.com/wesbos/photo-frame-dashboard/blob/e97c50ba459c49ea8237259f69b95cd28054b628/docs/dragontouch-modern10-charm.md), [A33 PF1007L recovery research](https://github.com/wesbos/photo-frame-dashboard/blob/e97c50ba459c49ea8237259f69b95cd28054b628/docs/pf1007l-start-here.md), [Linux-sunxi FEL](https://linux-sunxi.org/FEL), [Linux MMC boot partitions](https://www.kernel.org/doc/html/latest/driver-api/mmc/mmc-dev-parts.html), [Linux ext4 superblock](https://www.kernel.org/doc/html/latest/filesystems/ext4/super.html), [Android ADB](https://developer.android.com/tools/adb).
