// Preserve the exact verified ordinary build for the existing deployment handoff.
// The separately enabled browser trial must never become the uploaded assets.
import {mkdtemp, cp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import process from 'node:process';

const temporary = await mkdtemp(path.join(tmpdir(), 'dayframe-navigation-'));
const saved = path.join(temporary, 'dist');
await cp('dist', saved, {recursive: true});
function run(args, env = process.env) {
  const result = spawnSync('pnpm', args, {stdio: 'inherit', env});
  if (result.status !== 0) {
    throw new Error(`Offline verification failed: ${args.join(' ')}`);
  }
}

try {
  run(['build'], {...process.env, DAYFRAME_OFFLINE_NAVIGATION: '1'});
  run([
    'exec',
    'playwright',
    'test',
    '--config',
    'playwright.offline.config.ts',
  ]);
} finally {
  await rm('dist', {recursive: true, force: true});
  await cp(saved, 'dist', {recursive: true});
  await rm(temporary, {recursive: true, force: true});
}
