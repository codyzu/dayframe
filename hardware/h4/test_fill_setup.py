"""Synthetic tests; no real credentials, browser input or ADB."""

import subprocess
import unittest
from unittest.mock import Mock, patch

from fill_setup import fill


class EntryTests(unittest.TestCase):
    def test_secret_sent_only_via_stdin_and_no_submit(self):
        reader = Mock(target='synthetic', adb='adb')
        token = 'a' * 64
        with patch('fill_setup.subprocess.run', return_value=subprocess.CompletedProcess([], 0, '', '')) as run:
            fill(reader, token)
            args, kwargs = run.call_args
            self.assertNotIn(token, ' '.join(args[0]))
            self.assertEqual(kwargs['input'], token + '\n')
            reader.identity.assert_called_once_with()
            reader.shell.assert_not_called()

    def test_invalid_key_never_contacts_device(self):
        reader = Mock()
        for token in ['short', 'g' * 64, 'a' * 63 + ';']:
            with self.assertRaises(RuntimeError):
                fill(reader, token)
        reader.identity.assert_not_called()


if __name__ == '__main__':
    unittest.main()
