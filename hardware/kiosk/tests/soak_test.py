"""Native overnight observer guards; no ADB/network calls."""
import sys
from pathlib import Path
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import soak
import faults
from faults import GuardError


class SoakTests(unittest.TestCase):
    def test_new_artifact_observation_is_exact_and_cannot_inherit_fault_permission(self):
        device = faults.Device(None)
        device.acceptance_verified = True
        device.signal_identity_verified = True
        artifact = {'package': faults.PACKAGE, 'sha256': 'a' * 64, 'version': '0.1.5', 'versionCode': 6}
        with patch.object(device, '_preflight', return_value=('baseline', 'home')) as preflight:
            self.assertEqual(device.observation_preflight(Path('candidate.apk'), artifact), ('baseline', 'home'))
            preflight.assert_called_once_with(Path('candidate.apk'), 'a' * 64, '0.1.5', 6, False)
        self.assertFalse(device.acceptance_verified)
        self.assertFalse(device.signal_identity_verified)
        with self.assertRaises(GuardError):
            device.preflight(Path('candidate.apk'), fault=True)

    def test_observation_rejects_malformed_artifact_before_device_reads(self):
        artifact = {'package': faults.PACKAGE, 'sha256': 'a' * 64, 'version': '0.1.5', 'versionCode': 6}
        for key, bad in [('package', 'another.package'), ('sha256', 'bad'), ('version', '.*'),
                         ('versionCode', True), ('versionCode', 0)]:
            with self.subTest(key=key), self.assertRaises(GuardError):
                faults.Device(None).observation_preflight(Path('candidate.apk'), dict(artifact, **{key: bad}))

    def test_default_fault_runner_retains_original_artifact_pin(self):
        device = faults.Device(None)
        with patch.object(device, '_preflight') as preflight:
            device.preflight(Path('old.apk'))
            preflight.assert_called_once_with(Path('old.apk'), faults.REVIEWED_SHA256, '0.1.3', 4, False)

    def fixture(self):
        return ({'uptime': 120, 'processes': {'1': {}}, 'pss_kib': 100},
                {'healthy': True, 'supervisor': {'pid': 2}, 'health': {'elapsedMs': 119000}})

    def test_reported_health_and_memory_accepted(self):
        sample, native = self.fixture()
        soak.validate_sample(sample, native, {'uptime': 60}, 'same', 'same', 5)

    def test_state_timestamp_is_not_mistaken_for_a_live_heartbeat(self):
        sample, native = self.fixture()
        native['health']['elapsedMs'] = 60000
        soak.validate_sample(sample, native, None, 'same', 'same', 5)
        native['health']['elapsedMs'] = 130000
        with self.assertRaises(GuardError):
            soak.validate_sample(sample, native, None, 'same', 'same', 5)

    def test_reboot_health_loss_missing_processes_and_host_delay_stop(self):
        for change in ['reboot', 'health', 'supervisor', 'memory', 'processes', 'delay', 'uptime']:
            sample, native = self.fixture()
            boot, duration = 'same', 5
            if change == 'reboot': boot = 'changed'
            if change == 'health': native['healthy'] = False
            if change == 'supervisor': native['supervisor'] = None
            if change == 'memory': sample['pss_kib'] = None
            if change == 'processes': sample['processes'] = {}
            if change == 'delay': duration = 91
            if change == 'uptime': sample['uptime'] = 60
            with self.subTest(change=change), self.assertRaises(GuardError):
                soak.validate_sample(sample, native, {'uptime': 60}, 'same', boot, duration)

    def test_native_measurement_includes_supervisor_and_excludes_firefox(self):
        fields = ['S'] + ['0'] * 21
        stat = '12 (test) ' + ' '.join(fields)
        def shell(command):
            if command == 'ps':
                return ('USER PID PPID NAME\nu0 12 1 dev.dayframe.kiosk\n'
                        'u0 13 1 dev.dayframe.kiosk:supervisor\n'
                        'u0 14 1 dev.dayframe.kiosk:tab0\nu0 15 1 org.mozilla.firefox')
            if command.startswith('cat /proc/') and command.endswith('/stat') and command != 'cat /proc/stat': return stat
            if command.startswith('dumpsys meminfo '): return ' TOTAL 100 0 0'
            return {'cat /proc/meminfo': 'MemFree: 50 kB', 'cat /proc/swaps': '',
                    'cat /proc/stat': 'cpu 1 2 3 4', 'cat /proc/uptime': '120 0',
                    'date': 'synthetic', 'cat /sys/devices/system/cpu/online': '0'}.get(command, '')
        reader = soak.Reader('synthetic', package='dev.dayframe.kiosk')
        with patch.object(reader, 'shell', side_effect=shell):
            sample = reader.sample()
        self.assertEqual(set(sample['processes']), {'12', '13', '14'})
        self.assertEqual(sample['pss_kib'], 300)


if __name__ == '__main__':
    unittest.main()
