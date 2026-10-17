#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Build only. Never downloads tools, connects to ADB, or installs an APK."""
import argparse
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def build():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--android-jar', type=Path, required=True)
    parser.add_argument('--build-tools', type=Path, required=True)
    parser.add_argument('--keystore', type=Path, required=True)
    parser.add_argument('--password-file', type=Path, required=True)
    parser.add_argument('--alias', default='dayframe-h31-trial')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    source = Path(__file__).resolve().parent
    jar = args.android_jar.resolve(strict=True)
    tools = args.build_tools.resolve(strict=True)
    key = args.keystore.resolve(strict=True)
    password = args.password_file.resolve(strict=True)
    output = args.output.resolve()
    if output.exists():
        parser.error('Output already exists; choose a new artifact path.')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='dayframe-h31-') as directory:
        work = Path(directory)
        classes = work / 'classes'
        dex = work / 'dex'
        classes.mkdir()
        dex.mkdir()
        run('javac', '-source', '8', '-target', '8', '-bootclasspath', str(jar) + os.pathsep + str(tools / 'core-lambda-stubs.jar'),
            '-encoding', 'UTF-8', '-Xlint:all', '-d', classes,
            *sorted((source / 'src').rglob('*.java')))
        run('java', '-cp', tools / 'lib/d8.jar', 'com.android.tools.r8.D8', '--min-api', '23', '--lib', jar, '--output', dex,
            *sorted(classes.rglob('*.class')))
        unsigned = work / 'unsigned.apk'
        run(tools / 'aapt', 'package', '-f', '-M', source / 'AndroidManifest.xml',
            '-I', jar, '-F', unsigned)
        with zipfile.ZipFile(unsigned, 'a', zipfile.ZIP_DEFLATED) as apk:
            for path in sorted(dex.glob('*.dex')):
                apk.write(path, path.name)
        aligned = work / 'aligned.apk'
        signed = work / 'signed.apk'
        run(tools / 'zipalign', '-f', '4', unsigned, aligned)
        run('java', '-jar', tools / 'lib/apksigner.jar', 'sign', '--ks', key, '--ks-key-alias', args.alias,
            '--ks-pass', 'file:' + str(password),
            '--min-sdk-version', '23', '--out', signed, aligned)
        run('java', '-jar', tools / 'lib/apksigner.jar', 'verify', '--verbose', '--print-certs',
            '--min-sdk-version', '23', signed)
        run(tools / 'zipalign', '-c', '4', signed)
        run(tools / 'aapt', 'dump', 'badging', signed)
        with zipfile.ZipFile(signed) as apk:
            assert apk.testzip() is None
            assert 'classes.dex' in apk.namelist()
            assert not any(name.startswith('lib/') for name in apk.namelist())
        shutil.copyfile(signed, output)
        print('APK SHA-256:', hashlib.sha256(output.read_bytes()).hexdigest())
        print('APK bytes:', output.stat().st_size)
        print('Saved:', output)


if __name__ == '__main__':
    build()
