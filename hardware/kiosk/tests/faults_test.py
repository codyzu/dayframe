#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Host-only safety tests. No ADB or device process is invoked. Shell fixtures use temporary host files."""
import copy
import importlib.util
from pathlib import Path
import shlex
import sys
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('h6_faults', Path(__file__).parents[1] / 'faults.py')
f = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = f
spec.loader.exec_module(f)
MAIN = f.Process(1200, 10023, f.PACKAGE, 500)
RENDERER = f.Process(1201, 10023, f.PACKAGE + ':tab15', 501)
SUPERVISOR = f.Process(1202, 10023, f.PACKAGE + ':supervisor', 502)


def snapshot():
    return {'healthy': True, 'main': f.asdict(MAIN), 'supervisor': f.asdict(SUPERVISOR),
            'renderers': [f.asdict(RENDERER)], 'health': {'generation': 2}}


class Clock:
    def __init__(self): self.time = 0
    def now(self): return self.time
    def sleep(self, seconds): self.time += seconds


class FakeDevice:
    def __init__(self, after, fail_signal=False):
        self.adb = type('Transport', (), {'deadline': None})()
        self.after = after
        self.calls = []
        self.fail_signal = fail_signal
        self.acceptance_verified = False
    def signal(self, process, signal):
        self.calls.append((process, signal))
        if self.fail_signal: raise f.AdbError('uncertain timeout')
    def snapshot(self): return copy.deepcopy(self.after)
    def cleanup_stop(self, process):
        self.calls.append((process, 'cleanup'))
        return 'same stopped process continued'


