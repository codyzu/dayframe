import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import process from 'node:process';
import {test, expect} from 'vitest';

const script = fileURLToPath(
  new URL('../scripts/verify-navigation.mjs', import.meta.url),
);

test.each([
  {release: '0', failure: '0', keepsEnabled: false},
  {release: '1', failure: '0', keepsEnabled: true},
  {release: '1', failure: '1', keepsEnabled: false},
])(
  'production handoff release=$release failure=$failure preserves only accepted assets',
  async ({release, failure, keepsEnabled}) => {
    const directory = await mkdtemp(path.join(tmpdir(), 'dayframe-handoff-'));
    try {
      await mkdir(path.join(directory, 'dist'));
      await mkdir(path.join(directory, 'bin'));
      const original = 'ordinary\0artifact';
      await writeFile(path.join(directory, 'dist/index.html'), original);
      await writeFile(
        path.join(directory, 'dist/ordinary.txt'),
        'original asset',
      );
      // Exercise the real save/restore/handoff orchestration with deterministic
      // child commands; no network, Astro build or browser is needed for this guard.
      await writeFile(
        path.join(directory, 'bin/pnpm'),
        `#!/usr/bin/env node
const fs = require('node:fs');
if (process.argv[2] === 'build') {
  fs.rmSync('dist', {recursive: true});
  fs.mkdirSync('dist');
  fs.writeFileSync('dist/index.html', 'enabled artifact');
  fs.writeFileSync('dist/enabled.txt', 'enabled asset');
} else if (process.env.DAYFRAME_HANDOFF_TEST_FAILURE === '1') {
  process.exitCode = 1;
}
`,
        {mode: 0o700},
      );
      const result = spawnSync(process.execPath, [script], {
        cwd: directory,
        env: {
          ...process.env,
          PATH: path.join(directory, 'bin') + path.delimiter + process.env.PATH,
          DAYFRAME_RELEASE_ASSETS: release,
          DAYFRAME_HANDOFF_TEST_FAILURE: failure,
        },
        encoding: 'utf8',
      });
      expect(result.status).toBe(failure === '1' ? 1 : 0);
      expect(
        await readFile(path.join(directory, 'dist/index.html'), 'utf8'),
      ).toBe(keepsEnabled ? 'enabled artifact' : original);
      const files = await readdir(path.join(directory, 'dist'));
      expect(files.toSorted()).toEqual(
        keepsEnabled
          ? ['enabled.txt', 'index.html']
          : ['index.html', 'ordinary.txt'],
      );
    } finally {
      await rm(directory, {recursive: true, force: true});
    }
  },
);
