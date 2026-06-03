import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const moduleRoot = import.meta.dir;
const appRoot = join(moduleRoot, '..', '..');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('ArkSpeech local module', () => {
  test('is registered as a cross-platform local Expo module', () => {
    const appPackage = readJson<{ dependencies: Record<string, string> }>(
      join(appRoot, 'package.json')
    );
    const modulePackage = readJson<{ name: string; main: string; types: string }>(
      join(moduleRoot, 'package.json')
    );
    const config = readJson<{
      platforms: string[];
      android: { modules: string[] };
      apple: { modules: string[] };
    }>(
      join(moduleRoot, 'expo-module.config.json')
    );

    expect(appPackage.dependencies['ark-speech']).toBe('./modules/ark-speech');
    expect(modulePackage.name).toBe('ark-speech');
    expect(modulePackage.main).toBe('src/index.ts');
    expect(modulePackage.types).toBe('src/index.ts');
    expect(config.platforms).toContain('android');
    expect(config.platforms).toContain('apple');
    expect(config.android.modules).toEqual(['expo.modules.arkspeech.ArkSpeechModule']);
    expect(config.apple.modules).toEqual(['ArkSpeechModule']);
  });

  test('uses Android SpeechRecognizer with offline preference', () => {
    const kotlin = readFileSync(
      join(
        moduleRoot,
        'android',
        'src',
        'main',
        'java',
        'expo',
        'modules',
        'arkspeech',
        'ArkSpeechModule.kt'
      ),
      'utf8'
    );

    expect(kotlin).toContain('SpeechRecognizer.createSpeechRecognizer');
    expect(kotlin).toContain('RecognizerIntent.EXTRA_PREFER_OFFLINE');
    expect(kotlin).toContain('Manifest.permission.RECORD_AUDIO');
    expect(kotlin).toContain('AsyncFunction("recognizeOnce")');
  });

  test('uses iOS Speech with offline preference', () => {
    const podspec = readFileSync(join(moduleRoot, 'ios', 'ArkSpeech.podspec'), 'utf8');
    const swift = readFileSync(join(moduleRoot, 'ios', 'ArkSpeechModule.swift'), 'utf8');

    expect(podspec).toContain("s.frameworks     = 'Speech', 'AVFoundation'");
    expect(swift).toContain('import Speech');
    expect(swift).toContain('SFSpeechRecognizer.requestAuthorization');
    expect(swift).toContain('request.requiresOnDeviceRecognition = preferOffline');
    expect(swift).toContain('AVAudioEngine');
    expect(swift).toContain('AsyncFunction("recognizeOnce")');
  });
});
