#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Scoped H6 collector/fault runner. Live fault modes need separate human approval.

Defaults to observation. No install, launch, grant, profile/credential access, reboot,
network change or automatic remediation. All output must remain under private/.
"""
import argparse
from dataclasses import asdict, dataclass
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = 'dev.dayframe.kiosk'
REVIEWED_SHA256 = 'cf0b9b8a87e4fc4b0924db7cb2ce412aae12affb22aa1e2d72177e385f198ab3'
EXPECTED = {
    'ro.product.model': 'Classic10',
    'ro.product.board': 'exdroid',
    'ro.hardware': 'sun8i',
    'ro.build.display.id': 'Classic10_A33M187_20250910-1617_V09',
    'ro.build.version.release': '6.0.1',
    'ro.build.version.sdk': '23',
    'ro.product.cpu.abi': 'armeabi-v7a',
}
MODES = {'observe', 'main-death', 'renderer-death', 'main-stall', 'renderer-stall', 'load-stall'}


class GuardError(RuntimeError):
    pass


class AdbError(RuntimeError):
    pass


class Deadline(RuntimeError):
    pass


def require(condition, message):
    if not condition:
        raise GuardError(message)


def validate_acceptance(data):
    keys = {'apkSha256', 'physicalMaintenancePassed', 'nativeProfilePassed'}
    require(type(data) is dict and set(data) == keys, 'Unexpected staged acceptance record')
    require(data['apkSha256'] == REVIEWED_SHA256, 'Acceptance does not match the reviewed installed APK')
    for key in keys - {'apkSha256'}:
        require(data[key] is True, 'Physical/profile acceptance remains incomplete')


def native_control(xml, label):
    """Only fixed native trial controls; never a page field, URL or generic selector."""
    tree = ET.fromstring(xml[xml.index('<?xml'):])
    nodes = [n for n in tree.iter('node') if n.get('package') == PACKAGE
             and label in {n.get('text'), n.get('content-desc')}]
    require(len(nodes) == 1, 'Native maintenance control missing or ambiguous')
    match = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', nodes[0].get('bounds', ''))
    require(match is not None, 'Native control bounds unavailable')
    left, top, right, bottom = map(int, match.groups())
    require(0 <= left < right <= 1280 and 0 <= top < bottom <= 800,
            'Native control outside the verified frame surface')
    return ((left + right) // 2, (top + bottom) // 2)


@dataclass(frozen=True)
class Process:
    pid: int
    uid: int
    name: str
    started: int


def allowed_process(process):
    return (type(process.pid) is int and 1 < process.pid < 2147483648
            and type(process.uid) is int and 10000 <= process.uid < 20000
            and type(process.started) is int and process.started > 0
            and (process.name == PACKAGE
                 or re.fullmatch(re.escape(PACKAGE) + r':tab\d+', process.name) is not None))


def start_time(stat):
    fields = stat[stat.rindex(')') + 2:].split()
    require(len(fields) >= 20, 'Malformed process start-time evidence')
    return int(fields[19])


def uid_guard(uid):
    require(type(uid) is int and 10000 <= uid < 20000, 'Unsafe app UID')
    # Inspect the invoking shell, using built-ins available to this unprivileged UID.
    return (
        'users=0; caps=0\n'
        'while read -r key a b c d rest; do\n'
        ' case "$key" in\n'
        f' Uid:) [ "$a:$b:$c:$d" = "{uid}:{uid}:{uid}:{uid}" ] || exit 51; users=$((users+1));;\n'
        ' CapEff:|CapPrm:|CapInh:) case "$a" in ""|*[!0]*) exit 52;; esac; caps=$((caps+1));;\n'
        ' esac\n'
        'done < /proc/$$/status || exit 54\n'
        '[ "$users:$caps" = "1:3" ] || exit 53\n'
    )


def uid_child(uid, command):
    return f'/system/xbin/su {uid} -s /system/bin/sh -c ' + shlex.quote(uid_guard(uid) + command)


def guarded_signal(process, signal):
    """Confine signal authority to this app UID, then recheck PID/name/start before kill.

    The checks and kill are not atomic. A reused PID owned by another app/system UID
    cannot be signalled by this child even if reuse occurs after the final check.
    """
    require(allowed_process(process), 'Refusing signal outside the trial main/renderer scope')
    require(signal in {'KILL', 'STOP', 'CONT'}, 'Unsupported signal')
    pid = process.pid
    name = shlex.quote(process.name)
    command = (
        f'[ -r /proc/{pid}/stat ] || exit 44\n'
        f'actual_name=$(/system/bin/tr -d \'\\000\' < /proc/{pid}/cmdline)\n'
        f'[ "$actual_name" = {name} ] || exit 45\n'
        'actual_uid=\n'
        f'while read -r key a b c d rest; do [ "$key" != "Uid:" ] || actual_uid="$a:$b:$c:$d"; done < /proc/{pid}/status\n'
        f'[ "$actual_uid" = "{process.uid}:{process.uid}:{process.uid}:{process.uid}" ] || exit 46\n'
        f'IFS= read -r actual_stat < /proc/{pid}/stat || exit 47\n'
        'actual_tail=${actual_stat##*) }\n'
        'set -f; set -- $actual_tail\n'
        '[ "$#" -ge 20 ] || exit 47\n'
        'shift 19\n'
        f'[ "$1" = "{process.started}" ] || exit 47\n'
        f'kill -s {signal} {pid} || exit 48\n'
        'echo H6_SIGNAL_SENT'
    )
    return uid_child(process.uid, command)


class Adb:
    def __init__(self, target, output, clock=time.monotonic):
        require(bool(target) and not re.search(r'\s', target) and target.endswith(':5555'),
                'Use the exact privately recorded TCP-5555 target; no discovery or wildcard')
        self.target = target
        self.output = output
        self.clock = clock
        self.deadline = None
        self.sequence = 0

    def _run(self, command, timeout=10):
        if self.deadline is not None:
            remaining = self.deadline - self.clock()
            if remaining <= 0:
                raise Deadline('Observation deadline reached')
            timeout = min(timeout, remaining)
        self.sequence += 1
        try:
            result = subprocess.run(['adb', '-s', self.target, *command], capture_output=True,
                                    timeout=timeout, check=False)
        except subprocess.TimeoutExpired as error:
            raise AdbError('Selected ADB call timed out; no new target/reboot/recovery attempted') from error
        # Do not persist a second 140-MiB APK. All other raw output stays private.
        if command[:2] != ['exec-out', 'cat'] or not command[-1].endswith('/base.apk'):
            stem = self.output / f'command-{self.sequence:04}'
            stem.with_suffix('.stdout').write_bytes(result.stdout)
            stem.with_suffix('.stderr').write_bytes(result.stderr)
        if result.returncode or result.stderr.strip():
            raise AdbError('Selected ADB command failed; inspect private output before continuing')
        return result.stdout

    def shell(self, command, timeout=10):
        return self._run(['shell', command], timeout=timeout).decode('utf-8', errors='strict').strip()

    def read(self, path, timeout=10):
        return self._run(['exec-out', 'cat', path], timeout=timeout)

    def screenshot(self):
        return self._run(['exec-out', 'screencap', '-p'], timeout=15)


class Device:
    def __init__(self, adb):
        self.adb = adb
        self.uid = None
        self.signal_identity_verified = False
        self.acceptance_verified = False

    def accept_staged_gate(self, record):
        path = record.resolve()
        require(path.is_relative_to((ROOT / 'private').resolve()), 'Acceptance record must be private')
        validate_acceptance(json.loads(path.read_text()))
        self.acceptance_verified = True

    def preflight(self, apk, fault=False):
        require(not fault or self.acceptance_verified, 'Physical/profile acceptance record required before faults')
        return self._preflight(apk, REVIEWED_SHA256, '0.1.3', 4, fault)

    def observation_preflight(self, apk, artifact):
        """Read-only exact-artifact inspection; does not authorize any live fault."""
        require(artifact.get('package') == PACKAGE, 'Unexpected observation package')
        digest, version, code = artifact.get('sha256'), artifact.get('version'), artifact.get('versionCode')
        require(isinstance(digest, str) and re.fullmatch(r'[0-9a-f]{64}', digest), 'Invalid observation digest')
        require(isinstance(version, str) and re.fullmatch(r'\d+\.\d+\.\d+', version), 'Invalid observation version')
        require(type(code) is int and code > 0, 'Invalid observation version code')
        # A new observation cannot inherit a previous artifact's fault acceptance.
        self.acceptance_verified = False
        self.signal_identity_verified = False
        return self._preflight(apk, digest, version, code, False)

    def _preflight(self, apk, digest_expected, version, code, fault):
        require(hashlib.sha256(apk.read_bytes()).hexdigest() == digest_expected,
                'Local APK is not the separately reviewed trial artifact')
        require(self.adb.shell('id -u') == '0', 'Recorded root ADB transport changed')
        for key, expected in EXPECTED.items():
            require(self.adb.shell('getprop ' + key) == expected, 'Actual frame identity mismatch')
        fox = self.adb.shell('dumpsys package org.mozilla.firefox')
        require(re.search(r'\bversionName=143\.0\.4(?:\s|$)', fox), 'Firefox fallback version changed')
        helper = self.adb.shell('dumpsys package dev.dayframe.maintenance')
        require(re.search(r'\bversionName=0\.3\.0(?:\s|$)', helper), 'Accepted helper fallback changed')
        package = self.adb.shell('dumpsys package ' + PACKAGE)
        require(re.search(r'\bversionName=' + re.escape(version) + r'(?:\s|$)', package)
                and re.search(r'\bversionCode=' + str(code) + r'(?:\s|$)', package), 'Installed trial version mismatch')
        match = re.search(r'\buserId=(\d+)', package)
        require(match is not None and int(match[1]) >= 10000, 'Trial package UID unavailable/unsafe')
        self.uid = int(match[1])
        path = self.adb.shell('pm path ' + PACKAGE)
        match = re.fullmatch(r'package:(/data/app/[A-Za-z0-9._/-]+/base\.apk)', path)
        require(match is not None, 'Unexpected APK path/splits/system installation')
        digest = self.adb.shell('/sbin/busybox sha256sum ' + shlex.quote(match[1]), timeout=30).split()
        require(len(digest) == 2 and digest[0] == digest_expected, 'Full installed APK hash mismatch')
        home = self.adb.shell('dumpsys package preferred-xml')
        baseline = self.snapshot()
        if fault:
            require(baseline['healthy'], 'Fault requires a foreground healthy trial, not setup/maintenance')
            require(baseline['oldDfPresent'], 'Independent accepted DF fallback is not present')
            require(baseline['supervisor'] is not None, 'Separate supervisor is not live')
            require(self.adb.shell('test -f /data/data/' + PACKAGE + '/files/enabled-SUPERVISE && echo enabled')
                    == 'enabled', 'Supervision is not enabled')
        if fault:
            self.verify_signal_identity()
        return baseline, home

    def verify_signal_identity(self):
        reply = self.adb.shell(uid_child(self.uid, 'echo H6_UID_CONFIRMED'))
        require(reply == 'H6_UID_CONFIRMED', 'UID-confined signal child unavailable')
        self.signal_identity_verified = True

    def process(self, pid, name):
        require(isinstance(pid, int) and pid > 1, 'Unsafe PID')
        require(name in {PACKAGE, PACKAGE + ':supervisor'}
                or re.fullmatch(re.escape(PACKAGE) + r':tab\d+', name), 'Unexpected process name')
        raw = self.adb.shell(f'if [ -r /proc/{pid}/stat ]; then cat /proc/{pid}/stat; else echo ABSENT; fi')
        if raw == 'ABSENT':
            return None
        uid = self.adb.shell(f"/sbin/busybox awk '/^Uid:/ {{print $2}}' /proc/{pid}/status")
        require(uid.isdigit() and int(uid) == self.uid, 'Process UID changed; do not signal')
        command = self.adb.read(f'/proc/{pid}/cmdline').rstrip(b'\0').decode('utf-8')
        require(command == name, 'Process name changed; do not signal')
        return Process(pid, int(uid), command, start_time(raw))

    def processes(self):
        values = []
        lines = self.adb.shell('ps').splitlines()
        require(bool(lines), 'No process listing')
        columns = lines[0].split()
        require('PID' in columns, 'Unexpected process listing layout')
        index = columns.index('PID')
        for line in lines[1:]:
            fields = line.split()
            if len(fields) <= index or not fields[index].isdigit():
                continue
            name = fields[-1]
            if name not in {PACKAGE, PACKAGE + ':supervisor'} and not re.fullmatch(
                    re.escape(PACKAGE) + r':tab\d+', name):
                continue
            value = self.process(int(fields[index]), name)
            if value is not None:
                values.append(value)
        return values

    def snapshot(self):
        values = self.processes()
        main = [p for p in values if p.name == PACKAGE]
        require(len(main) <= 1, 'Ambiguous main process')
        supervisor = [p for p in values if p.name == PACKAGE + ':supervisor']
        require(len(supervisor) <= 1, 'Ambiguous supervisor process')
        health = None
        if main:
            raw = self.adb.shell('if [ -r /data/data/' + PACKAGE + '/files/health.json ]; then cat '
                                 '/data/data/' + PACKAGE + '/files/health.json; else echo ABSENT; fi')
            if raw != 'ABSENT':
                health = json.loads(raw)
                require(set(health) == {'pid', 'generation', 'state', 'foreground', 'maintenance', 'elapsedMs'},
                        'Unexpected health schema; no broad data capture')
        windows = self.adb.shell('dumpsys window windows')
        focus = next((x for x in windows.splitlines() if 'mCurrentFocus=' in x), '')
        foreground = PACKAGE + '/' in focus and 'KioskActivity' in focus
        healthy = bool(main and health and health['pid'] == main[0].pid
                       and health['state'] == 'HEALTHY' and health['foreground'] is True
                       and health['maintenance'] is False and foreground)
        return {'main': asdict(main[0]) if main else None,
                'supervisor': asdict(supervisor[0]) if supervisor else None,
                'renderers': [asdict(p) for p in values if ':tab' in p.name],
                'health': health, 'healthy': healthy,
                'oldDfPresent': 'Dayframe maintenance DF' in windows,
                'nativeForeground': foreground}

    def signal(self, process, signal):
        # Stop if anything changed since selection. The remote command checks again, but
        # shell checks are not atomic with kill. The kernel also confines signals to the app UID.
        require(self.acceptance_verified, 'Physical/profile acceptance not verified')
        require(self.signal_identity_verified, 'Signal identity not verified')
        require(process.uid == self.uid, 'Signal UID does not match installed package')
        current = self.process(process.pid, process.name)
        require(current == process, 'Signal target disappeared or changed identity')
        reply = self.adb.shell(guarded_signal(process, signal))
        require(reply == 'H6_SIGNAL_SENT', 'Signal dispatch was not acknowledged; stop and inspect')

    def cleanup_stop(self, process):
        current = self.process(process.pid, process.name)
        if current is None:
            return 'old process absent; no CONT sent'
        if current != process:
            return 'PID reused; no CONT sent'
        self.signal(process, 'CONT')
        return 'same stopped process continued'

    def load_menu(self, before):
        # All accessibility reads happen while the renderer is still running.
        # A stopped renderer may hang UIAutomator, so retain only the verified native
        # reload button bounds and recheck main identity/maintenance before its tap.
        def hierarchy():
            return self.adb.shell('uiautomator dump /data/local/tmp/dayframe-h6-load.xml '
                                  '&& cat /data/local/tmp/dayframe-h6-load.xml', timeout=20)
        current = self.snapshot()
        require(current['healthy'] and current['main'] == before['main']
                and current['supervisor'] == before['supervisor'], 'Load baseline changed')
        point = native_control(hierarchy(), 'Maintenance native Dayframe kiosk')
        self.adb.shell(f'input tap {point[0]} {point[1]}')
        xml = hierarchy()
        native_control(xml, 'Dayframe kiosk — maintenance')
        reload_point = native_control(xml, 'Recharger la page')
        paused = self.snapshot()
        require(paused['main'] == before['main'] and paused['supervisor'] == before['supervisor']
                and paused['nativeForeground'] and paused['health']['maintenance'] is True
                and paused['health']['generation'] == before['health']['generation'],
                'Native load menu did not pause the verified session')
        return reload_point

    def reload_from_menu(self, point, before):
        # No accessibility traversal or manual session replacement after STOP.
        raw = self.adb.shell('cat /data/data/' + PACKAGE + '/files/health.json')
        health = json.loads(raw)
        require(health['pid'] == before['main']['pid'] and health['maintenance'] is True
                and health['generation'] == before['health']['generation'], 'Reload menu changed')
        windows = self.adb.shell('dumpsys window windows')
        focus = next((x for x in windows.splitlines() if 'mCurrentFocus=' in x), '')
        require(PACKAGE + '/' in focus and 'KioskActivity' in focus, 'Reload focus changed')
        self.adb.shell(f'input tap {point[0]} {point[1]}')


def recovered(before, after, mode):
    if not after['healthy'] or not before['supervisor'] or after['supervisor'] != before['supervisor']:
        return False
    old_main, new_main = before['main'], after['main']
    main_changed = new_main is not None and new_main != old_main
    if mode == 'load-stall':
        return new_main == old_main and after['health']['generation'] > before['health']['generation']
    if mode.startswith('main-'):
        return main_changed
    return main_changed or (new_main == old_main
                            and after['health']['generation'] > before['health']['generation'])


def run_fault(device, before, mode, clock=time.monotonic, sleep=time.sleep, save=lambda x: None):
    require(mode in MODES - {'observe'}, 'Unsupported fault mode')
    require(device.acceptance_verified, 'Live faults require physical/profile acceptance for this APK')
    require(before['healthy'] and before['main'] and before['supervisor'], 'Unsafe fault baseline')
    if mode.startswith('main-'):
        target = Process(**before['main'])
    else:
        require(len(before['renderers']) == 1, 'Renderer selection is ambiguous; choose no PID automatically')
        target = Process(**before['renderers'][0])
    require(allowed_process(target), 'Fault target outside trial scope')
    reload_point = device.load_menu(before) if mode == 'load-stall' else None
    started = clock()
    samples = []
    result = {'mode': mode, 'target': asdict(target), 'automaticHealthRecovery': False,
              'paintAndPhysicalAcceptance': 'pending independent screenshot/owner review', 'samples': samples}
    if mode == 'load-stall':
        result['sameSessionLoadObserved'] = False
    stalled = mode.endswith('-stall')
    device.adb.deadline = started + 120
    try:
        # Mark the STOP attempt before dispatch: a timeout does not prove the signal was not sent.
        device.signal(target, 'STOP' if stalled else 'KILL')
        if mode == 'load-stall':
            device.reload_from_menu(reload_point, before)
        while clock() < started + 120:
            try:
                sample = device.snapshot()
                sample['hostElapsedSeconds'] = round(clock() - started, 3)
                samples.append(sample)
                if mode == 'load-stall' and sample['main'] == before['main'] and sample['health']:
                    health = sample['health']
                    if (health['generation'] == before['health']['generation']
                            and health['state'] == 'LOADING' and health['maintenance'] is False):
                        result['sameSessionLoadObserved'] = True
                result['automaticHealthRecovery'] = recovered(before, sample, mode)
                if mode == 'load-stall':
                    result['automaticHealthRecovery'] &= result['sameSessionLoadObserved']
                if result['automaticHealthRecovery']:
                    result['recoveredAfterSeconds'] = sample['hostElapsedSeconds']
                save(result)
                if result['automaticHealthRecovery']:
                    break
            except AdbError:
                # A transient read failure is not proof of terminal state or permission to launch.
                result['transientReadFailure'] = True
                save(result)
            sleep(min(2, max(0, started + 120 - clock())))
    except (Deadline, AdbError) as error:
        result['observationError'] = type(error).__name__
    finally:
        device.adb.deadline = clock() + 15
        if stalled:
            try:
                result['stopCleanup'] = device.cleanup_stop(target)
            except (GuardError, AdbError, Deadline) as error:
                result['cleanupPending'] = True
                result['cleanupError'] = type(error).__name__
                # Do not start another fault or claim a disappeared PID. Reconnect only to the
                # same target and revalidate this descriptor before any later cleanup attempt.
        device.adb.deadline = None
        save(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--target-file', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--apk', type=Path, default=ROOT / 'hardware/kiosk/build/dayframe-kiosk-0.1.3-trial-reviewed.apk')
    parser.add_argument('--acceptance-record', type=Path, help='Private physical/profile acceptance for this exact APK')
    parser.add_argument('--mode', choices=sorted(MODES), default='observe')
    parser.add_argument('--execute-approved-fault', action='store_true',
                        help='Operator guard only; not a substitute for actual owner approval')
    args = parser.parse_args()
    require(args.mode == 'observe' or args.execute_approved_fault,
            'Fault execution needs the explicit CLI guard and prior human approval')
    output = args.output.resolve()
    require(output.is_relative_to((ROOT / 'private').resolve()), 'Evidence must be under ignored private/')
    require(not output.exists(), 'Use a new output label; do not overwrite evidence')
    output.mkdir(mode=0o700, parents=True, exist_ok=False)
    adb = Adb(args.target_file.read_text().strip(), output)
    device = Device(adb)
    if args.mode != 'observe':
        require(args.acceptance_record is not None, 'Physical/profile acceptance record required')
        device.accept_staged_gate(args.acceptance_record)
    before, home = device.preflight(args.apk, fault=args.mode != 'observe')
    (output / 'before.json').write_text(json.dumps(before, indent=2))
    result = {'mode': 'observe', 'snapshot': before, 'faultExecuted': False}
    if args.mode != 'observe':
        result = run_fault(device, before, args.mode,
                           save=lambda value: (output / 'result.json').write_text(json.dumps(value, indent=2)))
    require(home == adb.shell('dumpsys package preferred-xml'), 'Home preferences changed; stop acceptance')
    try:
        png = adb.screenshot()
        require(png.startswith(b'\x89PNG\r\n\x1a\n'), 'Invalid screenshot transport')
        (output / 'after.png').write_bytes(png)
        result['screenshotCaptured'] = True
    except (AdbError, GuardError):
        result['screenshotCaptured'] = False
    (output / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in {'samples', 'snapshot', 'target'}}, indent=2))


if __name__ == '__main__':
    main()
