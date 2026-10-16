import process from 'node:process';
import {spawnSync} from 'node:child_process';

// The Wrangler config cannot select or enforce an account's billing plan.
// A human must verify the account first; CI uses a protected environment variable.
if (process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED !== 'true') {
  console.error(
    'Deployment stopped: verify Workers Free in the target account, then set CLOUDFLARE_FREE_PLAN_CONFIRMED=true. See docs/operations.md.',
  );
  process.exit(1);
}

for (const args of [
  ['verify'],
  ['exec', 'wrangler', 'deploy', '--env', 'production'],
]) {
  const result = spawnSync('pnpm', args, {
    stdio: 'inherit',
    env: {...process.env, WRANGLER_SEND_METRICS: 'false'},
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
