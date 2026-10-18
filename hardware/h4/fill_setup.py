#!/usr/bin/env python3
"""Owner-run local key entry. Paste at a hidden prompt; tap Connecter yourself."""

import getpass
import re
import subprocess
import sys

from measure import Reader, ROOT

def fill(reader, token):
    if not re.fullmatch('[0-9a-f]{64}', token):
        raise RuntimeError('Expected exactly 64 lowercase hexadecimal characters')
    reader.identity()
    # Host argv/history never contain the secret. Feed an existing noninteractive
    # device shell over stdin; do not echo, save or include it in errors.
    command = ('IFS= read -r DF_KEY; '
               '[ "${#DF_KEY}" -eq 64 ] || exit 2; '
               'case "$DF_KEY" in *[!0-9a-f]*) exit 2;; esac; '
               'input text "$DF_KEY"; DF_RESULT=$?; unset DF_KEY; exit "$DF_RESULT"')
    result = subprocess.run([reader.adb, '-s', reader.target, 'shell', command],
                            input=token + '\n', capture_output=True, text=True, timeout=30)
    if result.returncode or result.stdout.strip() or result.stderr.strip():
        raise RuntimeError('Entry command did not complete cleanly; details withheld')


def main():
    if not sys.stdin.isatty():
        raise RuntimeError('Run in your own interactive terminal; never pass a key as an argument')
    target_file = ROOT / 'private/m4-display-checks/frame-target.txt'
    target = target_file.read_text().strip()
    if not target or '\n' in target:
        raise RuntimeError('Missing privately verified frame target')
    print('On the frame, select the EMPTY setup key field first. This helper only types; it does not focus or clear fields.')
    token = getpass.getpass('Paste replacement key here (hidden), then press Enter: ')
    try:
        fill(Reader(target), token)
    finally:
        token = ''
    print('Key typed into the selected field. Tap Connecter on the frame yourself.')


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as error:
        # Never include captured device output, stdin or command arguments.
        print('Stopped safely: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__), file=sys.stderr)
        sys.exit(1)
