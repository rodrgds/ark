import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dir, '..', '..');
const moduleRoot = join(repoRoot, 'modules', 'ark-ocr');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('ark-ocr native module packaging', () => {
  test('is registered as an Android-only local Expo module', () => {
    const appPackage = readJson<{ dependencies: Record<string, string> }>(
      join(repoRoot, 'package.json')
    );
    const modulePackage = readJson<{ name: string }>(join(moduleRoot, 'package.json'));
    const config = readJson<{ platforms: string[]; android: { modules: string[] } }>(
      join(moduleRoot, 'expo-module.config.json')
    );

    expect(appPackage.dependencies['ark-ocr']).toBe('./modules/ark-ocr');
    expect(modulePackage.name).toBe('ark-ocr');
    expect(config.platforms).toEqual(['android']);
    expect(config.android.modules).toEqual(['expo.modules.arkocr.ArkOcrModule']);
  });

  test('bundles ML Kit text recognition for offline OCR', () => {
    const gradle = readFileSync(join(moduleRoot, 'android', 'build.gradle'), 'utf8');
    const kotlin = readFileSync(
      join(
        moduleRoot,
        'android',
        'src',
        'main',
        'java',
        'expo',
        'modules',
        'arkocr',
        'ArkOcrModule.kt'
      ),
      'utf8'
    );

    expect(gradle).toContain('com.google.mlkit:text-recognition:16.0.1');
    expect(gradle).toContain('com.tom-roush:pdfbox-android:2.0.27.0');
    expect(kotlin).toContain('TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)');
    expect(kotlin).toContain('InputImage.fromFilePath');
    expect(kotlin).toContain('AsyncFunction("extractPdfText")');
    expect(kotlin).toContain('AsyncFunction("recognizePdf")');
  });
});
