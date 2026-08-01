#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statfsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const CHAT_ID = '!Hf5OYEW7nA8jd9xaPncq:beeper.local';
const APK_MIME = 'application/vnd.android.package-archive';
// The fdroid universal APK is ~195 MB; the beeper upload needs more headroom
// than the ~35 MB standard APK.
const SEND_TIMEOUT_MS = 20 * 60 * 1000;
const MIN_FREE_BUILD_BYTES = 8 * 1024 ** 3;
const WARN_FREE_BUILD_BYTES = 20 * 1024 ** 3;
const VARIANTS = {
  release: {
    buildScript: 'android:build:prod',
    apkPath: resolve(
      'android/app/build/outputs/apk/standard/release/app-standard-universal-release.apk'
    ),
    label: 'release',
  },
  dev: {
    buildScript: 'android:build:dev',
    apkPath: resolve('android/app/build/outputs/apk/standard/debug/app-standard-debug.apk'),
    label: 'dev',
  },
  fdroid: {
    buildScript: 'android:build:fdroid',
    apkPath: resolve('android/app/build/outputs/apk/fdroid/release/app-fdroid-release.apk'),
    label: 'fdroid',
  },
};

function selectVariant() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--fdroid')) return VARIANTS.fdroid;
  if (args.has('--dev') || args.has('--debug')) return VARIANTS.dev;
  return VARIANTS.release;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: false,
    ...options,
  });

  if (options.capture) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  return result;
}

function assertSuccess(result, label) {
  if (result.status === 0) return;
  const signal = result.signal ? ` signal ${result.signal}` : '';
  throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}${signal}.`);
}

function sha256(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolveHash(hash.digest('hex')));
  });
}

function beeperNeedsSetup(result) {
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return /unauth|not authenticated|not logged in|setup|login/i.test(output);
}

function checkBuildSpace() {
  const stats = statfsSync(process.cwd());
  const freeBytes = Number(stats.bavail) * Number(stats.bsize);
  const freeGiB = (freeBytes / 1024 ** 3).toFixed(1);

  if (freeBytes < MIN_FREE_BUILD_BYTES) {
    throw new Error(
      `Only ${freeGiB} GiB is free. Ark native builds can exhaust Android .cxx and Gradle storage; free at least 8 GiB before building.`
    );
  }

  if (freeBytes < WARN_FREE_BUILD_BYTES) {
    console.warn(
      `Warning: only ${freeGiB} GiB is free. Run bun run agent:preflight:native and inspect disposable native caches if the build fails.`
    );
  }
}

function sendWithBeeper(apkPath, caption) {
  return run(
    'beeper',
    [
      'send',
      'file',
      '--to',
      CHAT_ID,
      '--file',
      apkPath,
      '--mime',
      APK_MIME,
      '--caption',
      caption,
      '--wait',
      '--wait-timeout',
      '300000',
      '--timeout',
      '15m',
      '--json',
      '--yes',
    ],
    { capture: true, timeout: SEND_TIMEOUT_MS }
  );
}

const variant = selectVariant();

checkBuildSpace();
console.log(`Building Ark Android ${variant.label} APK...`);
assertSuccess(run('bun', ['run', variant.buildScript]), `Android ${variant.label} build`);

if (!existsSync(variant.apkPath)) {
  throw new Error(`APK was not created at ${variant.apkPath}`);
}

const digest = await sha256(variant.apkPath);
const caption = `Ark Android ${variant.label} build. SHA-256: ${digest}`;

console.log(`APK: ${variant.apkPath}`);
console.log(`SHA-256: ${digest}`);
console.log('Sending APK with Beeper...');

let sendResult = sendWithBeeper(variant.apkPath, caption);
if (sendResult.status !== 0 && beeperNeedsSetup(sendResult)) {
  console.log('Beeper is not authenticated. Running setup, then retrying send...');
  assertSuccess(run('beeper', ['setup', '--yes']), 'Beeper setup');
  sendResult = sendWithBeeper(variant.apkPath, caption);
}

assertSuccess(sendResult, 'Beeper send');
console.log('Build sent to the dev group.');
