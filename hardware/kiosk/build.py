#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Offline host build/verification/signing only. Never installs APKs or invokes ADB."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile

ENGINE_SHA256 = 'aa01a684fa13344b56df89fb3b3042b8234d6f11a69f5af144d129598e3bfae1'
PACKAGE = 'dev.dayframe.kiosk'


def run(*args, env=None, capture=False):
    result = subprocess.run([str(x) for x in args], check=True, env=env,
                            text=True, capture_output=capture)
    return result.stdout if capture else None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ['gradle', 'java-home', 'sdk', 'gradle-user-home', 'keystore', 'password-file', 'output']:
        parser.add_argument('--' + name, type=Path, required=True)
    parser.add_argument('--alias', default='dayframe-h31-trial')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    output = args.output.resolve()
    if output.exists() or output.with_suffix('.json').exists():
        parser.error('Output already exists; choose a fresh artifact path.')
    java = args.java_home.resolve(strict=True) / 'bin/java'
    assert 'JAVA_VERSION="21.' in (java.parent.parent / 'release').read_text(), 'Use JDK 21'
    sdk = args.sdk.resolve(strict=True)
    tools = sdk / 'build-tools/36.0.0'
    env = os.environ.copy()
    env['JAVA_HOME'] = str(java.parent.parent)
    env['GRADLE_USER_HOME'] = str(args.gradle_user_home.resolve())
    env['PATH'] = str(java.parent) + os.pathsep + env.get('PATH', '')
    assert 'Gradle 8.11.1' in run(args.gradle.resolve(strict=True), '--version', env=env, capture=True)
    sdk_value = str(sdk).replace('\\', '\\\\').replace(':', '\\:').replace(' ', '\\ ')
    (root / 'local.properties').write_text('sdk.dir=' + sdk_value + '\n')
    run('node', '--test', root / 'tests/heartbeat.test.mjs', env=env)
    run(args.gradle.resolve(), '-p', root, '--offline', '--dependency-verification', 'strict',
        ':app:testReleaseUnitTest', ':app:assembleRelease', ':app:lintRelease', ':app:runtimeInventory', env=env)
    inventory = json.loads((root / 'app/build/reports/runtime-artifacts.json').read_text())
    engine = [x for x in inventory if x['coordinate'] == 'org.mozilla.geckoview:geckoview:143.0.20251003115653']
    assert len(engine) == 1 and engine[0]['sha256'] == ENGINE_SHA256, 'Engine artifact drift'
    manifest = ET.parse(root / 'app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml')
    ns = '{http://schemas.android.com/apk/res/android}'
    app = manifest.find('application')
    assert app.get(ns + 'allowBackup') == 'false'
    assert app.get(ns + 'usesCleartextTraffic') == 'false'
    assert app.get(ns + 'debuggable') != 'true'
    exported = {x.get(ns + 'name') for x in app if x.get(ns + 'exported') == 'true'}
    assert exported == {PACKAGE + '.KioskActivity', PACKAGE + '.BootReceiver'}, exported
    unsigned = root / 'app/build/outputs/apk/release/app-release-unsigned.apk'
    with zipfile.ZipFile(unsigned) as apk:
        assert apk.testzip() is None
        assert {x.split('/')[1] for x in apk.namelist() if x.startswith('lib/')} == {'armeabi-v7a'}
        for asset in ['heartbeat/manifest.json', 'heartbeat/heartbeat.js', 'licenses.txt', 'licenses/MIT.txt',
                      'licenses/MPL-2.0.txt', 'licenses/Apache-2.0.txt', 'licenses/runtime-artifacts.json']:
            assert 'assets/' + asset in apk.namelist(), asset
    badging = run(tools / 'aapt', 'dump', 'badging', unsigned, env=env, capture=True)
    assert "package: name='" + PACKAGE + "'" in badging
    assert "sdkVersion:'23'" in badging and "targetSdkVersion:'23'" in badging
    permissions = set(re.findall(r"uses-permission: name='([^']+)'", badging))
    assert permissions == {'android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.WAKE_LOCK', PACKAGE + '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'}, permissions
    with tempfile.TemporaryDirectory(prefix='dayframe-h6-sign-') as directory:
        signed = Path(directory) / 'signed.apk'
        run(java, '-jar', tools / 'lib/apksigner.jar', 'sign', '--ks', args.keystore.resolve(strict=True),
            '--ks-key-alias', args.alias, '--ks-pass', 'file:' + str(args.password_file.resolve(strict=True)),
            '--min-sdk-version', '23', '--out', signed, unsigned, env=env)
        signature = run(java, '-jar', tools / 'lib/apksigner.jar', 'verify', '--verbose', '--print-certs',
                        '--min-sdk-version', '23', signed, env=env, capture=True)
        for scheme in ['v1', 'v2', 'v3']:
            assert re.search(r'Verified using ' + scheme + r' scheme.*: true', signature), signature
        run(tools / 'zipalign', '-c', '4', signed, env=env)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(signed, output)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    version = re.search(r"versionName='([^']+)'", badging)[1]
    version_code = int(re.search(r"versionCode='(\d+)'", badging)[1])
    result = {'package': PACKAGE, 'version': version, 'versionCode': version_code, 'sha256': digest, 'bytes': output.stat().st_size,
              'engineSha256': ENGINE_SHA256, 'signatureVerification': signature.splitlines(),
              'deviceAcceptance': 'Not installed or verified on the frame',
              'sourceHashes': {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted((root / 'app/src').rglob('*')) if p.is_file()}}
    output.with_suffix('.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: result[k] for k in ['package', 'version', 'sha256', 'bytes', 'deviceAcceptance']}, indent=2))


if __name__ == '__main__':
    main()
