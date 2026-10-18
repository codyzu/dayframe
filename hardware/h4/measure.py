#!/usr/bin/env python3
"""Read-only Classic 10 sampler. All evidence is private; no automatic recovery."""

import argparse
import csv
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import time


EXPECTED = {
    'ro.product.model': 'Classic10',
    'ro.build.display.id': 'Classic10_A33M187_20250910-1617_V09',
    'ro.product.board': 'exdroid',
    'ro.hardware': 'sun8i',
    'ro.build.version.release': '6.0.1',
    'ro.build.version.sdk': '23',
    'ro.product.cpu.abi': 'armeabi-v7a',
}
PACKAGE = 'org.mozilla.firefox'
ROOT = Path(__file__).resolve().parents[2]


def proc_stat(value):
    # comm (field 2) may contain spaces and parentheses. PID reuse uses starttime.
    fields = value[value.rindex(')') + 2:].split()
    return {'ticks': int(fields[11]) + int(fields[12]), 'start': int(fields[19])}


def cpu_total(value):
    # Guest times are already included in user/nice; do not count them twice.
    return sum(map(int, value.splitlines()[0].split()[1:9]))


def cpu_share(previous, current):
    if not previous or current['uptime'] <= previous['uptime']:
        return None
    if {(pid, p['start']) for pid, p in previous['processes'].items()} != {
        (pid, p['start']) for pid, p in current['processes'].items()
    }:
        return None  # A vanished process has unknown final ticks; do not undercount.
    delta = current['cpu_total'] - previous['cpu_total']
    if delta <= 0:
        return None
    ticks = 0
    for pid, process in current['processes'].items():
        before = previous['processes'].get(pid)
        if before and before['start'] == process['start']:
            ticks += max(0, process['ticks'] - before['ticks'])
    return round(100 * ticks / delta, 3)


