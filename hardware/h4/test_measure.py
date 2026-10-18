"""Host-only measurement checks; never connect to a real frame."""

import unittest
from unittest.mock import patch

from measure import Reader, cpu_share, cpu_total, proc_stat
from summarize import summary


class MeasurementTests(unittest.TestCase):
    def test_summary_preserves_incomplete_and_missing_measurements(self):
        result = summary([{'status': 'incomplete'}, {'status': 'browser-absent'}])
        self.assertEqual(result['incomplete_or_absent'], 2)
        self.assertIsNone(result['pss_kib'])
        self.assertEqual(result['observed_span_seconds'], 0)

    def test_parenthesized_process_and_start_time(self):
        fields = ['S'] + ['0'] * 21
        fields[11], fields[12], fields[19] = '7', '8', '99'
        self.assertEqual(proc_stat('12 (a strange ) name) ' + ' '.join(fields)),
                         {'ticks': 15, 'start': 99})

    def test_guest_ticks_not_double_counted(self):
        self.assertEqual(cpu_total('cpu 10 20 30 40 5 6 7 8 9 10\ncpu0 1'), 126)

    def test_capacity_share_and_process_churn(self):
        before = {'uptime': 1, 'cpu_total': 100, 'processes': {'12': {'start': 3, 'ticks': 10}}}
        after = {'uptime': 2, 'cpu_total': 200, 'processes': {'12': {'start': 3, 'ticks': 35}}}
        self.assertEqual(cpu_share(before, after), 25)
        after['processes']['12']['start'] = 4
        self.assertIsNone(cpu_share(before, after))
        self.assertIsNone(cpu_share(None, after))
        after['uptime'] = 0
        self.assertIsNone(cpu_share(before, after))

    def test_reject_wrong_identity(self):
        with patch.object(Reader, 'shell', return_value='Modern10 charm'):
            with self.assertRaisesRegex(RuntimeError, 'identity mismatch'):
                Reader('synthetic').identity()

    def test_all_firefox_processes_and_missing_memavailable(self):
        fields = ['S'] + ['0'] * 21
        stat = '12 (test) ' + ' '.join(fields)
        responses = {
            'ps': 'USER PID PPID NAME\nu0 12 1 org.mozilla.firefox\nu0 13 1 org.mozilla.firefox:tab\nu0 14 1 other.app',
            'cat /proc/meminfo': 'MemFree: 100 kB\nSwapFree: 50 kB',
            'cat /proc/swaps': 'Filename Type Size Used Priority',
            'cat /proc/stat': 'cpu 1 2 3 4 5 6 7 8',
            'cat /proc/uptime': '12.5 20.0', 'date': 'synthetic',
            'cat /sys/devices/system/cpu/online': '0-2',
            'cat /proc/12/stat': stat, 'cat /proc/13/stat': stat,
            'dumpsys meminfo 12': ' TOTAL 20 10 0',
            'dumpsys meminfo 13': ' TOTAL 30 10 0',
        }
        with patch.object(Reader, 'shell', side_effect=lambda command: responses[command]):
            sample = Reader('synthetic').sample()
            self.assertEqual(sample['pss_kib'], 50)
            self.assertEqual(len(sample['processes']), 2)
            self.assertNotIn('MemAvailable', sample['memory'])
            responses['dumpsys meminfo 13'] = 'No process found'
            with self.assertRaisesRegex(RuntimeError, 'incomplete sample'):
                Reader('synthetic').sample()


if __name__ == '__main__':
    unittest.main()
