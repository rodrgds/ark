import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
    expect(pkg.scripts['android:build:dev']).toContain('assembleDebug');
  });

  test('pre-commit runs the same local checks as release gates', () => {
    // Pre-commit hooks are now declared in devenv.nix (git-hooks.hooks.*)
    // and materialized by `devenv:git-hooks:install` on every shell
    // entry. The legacy `.githooks/pre-commit` shell script was removed
    // in 5ff6f93; do not reintroduce it.
    const devenvNix = readFileSync(join(process.cwd(), 'devenv.nix'), 'utf8');

    // The prek-installed hook config must drive the same gates as the
    // GitHub Actions release workflow: typecheck, lint, test, prettier.
    for (const hook of ['typecheck', 'lint', 'test', 'prettier-check']) {
      expect(devenvNix).toContain(`${hook} = {`);
      expect(devenvNix).toContain(`name = "${hook}-wrapper"`);
    }

    // The CI workflow must wire the same checks. The current shape calls
    // the dev-shell scripts (format-check / typecheck / lint) directly and
    // 'bun run test' for the rntl-suite (package.json script, not a Bash
    // builtin). Earlier shapes called 'bun run typecheck' / 'bun run lint' /
    // 'bun run test' directly; both forms are accepted here so future
    // refactors don't have to keep the indirection-or-not decision in sync
    // with this contract.
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/ci.yml'), 'utf8');
    const devShellName = (name: string) =>
      // Either the dev-shell script name appears in the workflow OR the
      // workflow invokes the package.json script directly via `bun run`.
      workflow.includes(name) || workflow.includes(`bun run ${name}`);
    expect(devShellName('typecheck')).toBe(true);
    expect(devShellName('lint')).toBe(true);
    expect(workflow).toContain('bun run test');
  });

  test('GitHub Actions runs install, checks, and tests (Android build is wired elsewhere)', () => {
    // Ark delegates Android debug builds to a separate project for now;
    // the in-repo CI runs devenv shell scripts (format-check / typecheck
    // / lint) and `bun run test` for the rntl-suite. The Android gate is
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
    // format-check / typecheck / lint / bun run test stay wired.
    expect(workflow).toMatch(/(^|\s)format-check(\s|$)/m);
    const devShellName = (name: string) =>
      workflow.includes(name) || workflow.includes(`bun run ${name}`);
    expect(devShellName('typecheck')).toBe(true);
    expect(devShellName('lint')).toBe(true);
    expect(workflow).toContain('bun run test');
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
      'NSMicrophoneUsageDescription',
      'NSCameraUsageDescription',
      'NSPhotoLibraryUsageDescription',
    ]) {
      expect(infoPlist[key]?.length ?? 0).toBeGreaterThan(20);
    }

    expect(app.expo.android.permissions).toContain('ACCESS_FINE_LOCATION');
    expect(app.expo.android.permissions).toContain('ACCESS_COARSE_LOCATION');
    expect(app.expo.android.permissions).toContain('ACTIVITY_RECOGNITION');
    expect(app.expo.android.permissions).toContain('RECORD_AUDIO');
    expect(app.expo.android.permissions).not.toContain('ACCESS_BACKGROUND_LOCATION');

    const audioPlugin = findPlugin(app.expo.plugins, 'expo-audio');
    expect(audioPlugin?.enableBackgroundPlayback).toBe(false);
    expect(audioPlugin?.enableBackgroundRecording).toBe(false);

    const imagePickerPlugin = findPlugin(app.expo.plugins, 'expo-image-picker');
    expect(imagePickerPlugin?.cameraPermission).toContain('spot photos');
    expect(imagePickerPlugin?.photosPermission).toContain('spot photos');
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
    ]) {
      expect(readiness).toContain(phrase);
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
