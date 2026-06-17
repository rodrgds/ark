#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const repo = resolve(process.cwd(), process.env.VALHALLA_REPO ?? 'vendor/valhalla');
const out = resolve(process.cwd(), process.env.VALHALLA_OUT ?? 'native/valhalla');
const androidNdk =
  process.env.ANDROID_NDK_HOME ?? process.env.ANDROID_NDK_ROOT ?? process.env.ANDROID_NDK ?? '';
const abi = process.env.ABI ?? 'arm64-v8a';
const buildDir = resolve(repo, `build-android-${abi}`);

if (!existsSync(repo)) {
  fail(
    `Valhalla source repo not found at ${repo}.\n` +
      `Clone it first:\n` +
      `  git clone --recursive https://github.com/valhalla/valhalla ${repo}`
  );
}

if (!androidNdk) {
  fail('Set ANDROID_NDK_HOME to your Android NDK path before building Valhalla.');
}

mkdirSync(buildDir, { recursive: true });
mkdirSync(resolve(out, 'android', abi, 'lib'), { recursive: true });

run('cmake', [
  '-S',
  repo,
  '-B',
  buildDir,
  `-DCMAKE_TOOLCHAIN_FILE=${androidNdk}/build/cmake/android.toolchain.cmake`,
  `-DANDROID_ABI=${abi}`,
  '-DANDROID_PLATFORM=android-24',
  '-DCMAKE_BUILD_TYPE=Release',
  '-DBUILD_SHARED_LIBS=OFF',
  '-DENABLE_TOOLS=OFF',
  '-DENABLE_TESTS=OFF',
  '-DENABLE_BENCHMARKS=OFF',
  '-DENABLE_SERVICES=OFF',
  '-DENABLE_HTTP=OFF',
  '-DENABLE_PYTHON_BINDINGS=OFF',
  `-DCMAKE_INSTALL_PREFIX=${out}`,
]);
run('cmake', ['--build', buildDir, '--target', 'install', '--parallel', process.env.JOBS ?? '2']);

console.log(`Valhalla Android artifacts installed under ${out}`);
console.log(
  `Build ark-routing with: -ParkRoutingValhallaDir=${out} -PreactNativeArchitectures=${abi}`
);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
