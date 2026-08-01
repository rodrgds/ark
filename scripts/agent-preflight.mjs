#!/usr/bin/env node
import { existsSync, readFileSync, statfsSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const nativeMode = args.has('--native') || args.has('--release');
const releaseMode = args.has('--release');
const packageConfig = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));

process.chdir(repoRoot);

console.log('Ark agent preflight');
printGitState();
printToolchain();

if (nativeMode) {
  printNativeState();
}

if (releaseMode) {
  printReleaseState();
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error?.code === 'ENOENT') return null;

  return {
    status: result.status,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
  };
}

function printGitState() {
  const status = run('git', ['status', '--short', '--branch']);
  if (!status || status.status !== 0) {
    console.log('Git: unavailable');
    return;
  }

  const [branchLine = 'unknown branch', ...changes] = status.stdout.split('\n');
  const branch = branchLine.replace(/^##\s*/, '');
  const upstream = run('git', ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  const divergence =
    upstream?.status === 0
      ? run('git', ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
      : null;
  const [ahead = '0', behind = '0'] = divergence?.stdout.split(/\s+/) ?? [];
  const diffCheck = run('git', ['diff', '--check']);

  console.log(
    `Git: ${branch}; ${changes.length === 0 ? 'clean' : `${changes.length} changed path(s)`}`
  );
  console.log(
    `Upstream: ${upstream?.status === 0 ? upstream.stdout : 'none'}; ahead ${ahead}, behind ${behind}`
  );
  console.log(`Diff check: ${diffCheck?.status === 0 ? 'clean' : 'whitespace errors present'}`);
}

function printToolchain() {
  console.log(
    `Toolchain: ${packageConfig.packageManager}; Expo ${packageConfig.dependencies.expo}; React Native ${packageConfig.dependencies['react-native']}; Uniwind ${packageConfig.dependencies.uniwind}`
  );
}

function printNativeState() {
  const fsStats = statfsSync(repoRoot);
  const freeBytes = Number(fsStats.bavail) * Number(fsStats.bsize);
  const totalBytes = Number(fsStats.blocks) * Number(fsStats.bsize);
  const freePercent = totalBytes > 0 ? Math.round((freeBytes / totalBytes) * 100) : 0;

  console.log(`Disk: ${formatBytes(freeBytes)} free (${freePercent}%)`);
  if (freeBytes < 8 * 1024 ** 3) {
    console.log('WARNING: less than 8 GiB free; do not start an Android native build.');
  } else if (freeBytes < 20 * 1024 ** 3) {
    console.log('WARNING: native build headroom is low; inspect disposable build caches first.');
  }

  const cachePaths = ['android/app/.cxx', 'android/app/build', 'android/.gradle', 'ios/build'];
  const cacheSizes = cachePaths
    .filter((relativePath) => existsSync(resolve(repoRoot, relativePath)))
    .map((relativePath) => `${relativePath} ${directorySize(relativePath)}`);
  console.log(`Native caches: ${cacheSizes.length > 0 ? cacheSizes.join('; ') : 'none'}`);

  const adb = run('adb', ['devices', '-l']);
  if (!adb) {
    console.log('Android devices: adb unavailable');
  } else {
    const devices = adb.stdout
      .split('\n')
      .filter((line) => line && !line.startsWith('List of devices attached'));
    console.log(`Android devices: ${devices.length > 0 ? devices.join('; ') : 'none attached'}`);
  }

  if (process.platform === 'darwin') {
    const simctl = run('xcrun', ['simctl', 'list', 'devices', 'booted', '--json']);
    if (!simctl) {
      console.log('iOS simulators: xcrun unavailable');
    } else if (simctl.status !== 0) {
      console.log('iOS simulators: unavailable');
    } else {
      const payload = JSON.parse(simctl.stdout);
      const booted = Object.values(payload.devices ?? {})
        .flat()
        .filter((device) => device.state === 'Booted')
        .map((device) => device.name);
      console.log(`iOS simulators: ${booted.length > 0 ? booted.join(', ') : 'none booted'}`);
    }
  }

  console.log(
    'Native source: app.json, plugins/, modules/, and patches/; generated projects are proof.'
  );
}

function printReleaseState() {
  printArtifact(
    'Release APK',
    'android/app/build/outputs/apk/standard/release/app-standard-universal-release.apk'
  );
  printArtifact('Dev APK', 'android/app/build/outputs/apk/standard/debug/app-standard-debug.apk');
  console.log('Release gate: run bun run verify before build, then use bun run build-send.');
}

function printArtifact(label, relativePath) {
  const absolutePath = resolve(repoRoot, relativePath);
  if (!existsSync(absolutePath)) {
    console.log(`${label}: missing`);
    return;
  }

  const stats = statSync(absolutePath);
  console.log(
    `${label}: ${relativePath}; ${formatBytes(stats.size)}; modified ${stats.mtime.toISOString()}`
  );
}

function directorySize(relativePath) {
  const result = run('du', ['-sk', resolve(repoRoot, relativePath)]);
  if (!result || result.status !== 0) return 'unknown';
  const kibibytes = Number(result.stdout.split(/\s+/)[0]);
  return formatBytes(kibibytes * 1024);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}