class Reader:
    def __init__(self, target, adb='adb'):
        self.target = target
        self.adb = adb

    def shell(self, command):
        result = subprocess.run(
            [self.adb, '-s', self.target, 'shell', command],
            capture_output=True, text=True, timeout=30, check=False,
        )
        if result.returncode or result.stderr.strip():
            raise RuntimeError('ADB read failed (details withheld; check target privately)')
        return result.stdout.strip()

    def identity(self):
        observed = {key: self.shell('getprop ' + key) for key in EXPECTED}
        if observed != EXPECTED:
            raise RuntimeError('Device identity mismatch; stop and review privately')
        package = self.shell('dumpsys package ' + PACKAGE)
        match = re.search(r'\bversionName=(\S+)', package)
        if not match or match[1] != '143.0.4':
            raise RuntimeError('Firefox version mismatch; review before sampling')
        return {**observed, 'firefox': match[1]}

    def sample(self):
        raw = {name: self.shell(command) for name, command in {
            'ps': 'ps', 'meminfo': 'cat /proc/meminfo',
            'swaps': 'cat /proc/swaps', 'cpu': 'cat /proc/stat',
            'uptime': 'cat /proc/uptime', 'date': 'date',
            'online': 'cat /sys/devices/system/cpu/online',
        }.items()}
        processes = {}
        for line in raw['ps'].splitlines()[1:]:
            fields = line.split()
            if len(fields) < 3 or not (fields[-1] == PACKAGE or fields[-1].startswith(PACKAGE + ':')):
                continue
            pid = fields[1]
            if not pid.isdecimal():
                raise RuntimeError('Unexpected ps PID layout')
            # A process disappearing during collection is an incomplete sample, not zero memory.
            stat = self.shell('cat /proc/' + pid + '/stat')
            memory = self.shell('dumpsys meminfo ' + pid)
            raw['stat-' + pid] = stat
            raw['memory-' + pid] = memory
            total = re.search(r'^\s*TOTAL\s+(\d+)\b', memory, re.MULTILINE)
            if not total:
                raise RuntimeError('Missing per-process PSS; incomplete sample')
            processes[pid] = {**proc_stat(stat), 'name': fields[-1], 'pss_kib': int(total[1])}
        memory = {key: int(value) for key, value in re.findall(r'^(\w+):\s+(\d+)', raw['meminfo'], re.MULTILINE)}
        return {
            'utc': datetime.now(timezone.utc).isoformat(),
            'uptime': float(raw['uptime'].split()[0]),
            'cpu_total': cpu_total(raw['cpu']), 'online': raw['online'],
            'processes': processes, 'memory': memory,
            'pss_kib': sum(p['pss_kib'] for p in processes.values()) if processes else None,
            'raw': raw,
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target', required=True, help='Explicit privately verified ADB serial/address')
    parser.add_argument('--out', required=True, type=Path, help='New directory below repository private/')
    parser.add_argument('--deployment', required=True, help='Public deployed revision, never a credential or URL')
    parser.add_argument('--label', choices=['prelaunch', 'weather-animated', 'weather-still', 'photos', 'mixed'], required=True)
    parser.add_argument('--duration', type=int, default=3600, help='Seconds; 0 collects one sample')
    parser.add_argument('--interval', type=int, default=60, help='Seconds between sample starts (minimum 10)')
    args = parser.parse_args()
    if args.duration < 0 or args.interval < 10:
        parser.error('duration must be >=0 and interval >=10')
    out = args.out.resolve()
    if not out.is_relative_to(ROOT / 'private'):
        parser.error('evidence must remain below the ignored repository private/ directory')
    os.umask(0o077)
    out.mkdir(parents=True, exist_ok=False, mode=0o700)
    reader = Reader(args.target)
    identity = reader.identity()
    revision = subprocess.check_output(['git', '-C', str(ROOT), 'rev-parse', 'HEAD'], text=True).strip()
    (out / 'run.json').write_text(json.dumps({
        'identity': identity, 'host_revision': revision,
        'deployment': args.deployment, 'label': args.label,
        'duration_seconds': args.duration, 'interval_seconds': args.interval,
    }, indent=2) + '\n')
    (out / 'incidents.csv').write_text('utc,event,observation,action,recovered_utc\n')
    previous = None
    started = time.monotonic()
    deadline = started + args.duration
    columns = ['utc', 'elapsed_seconds', 'status', 'process_count', 'pss_kib',
               'mem_available_kib', 'mem_free_kib', 'swap_free_kib',
               'cpu_capacity_percent', 'online', 'main_pid_changed', 'process_set_changed']
    with (out / 'samples.csv').open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        index = 0
        while True:
            try:
                reader.identity()  # Stop on identity/version drift, even after reconnection.
                sample = reader.sample()
                row = {
                    'utc': sample['utc'], 'elapsed_seconds': round(time.monotonic() - started, 2),
                    'status': 'ok' if sample['processes'] else 'browser-absent',
                    'process_count': len(sample['processes']), 'pss_kib': sample['pss_kib'],
                    'mem_available_kib': sample['memory'].get('MemAvailable'),
                    'mem_free_kib': sample['memory'].get('MemFree'),
                    'swap_free_kib': sample['memory'].get('SwapFree'),
                    'cpu_capacity_percent': cpu_share(previous, sample), 'online': sample['online'],
                }
                if previous:
                    def identities(value, main=False):
                        return {(pid, p['start']) for pid, p in value['processes'].items()
                                if not main or p['name'] == PACKAGE}
                    row['main_pid_changed'] = identities(previous, True) != identities(sample, True)
                    row['process_set_changed'] = identities(previous) != identities(sample)
                (out / f'{index:05d}.json').write_text(json.dumps(sample, indent=2) + '\n')
                previous = sample
            except (RuntimeError, ValueError, subprocess.TimeoutExpired):
                writer.writerow({'utc': datetime.now(timezone.utc).isoformat(), 'status': 'incomplete'})
                stream.flush()
                raise RuntimeError('Incomplete sample; run stopped, no automatic reconnect/restart') from None
            writer.writerow(row)
            stream.flush()
            print(f"Sample {index}: {row['status']}; {row['process_count']} Firefox processes", flush=True)
            index += 1
            if time.monotonic() >= deadline:
                break
            time.sleep(max(0, min(started + index * args.interval, deadline) - time.monotonic()))


if __name__ == '__main__':
    main()
