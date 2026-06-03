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
    expect(pkg.scripts.check).toContain('bun test');
    expect(pkg.scripts['android:build:dev']).toContain('assembleDebug');
  });

  test('GitHub Actions runs install, checks, tests, and an Android debug build', () => {
    const workflowPath = join(process.cwd(), '.github/workflows/ci.yml');
    expect(existsSync(workflowPath)).toBe(true);

    const workflow = readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('bun install --frozen-lockfile');
    expect(workflow).toContain('bun run typecheck');
    expect(workflow).toContain('bun run lint');
    expect(workflow).toContain('bun test');
    expect(workflow).toContain('bun run android:build:dev');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('android/app/build/outputs/apk/debug/*.apk');
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
