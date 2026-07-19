import { spawnSync } from 'node:child_process';

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(npx, ['expo', 'start', '-c', '--web', ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, ARK_DISABLE_WORKLETS_BUNDLE_MODE: '1' },
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
