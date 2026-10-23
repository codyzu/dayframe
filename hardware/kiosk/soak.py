#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Bounded read-only native kiosk observation. No faults, relaunch or reconnect."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import time

import faults

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'h4'))
from measure import Reader, cpu_cores

ROOT = Path(__file__).resolve().parents[2]


def utc():
    return datetime.now(timezone.utc).isoformat()


def write_json(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(path)


def validate_sample(sample, snapshot, previous, expected_boot, boot, duration):
    faults.require(boot == expected_boot, 'Device rebooted; preserve interrupted run')
    faults.require(snapshot['healthy'] and snapshot['supervisor'], 'Native health/foreground/supervision lost')
    health = snapshot['health']
    age = sample['uptime'] * 1000 - health['elapsedMs']
    # health.json records state changes, not periodic heartbeats. An unchanged
    # timestamp cannot establish UI responsiveness and must not fail a healthy idle run.
    faults.require(age >= -1000, 'Native state timestamp is ahead of device uptime')
    faults.require(bool(sample['processes']) and isinstance(sample['pss_kib'], int) and sample['pss_kib'] > 0, 'Native process memory missing')
    faults.require(duration <= 90, 'Collection delay exceeds continuity bound')
    if previous:
        faults.require(sample['uptime'] > previous['uptime'], 'Device uptime did not advance')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target-file', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--duration', type=int, default=36000)
    parser.add_argument('--interval', type=int, default=60)
    parser.add_argument('--apk', type=Path, default=ROOT / 'hardware/kiosk/build/dayframe-kiosk-0.1.3-trial-reviewed.apk')
    parser.add_argument('--artifact-json', type=Path, help='Reviewed builder manifest for read-only observation of another version; grants no fault acceptance')
    args = parser.parse_args()
    artifact = json.loads(args.artifact_json.read_text()) if args.artifact_json else None
    def preflight(device):
        if artifact is not None:
            return device.observation_preflight(args.apk, artifact)
        return device.preflight(args.apk)
    faults.require(60 <= args.duration <= 172800 and 30 <= args.interval <= 300,
                   'Use a bounded duration and a low-overhead interval')
    out = args.output.resolve()
    faults.require(out.is_relative_to((ROOT / 'private').resolve()), 'Output must remain private')
    os.umask(0o077)
    out.mkdir(parents=True, mode=0o700, exist_ok=False)
    started = time.monotonic()
    manifest = {'status': 'starting', 'startedAt': utc(), 'hostPid': os.getpid(),
                'durationSeconds': args.duration, 'intervalSeconds': args.interval,
                'package': faults.PACKAGE, 'reviewedApkSha256': artifact['sha256'] if artifact else faults.REVIEWED_SHA256,
                'hostRevision': subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip(),
                'hostDirty': bool(subprocess.check_output(['git', '-C', str(ROOT), 'status', '--porcelain'], text=True).strip()),
                'automaticRecoveryAttempted': False, 'acceptance': 'observation only',
                'scriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    write_json(out / 'run.json', manifest)
    previous = None
    count = 0
    process_changes = 0
    try:
        adb = faults.Adb(args.target_file.read_text().strip(), out)
        device = faults.Device(adb)
        before, home = preflight(device)
        faults.require(before['healthy'] and before['supervisor'], 'Native baseline not healthy')
        reader = Reader(adb.target, package=faults.PACKAGE)
        ticks = reader.clock_ticks()
        boot = adb.shell('cat /proc/sys/kernel/random/boot_id')
        flags = 'test -f /data/data/' + faults.PACKAGE + '/files/enabled-BOOT && test -f /data/data/' + faults.PACKAGE + '/files/enabled-SUPERVISE && echo enabled'
        faults.require(adb.shell(flags) == 'enabled', 'Accepted native startup/supervision changed')
        manifest.update({'status': 'running', 'deviceClockTicks': ticks, 'baseline': before,
                         'preflightCompletedAt': utc()})
        write_json(out / 'run.json', manifest)
        # Duration begins after preflight, and records real elapsed gaps rather than filling them.
        started = time.monotonic()
        deadline = started + args.duration
        pss = []
        cpu = []
        with (out / 'samples.jsonl').open('x') as stream:
            while True:
                sample_started = time.monotonic()
                for key, expected in faults.EXPECTED.items():
                    faults.require(reader.shell('getprop ' + key) == expected, 'Frame identity drift')
                snapshot = device.snapshot()
                sample = reader.sample()
                current_boot = adb.shell('cat /proc/sys/kernel/random/boot_id')
                validate_sample(sample, snapshot, previous, boot, current_boot, time.monotonic() - sample_started)
                current_ids = {(pid, process['start']) for pid, process in sample['processes'].items()}
                old_ids = {(pid, process['start']) for pid, process in previous['processes'].items()} if previous else current_ids
                changed = old_ids != current_ids
                process_changes += int(changed)
                cores = cpu_cores(previous, sample, ticks)
                row = {'index': count, 'utc': utc(), 'elapsedSeconds': round(time.monotonic() - started, 3),
                       'native': snapshot, 'measurement': sample, 'cpuCoreEquivalents': cores,
                       'processSetChanged': changed, 'collectionSeconds': round(time.monotonic() - sample_started, 3)}
                stream.write(json.dumps(row) + '\n')
                stream.flush()
                os.fsync(stream.fileno())
                count += 1
                pss.append(sample['pss_kib'])
                if cores is not None:
                    cpu.append(cores)
                previous = sample
                manifest.update({'samples': count, 'lastSampleAt': row['utc'],
                                 'lastElapsedSeconds': row['elapsedSeconds'], 'processSetChanges': process_changes,
                                 'lastPssKiB': sample['pss_kib'], 'lastHealth': snapshot['health']['state']})
                write_json(out / 'run.json', manifest)
                print(f'Native sample {count}: HEALTHY; {len(current_ids)} processes', flush=True)
                if time.monotonic() >= deadline:
                    break
                time.sleep(max(0, min(started + count * args.interval, deadline) - time.monotonic()))
                faults.require(time.monotonic() - sample_started <= args.interval + 90,
                               'Host sleep or sampling gap; preserve interrupted run')
        faults.require(home == adb.shell('dumpsys package preferred-xml'), 'Home preferences changed')
        faults.require(adb.shell(flags) == 'enabled', 'Native flags changed')
        preflight(device)
        manifest.update({'status': 'completed', 'finishedAt': utc(),
                         'pssKiB': {'first': pss[0], 'last': pss[-1], 'min': min(pss), 'max': max(pss)},
                         'cpuCoreIntervals': len(cpu),
                         'scope': 'Sampled native health/process evidence; no continuous paint/touch/thermal/outage acceptance'})
    except Exception as error:
        manifest.update({'status': 'interrupted', 'finishedAt': utc(), 'errorType': type(error).__name__,
                         'samples': count, 'scope': 'Incomplete observation; no automatic remediation'})
        # Raw errors can contain private transport names; retain only the type in the report.
        write_json(out / 'run.json', manifest)
        print('Native observation interrupted; inspect private evidence. No recovery attempted.', flush=True)
        return 1
    write_json(out / 'run.json', manifest)
    print('Native observation completed; manual evidence review required.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
