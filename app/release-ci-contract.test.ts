import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('release CI contracts', () => {
  test('package scripts expose the local release gates', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts.typecheck).toBe('tsc --noEmit');
    expect(pkg.scripts.lint).toContain('eslint .');
    expect(pkg.scripts.check).toContain('bun run typecheck');
    expect(pkg.scripts.check).toContain('bun run lint');
    expect(pkg.scripts.check).toContain('bun run test');
    expect(pkg.scripts.test).toContain('bun test');
    expect(pkg.scripts.test).toContain('tab-preferences-card.rntl.tsx');
    expect(pkg.scripts.test).toContain('diagnostics-card.rntl.tsx');
    expect(pkg.scripts.test).toContain('security-section.rntl.tsx');
    expect(pkg.scripts.test).toContain('ai-section.rntl.tsx');
    expect(pkg.scripts.test).toContain('downloads-card.rntl.tsx');
    expect(pkg.scripts.test).toContain('document-reader.rntl.tsx');
    expect(pkg.scripts.test).toContain('content-reader.rntl.tsx');
    expect(pkg.scripts.test).toContain('library-screen.rntl.tsx');
    expect(pkg.scripts.test).toContain('map-screen.rntl.tsx');
    expect(pkg.scripts['android:build:dev']).toContain('assembleDebug');
    expect(pkg.scripts['android:build:prod']).toContain('assembleRelease');
    expect(pkg.scripts['android:release:apks']).toBe('bash scripts/android-release-apks.sh');
    expect(pkg.scripts['ios:build:sim']).toBe('bash scripts/ios-simulator-build.sh');

    const iosBuildScript = readFileSync(
      join(process.cwd(), 'scripts/ios-simulator-build.sh'),
      'utf8'
    );
    expect(iosBuildScript).toContain('ARK_IOS_SIM_ARCHS');
    expect(iosBuildScript).toContain('ARK_IOS_XCODEBUILD_QUIET');
    expect(iosBuildScript).toContain('ARK_IOS_XCODEBUILD_LOG');
    expect(iosBuildScript).toContain('ARCHS="${ios_sim_archs}"');
  });

  test('pre-commit runs the same local checks as release gates', () => {
    // Pre-commit hooks are now declared in devenv.nix (git-hooks.hooks.*)
    // and materialized by `devenv:git-hooks:install` on every shell
    // entry. The legacy `.githooks/pre-commit` shell script was removed
    // in 5ff6f93; do not reintroduce it.
    const devenvNix = readFileSync(join(process.cwd(), 'devenv.nix'), 'utf8');

    // The devenv-installed hook config must drive the same gates as the
    // GitHub Actions release workflow: typecheck, lint, test, prettier.
    for (const hook of ['typecheck', 'lint', 'test', 'prettier-check']) {
      expect(devenvNix).toContain(`${hook} = {`);
      expect(devenvNix).toContain(`name = "${hook}-wrapper"`);
    }
    expect(devenvNix).toContain('bunx prettier --check .');
    expect(devenvNix).toContain('bunx tsc --noEmit');
    expect(devenvNix).toContain('bunx eslint . --quiet');
    expect(devenvNix).toContain('bun run test');

    const gitignore = readFileSync(join(process.cwd(), '.gitignore'), 'utf8');
    expect(gitignore).toContain('.githooks/');
    expect(gitignore).toContain('.pre-commit-config.yaml');

    const trackedGeneratedHooks = spawnSync(
      'git',
      ['ls-files', '.githooks/pre-commit', '.pre-commit-config.yaml'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      }
    );
    expect(trackedGeneratedHooks.status).toBe(0);
    expect(trackedGeneratedHooks.stdout.trim()).toBe('');

    // The CI workflow must wire the same checks. The current shape calls
    // the dev-shell scripts (format-check / typecheck / lint) directly and
    // 'bun run test' for the rntl-suite (package.json script, not a Bash
    // builtin). Earlier shapes called 'bun run typecheck' / 'bun run lint' /
    // 'bun run test' directly; both forms are accepted here so future
    // refactors don't have to keep the indirection-or-not decision in sync
    // with this contract.
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toContain("'.gitignore'");
    expect(workflow).toContain("'devenv.nix'");
    expect(workflow).toContain("'devenv.yaml'");
    expect(workflow).toContain("'devenv.lock'");
    expect(workflow).toContain("'scripts/**'");
    expect(workflow).toContain("'plugins/**'");
    expect(workflow).toContain('iOS Simulator Build');

    const devShellName = (name: string) =>
      // Either the dev-shell script name appears in the workflow OR the
      // workflow invokes the package.json script directly via `bun run`.
      workflow.includes(name) || workflow.includes(`bun run ${name}`);
    expect(devShellName('typecheck')).toBe(true);
    expect(devShellName('lint')).toBe(true);
    expect(workflow).toContain('bun run test');
    expect(workflow).toContain('bun run ios:build:sim');
    expect(workflow).toContain('ARK_IOS_PREBUILD');
  });

  test('GitHub Actions runs install, checks, tests, and an iOS simulator build', () => {
    // Ark delegates Android debug builds to a separate project for now;
    // the in-repo CI runs devenv shell scripts (format-check / typecheck
    // / lint) and `bun run test` for the scoped rntl-suite. The Android gate is
    // documented in docs/release-readiness.md and will be re-added to this
    // workflow once a CI SDK cache strategy is decided. The strings that
    // used to live here (`bun run android:build:dev`,
    // `actions/upload-artifact@v4`, `android/app/build/outputs/apk/debug/*.apk`)
    // are intentionally absent and asserted so.
    const workflowPath = join(process.cwd(), '.github/workflows/ci.yml');
    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, 'utf8');
    expect(workflow).not.toContain('bun run android:build:dev');
    expect(workflow).not.toContain('actions/upload-artifact@v4');
    expect(workflow).not.toContain('android/app/build/outputs/apk/debug/*.apk');
    // format-check / typecheck / lint / bun run test stay wired,
    // and the macOS lane builds the generated iOS simulator project.
    expect(workflow).toMatch(/(^|\s)format-check(\s|$)/m);
    const devShellName = (name: string) =>
      workflow.includes(name) || workflow.includes(`bun run ${name}`);
    expect(devShellName('typecheck')).toBe(true);
    expect(devShellName('lint')).toBe(true);
    expect(workflow).toContain('bun run test');
    expect(workflow).toContain('runs-on: macos-26');
    expect(workflow).toContain('bun run ios:build:sim');
  });

  test('Android release workflow builds signed APK assets for GitHub releases', () => {
    const workflowPath = join(process.cwd(), '.github/workflows/android-release.yml');
    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('types: [published]');
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('ARK_ANDROID_KEYSTORE_BASE64');
    expect(workflow).toContain('ARK_ANDROID_KEYSTORE_PASSWORD');
    expect(workflow).toContain('ARK_ANDROID_KEY_ALIAS');
    expect(workflow).toContain('ARK_ANDROID_KEY_PASSWORD');
    expect(workflow).toContain('bun run android:release:apks');
    expect(workflow).toContain('gh release upload');
    expect(workflow).toContain('SHA256SUMS.txt');

    const app = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')) as {
      expo: { plugins: Array<string | [string, Record<string, unknown>]> };
    };
    expect(app.expo.plugins).toContain('./plugins/with-ark-android-release');

    const releasePlugin = readFileSync(
      join(process.cwd(), 'plugins/with-ark-android-release.js'),
      'utf8'
    );
    expect(releasePlugin).toContain('universalApk true');
    expect(releasePlugin).toContain('"arm64-v8a"');
    expect(releasePlugin).toContain('ARK_ANDROID_KEYSTORE_PATH');

    const releaseScript = readFileSync(
      join(process.cwd(), 'scripts/android-release-apks.sh'),
      'utf8'
    );
    expect(releaseScript).toContain('bun run android:build:prod');
    expect(releaseScript).toContain('APK_MANIFEST.txt');
    expect(releaseScript).toContain('SHA256SUMS.txt');
  });

  test('store permission declarations match runtime capabilities', () => {
    const app = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')) as {
      expo: {
        ios: { infoPlist: Record<string, string> };
        android: { permissions: string[] };
        plugins: Array<string | [string, Record<string, unknown>]>;
      };
    };
    const infoPlist = app.expo.ios.infoPlist;

    for (const key of [
      'NSFaceIDUsageDescription',
      'NSMotionUsageDescription',
      'NSLocationWhenInUseUsageDescription',
      'NSLocationAlwaysAndWhenInUseUsageDescription',
      'NSMicrophoneUsageDescription',
      'NSCameraUsageDescription',
      'NSPhotoLibraryUsageDescription',
    ]) {
      expect(infoPlist[key]?.length ?? 0).toBeGreaterThan(20);
    }

    expect(app.expo.android.permissions).toContain('ACCESS_FINE_LOCATION');
    expect(app.expo.android.permissions).toContain('ACCESS_COARSE_LOCATION');
    expect(app.expo.android.permissions).toContain('ACCESS_BACKGROUND_LOCATION');
    expect(app.expo.android.permissions).toContain('FOREGROUND_SERVICE');
    expect(app.expo.android.permissions).toContain('FOREGROUND_SERVICE_LOCATION');
    expect(app.expo.android.permissions).toContain('ACTIVITY_RECOGNITION');
    expect(app.expo.android.permissions).toContain('RECORD_AUDIO');

    const audioPlugin = findPlugin(app.expo.plugins, 'expo-audio');
    expect(audioPlugin?.enableBackgroundPlayback).toBe(false);
    expect(audioPlugin?.enableBackgroundRecording).toBe(false);

    const locationPlugin = findPlugin(app.expo.plugins, 'expo-location');
    expect(locationPlugin?.locationWhenInUsePermission).toContain('record tracks');
    expect(locationPlugin?.locationAlwaysAndWhenInUsePermission).toContain('screen is locked');
    expect(locationPlugin?.isIosBackgroundLocationEnabled).toBe(true);
    expect(locationPlugin?.isAndroidBackgroundLocationEnabled).toBe(true);
    expect(locationPlugin?.isAndroidForegroundServiceEnabled).toBe(true);

    const imagePickerPlugin = findPlugin(app.expo.plugins, 'expo-image-picker');
    expect(imagePickerPlugin?.cameraPermission).toContain('tracks');
    expect(imagePickerPlugin?.cameraPermission).toContain('Ask Arky chats');
    expect(imagePickerPlugin?.photosPermission).toContain('tracks');
    expect(imagePickerPlugin?.photosPermission).toContain('Ask Arky chats');
  });

  test('release readiness notes cover privacy, offline launch, stores, and low-end Android', () => {
    const readinessPath = join(process.cwd(), 'docs/release-readiness.md');
    expect(existsSync(readinessPath)).toBe(true);

    const readiness = readFileSync(readinessPath, 'utf8');
    for (const phrase of [
      'Privacy and data safety',
      'Ark has no backend account system',
      'Boot must not require successful network access',
      'Play Console data safety',
      'App Store privacy labels',
      'low-end Android',
      'SQLCipher',
      'docs/android-device-smoke.md',
    ]) {
      expect(readiness).toContain(phrase);
    }
  });

  test('Android device smoke checklist covers native runtime launch risks', () => {
    const smokePath = join(process.cwd(), 'docs/android-device-smoke.md');
    expect(existsSync(smokePath)).toBe(true);

    const smoke = readFileSync(smokePath, 'utf8');
    for (const phrase of [
      'Plaintext database',
      'Encrypt DB',
      'Routing engine: active',
      'Routing data: ready',
      'Download visible area',
      'Document Actions',
      'ark-hash-v2',
      'Android Material You',
      'optional SQLCipher',
    ]) {
      expect(smoke).toContain(phrase);
    }
  });
});

function findPlugin(
  plugins: Array<string | [string, Record<string, unknown>]>,
  name: string
): Record<string, unknown> | null {
  const plugin = plugins.find((entry) => (Array.isArray(entry) ? entry[0] : entry) === name);
  if (!Array.isArray(plugin)) return {};
  return plugin[1] ?? {};
}