class RunnerSafety(unittest.TestCase):
    def test_native_reload_selection_refuses_web_foreign_ambiguous_or_offscreen_controls(self):
        xml = '<?xml version="1.0"?><hierarchy><node package="dev.dayframe.kiosk" text="Recharger la page" bounds="[20,30][200,80]"/></hierarchy>'
        self.assertEqual(f.native_control(xml, 'Recharger la page'), (110, 55))
        for bad in [xml.replace('dev.dayframe.kiosk', 'org.mozilla.firefox'),
                    xml.replace('[200,80]', '[2000,80]'),
                    xml.replace('</hierarchy>', '<node package="dev.dayframe.kiosk" text="Recharger la page" bounds="[20,30][200,80]"/></hierarchy>')]:
            with self.subTest(xml=bad), self.assertRaises(f.GuardError):
                f.native_control(bad, 'Recharger la page')

    def test_load_stall_needs_real_same_session_loading_before_replacement(self):
        class LoadDevice(FakeDevice):
            def load_menu(self, before):
                self.calls.append('prepare-before-stop'); return (110, 55)
            def reload_from_menu(self, point, before): self.calls.append('normal-native-reload')
        after = snapshot(); after['health']['generation'] += 1
        device = LoadDevice(after)
        result, clock = self.run_simulated(device, 'load-stall')
        self.assertFalse(result['automaticHealthRecovery'])
        self.assertFalse(result['sameSessionLoadObserved'])
        self.assertEqual(clock.time, 120)
        self.assertEqual(device.calls[:3], ['prepare-before-stop', (RENDERER, 'STOP'), 'normal-native-reload'])
        self.assertEqual(device.calls[-1], (RENDERER, 'cleanup'))
        loading = snapshot(); loading['healthy'] = False
        loading['health'].update(state='LOADING', maintenance=False)
        class ObservedLoad(LoadDevice):
            def snapshot(self):
                if not hasattr(self, 'seen'):
                    self.seen = True; return copy.deepcopy(loading)
                return copy.deepcopy(after)
        result, _ = self.run_simulated(ObservedLoad(after), 'load-stall')
        self.assertTrue(result['automaticHealthRecovery'])
        self.assertTrue(result['sameSessionLoadObserved'])
        after['main']['started'] += 1
        self.assertFalse(f.recovered(snapshot(), after, 'load-stall'))

    def test_load_preparation_failure_never_dispatches_stop(self):
        class RefusingDevice(FakeDevice):
            def load_menu(self, before): raise f.GuardError('menu unavailable')
        device = RefusingDevice(snapshot()); device.acceptance_verified = True
        with self.assertRaises(f.GuardError): f.run_fault(device, snapshot(), 'load-stall')
        self.assertEqual(device.calls, [])

    def test_reload_failure_still_cleans_up_stopped_renderer(self):
        class BrokenReload(FakeDevice):
            def load_menu(self, before): return (110, 55)
            def reload_from_menu(self, point, before): raise f.AdbError('reload uncertain')
        device = BrokenReload(snapshot())
        result, _ = self.run_simulated(device, 'load-stall')
        self.assertFalse(result['automaticHealthRecovery'])
        self.assertEqual(device.calls, [(RENDERER, 'STOP'), (RENDERER, 'cleanup')])

    def test_scope_excludes_supervisor_system_and_injected_names(self):
        for p in [SUPERVISOR, f.Process(1, 10023, f.PACKAGE, 5),
                  f.Process(10, 0, f.PACKAGE, 5), f.Process(10, 10023, 'org.mozilla.firefox', 5),
                  f.Process(10, 10023, f.PACKAGE + '; kill -9 1', 5),
                  f.Process(10, 10023, f.PACKAGE, 0)]:
            with self.subTest(process=p), self.assertRaises(f.GuardError):
                f.guarded_signal(p, 'KILL')
        self.assertTrue(f.allowed_process(MAIN))
        self.assertTrue(f.allowed_process(RENDERER))

    def test_signal_runs_only_inside_uid_child_with_capability_checks(self):
        args = shlex.split(f.guarded_signal(MAIN, 'STOP'))
        self.assertEqual(args[:5], ['/system/xbin/su', '10023', '-s', '/system/bin/sh', '-c'])
        self.assertEqual(len(args), 6)
        child = args[5]
        self.assertIn('/proc/$$/status || exit 54', child)
        self.assertIn('CapEff:|CapPrm:|CapInh:', child)
        self.assertLess(child.index('/proc/$$/status'), child.index('kill -s STOP 1200'))
        self.assertIn('actual_stat', child)
        self.assertIn('= "500"', child)
        with self.assertRaises(f.GuardError): f.guarded_signal(MAIN, 'KILL; reboot')

    def test_shell_guard_rejects_saved_root_uid_capability_or_missing_fields(self):
        good = 'Uid: 10023 10023 10023 10023\nCapEff: 0000\nCapPrm: 0000\nCapInh: 0000\n'
        cases = [(good, True), (good.replace('10023 10023 10023 10023', '10023 10023 0 10023'), False),
                 (good.replace('CapEff: 0000', 'CapEff: 0020'), False),
                 (good.replace('CapInh: 0000\n', ''), False), ('', False)]
        with tempfile.TemporaryDirectory(prefix='h6-guard-') as tmp:
            status = Path(tmp) / 'status'
            for payload, accepted in cases:
                with self.subTest(payload=payload):
                    status.write_text(payload)
                    script = f.uid_guard(10023).replace('/proc/$$/status', shlex.quote(str(status)))
                    result = subprocess.run(['/bin/sh', '-c', script + 'echo guard-passed'],
                                            capture_output=True, text=True, timeout=2)
                    self.assertEqual(result.returncode == 0 and result.stdout == 'guard-passed\n', accepted)

    def test_device_refuses_unverified_or_changed_target(self):
        transport = type('Transport', (), {'shell': lambda *args: self.fail('No shell dispatch expected')})()
        d = f.Device(transport)
        d.uid = MAIN.uid
        d.acceptance_verified = True
        d.process = lambda *args: MAIN
        with self.assertRaises(f.GuardError): d.signal(MAIN, 'KILL')
        d.signal_identity_verified = True
        d.process = lambda *args: f.Process(MAIN.pid, MAIN.uid, MAIN.name, MAIN.started + 1)
        with self.assertRaises(f.GuardError): d.signal(MAIN, 'KILL')

    def test_signal_requires_explicit_remote_acknowledgement(self):
        transport = type('Transport', (), {'shell': lambda *args: ''})()
        d = f.Device(transport)
        d.uid = MAIN.uid
        d.acceptance_verified = True
        d.signal_identity_verified = True
        d.process = lambda *args: MAIN
        with self.assertRaises(f.GuardError): d.signal(MAIN, 'KILL')
        transport.shell = lambda *args: 'H6_SIGNAL_SENT'
        d.signal(MAIN, 'KILL')  # Fake transport only: no actual process is signalled.

    def test_cleanup_never_continues_reused_pid(self):
        d = f.Device(None)
        d.process = lambda *args: f.Process(MAIN.pid, MAIN.uid, MAIN.name, MAIN.started + 1)
        self.assertEqual(d.cleanup_stop(MAIN), 'PID reused; no CONT sent')
        d.process = lambda *args: None
        self.assertEqual(d.cleanup_stop(MAIN), 'old process absent; no CONT sent')

    def test_gate_requires_current_artifact_and_all_real_acceptance_fields(self):
        good = {'apkSha256': f.REVIEWED_SHA256, 'physicalMaintenancePassed': True,
                'nativeProfilePassed': True}
        f.validate_acceptance(good)
        legacy = dict(good, maintenanceSourceUnchanged=True)
        with self.assertRaises(f.GuardError): f.validate_acceptance(legacy)
        for digest in ['5cdd8f78d63f90a83d3c6431c14fdbe0c537fb34d93204f4857b299785a1b26f',
                       'feeb0261bf5da8c30afb95e6321e41122ecacbc991a5b78744ae4fa44e2416aa']:
            with self.subTest(digest=digest), self.assertRaises(f.GuardError):
                f.validate_acceptance(dict(good, apkSha256=digest))
        for key in good:
            bad = dict(good); bad[key] = False
            with self.subTest(field=key), self.assertRaises(f.GuardError): f.validate_acceptance(bad)
        with self.assertRaises(f.GuardError): f.validate_acceptance({})

    def test_live_faults_remain_disabled(self):
        self.assertFalse(FakeDevice(snapshot()).acceptance_verified)
        with self.assertRaises(f.GuardError): f.run_fault(FakeDevice(snapshot()), snapshot(), 'main-death')

    def run_simulated(self, device, mode):
        clock = Clock()
        device.acceptance_verified = True
        result = f.run_fault(device, snapshot(), mode, clock=clock.now, sleep=clock.sleep)
        return result, clock

    def test_timeout_is_bounded_and_stall_always_cleaned_up(self):
        d = FakeDevice(snapshot())
        result, clock = self.run_simulated(d, 'main-stall')
        self.assertFalse(result['automaticHealthRecovery'])
        self.assertEqual(clock.time, 120)
        self.assertEqual(d.calls, [(MAIN, 'STOP'), (MAIN, 'cleanup')])
        self.assertIsNone(d.adb.deadline)

    def test_uncertain_stop_dispatch_still_attempts_cleanup(self):
        d = FakeDevice(snapshot(), fail_signal=True)
        result, _ = self.run_simulated(d, 'renderer-stall')
        self.assertFalse(result['automaticHealthRecovery'])
        self.assertEqual(d.calls, [(RENDERER, 'STOP'), (RENDERER, 'cleanup')])

    def test_ambiguous_renderer_causes_no_dispatch(self):
        before = snapshot()
        before['renderers'].append(f.asdict(f.Process(1300, 10023, f.PACKAGE + ':tab14', 555)))
        d = FakeDevice(before)
        d.acceptance_verified = True
        with self.assertRaises(f.GuardError):
            f.run_fault(d, before, 'renderer-death')
        self.assertEqual(d.calls, [])

    def test_recovery_needs_new_identity_and_preserved_supervisor(self):
        before = snapshot()
        self.assertFalse(f.recovered(before, snapshot(), 'main-death'))
        after = snapshot(); after['health']['generation'] += 1
        self.assertTrue(f.recovered(before, after, 'renderer-death'))
        self.assertFalse(f.recovered(before, after, 'main-death'))
        after['main']['started'] += 1
        self.assertTrue(f.recovered(before, after, 'main-death'))
        after['supervisor']['started'] += 1
        self.assertFalse(f.recovered(before, after, 'main-death'))
        after['healthy'] = False
        self.assertFalse(f.recovered(before, after, 'renderer-death'))

    def test_health_recovery_still_requires_separate_paint_acceptance(self):
        after = snapshot(); after['health']['generation'] += 1
        result, _ = self.run_simulated(FakeDevice(after), 'renderer-death')
        self.assertTrue(result['automaticHealthRecovery'])
        self.assertEqual(result['paintAndPhysicalAcceptance'], 'pending independent screenshot/owner review')


if __name__ == '__main__': unittest.main()
