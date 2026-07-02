import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const moduleDir = join(process.cwd(), 'modules/ark-system-colors');

describe('ArkSystemColors local module', () => {
  test('is registered as a cross-platform Expo module', () => {
    const config = JSON.parse(readFileSync(join(moduleDir, 'expo-module.config.json'), 'utf8')) as {
      platforms: string[];
      apple: { modules: string[] };
      android: { modules: string[] };
    };

    expect(config.platforms).toEqual(['apple', 'android']);
    expect(config.apple.modules).toContain('ArkSystemColorsModule');
    expect(config.android.modules).toContain('expo.modules.arksystemcolors.ArkSystemColorsModule');
  });

  test('resolves Android Material You colors with unsupported fallbacks', () => {
    const kotlin = readFileSync(
      join(
        moduleDir,
        'android/src/main/java/expo/modules/arksystemcolors/ArkSystemColorsModule.kt'
      ),
      'utf8'
    );

    expect(kotlin).toContain('Name("ArkSystemColors")');
    expect(kotlin).toContain('Build.VERSION_CODES.S');
    expect(kotlin).toContain('system_accent1_200');
    expect(kotlin).toContain('system_accent1_700');
    expect(kotlin).toContain('foregroundFor');
    expect(kotlin).toContain('android-material-you');
  });

  test('uses an optional JavaScript module so Expo Go can fall back', () => {
    const source = readFileSync(join(moduleDir, 'src/index.ts'), 'utf8');

    expect(source).toContain('requireOptionalNativeModule');
    expect(source).toContain('Native system color module is not available');
  });
});
