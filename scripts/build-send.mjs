#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const CHAT_ID = '!Hf5OYEW7nA8jd9xaPncq:beeper.local';
const APK_MIME = 'application/vnd.android.package-archive';
const SEND_TIMEOUT_MS = 5 * 60 * 1000;
const VARIANTS = {
  release: {
    buildScript: 'android:build:prod',
    apkPath: resolve('android/app/build/outputs/apk/release/app-release.apk'),
    label: 'release',
  },
  dev: {
    buildScript: 'android:build:dev',
    apkPath: resolve('android/app/build/outputs/apk/debug/app-debug.apk'),
    label: 'dev',
  },
};

function selectVariant() {
  const args = new Set(process.argv.slice(2));
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
      '120000',
      '--timeout',
      '5m',
      '--json',
      '--yes',
    ],
    { capture: true, timeout: SEND_TIMEOUT_MS }
  );
}

const variant = selectVariant();

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
