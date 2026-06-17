import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const moduleRoot = import.meta.dir;
const appRoot = join(moduleRoot, '..', '..');

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

describe('ArkZim local module', () => {
  test('is registered as a local app dependency for Expo autolinking', () => {
    const appPackage = readJson<{ dependencies: Record<string, string> }>(
      join(appRoot, 'package.json')
    );
    const modulePackage = readJson<{ name: string; main: string; types: string }>(
      join(moduleRoot, 'package.json')
    );

    expect(appPackage.dependencies['ark-zim']).toBe('./modules/ark-zim');
    expect(modulePackage.name).toBe('ark-zim');
    expect(modulePackage.main).toBe('src/index.ts');
    expect(modulePackage.types).toBe('src/index.ts');
  });

  test('uses the Expo module config shape that autolinking resolves', () => {
    const config = readJson<{
      platforms: string[];
      android: { modules: string[] };
      apple: { modules: string[] };
    }>(join(moduleRoot, 'expo-module.config.json'));

    expect(config.platforms).toContain('android');
    expect(config.platforms).toContain('apple');
    expect(config.android.modules).toEqual(['expo.modules.arkzim.ArkZimModule']);
    expect(config.apple.modules).toEqual(['ArkZimModule']);
  });

  test('compiles Android through the Expo module Gradle plugin and libzim binding', () => {
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
        'arkzim',
        'ArkZimModule.kt'
      ),
      'utf8'
    );

    expect(gradle).toContain("id 'expo-module-gradle-plugin'");
    expect(gradle).toContain('org.kiwix:libkiwix:2.6.0');
    expect(kotlin).toContain('import org.kiwix.libzim.Archive');
    expect(kotlin).toContain('Searcher(archive)');
    expect(kotlin).toContain('SuggestionSearcher(archive)');
  });

  test('keeps libkiwix classes and native method names in minified Android release builds', () => {
    const appConfig = readFileSync(join(appRoot, 'app.json'), 'utf8');
    const proguard = readFileSync(join(appRoot, 'android', 'app', 'proguard-rules.pro'), 'utf8');

    expect(appConfig).toContain('-keep class org.kiwix.** { *; }');
    expect(appConfig).toContain('-keepclasseswithmembernames class org.kiwix.**');
    expect(proguard).toContain('-keep class org.kiwix.** { *; }');
    expect(proguard).toContain('-keepclasseswithmembernames class org.kiwix.**');
  });

  test('wires iOS through CoreKiwix and a native Objective-C++ reader bridge', () => {
    const podspec = readFileSync(join(moduleRoot, 'ios', 'ArkZim.podspec'), 'utf8');
    const swift = readFileSync(join(moduleRoot, 'ios', 'ArkZimModule.swift'), 'utf8');
    const reader = readFileSync(join(moduleRoot, 'ios', 'ArkZimReader.mm'), 'utf8');
    const modulemap = readFileSync(join(moduleRoot, 'ios', 'CoreKiwix.modulemap'), 'utf8');

    expect(podspec).toContain("s.vendored_frameworks = 'CoreKiwix.xcframework'");
    expect(podspec).toContain('libkiwix_xcframework-14.2.1-2.tar.gz');
    expect(podspec).toContain('libmerged.a');
    expect(podspec).toContain('PlistBuddy');
    expect(podspec).toContain(
      "s.source_files   = 'ArkZimModule.swift', 'ArkZimReader.h', 'ArkZimReader.mm'"
    );
    expect(podspec).toContain("s.public_header_files = 'ArkZimReader.h'");
    expect(podspec).toContain("s.exclude_files = 'CoreKiwix.xcframework/**/*'");
    expect(podspec).toContain("'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'");
    expect(podspec).not.toContain('HEADER_SEARCH_PATHS');
    expect(swift).toContain('private let reader = ArkZimReader()');
    expect(swift).toContain('DispatchQueue.global(qos: .userInitiated).async');
    expect(swift).not.toContain('notImplemented');
    expect(reader).toContain('#include "zim/archive.h"');
    expect(reader).toContain('#include "zim/search.h"');
    expect(reader).toContain('#include "zim/suggestion.h"');
    expect(reader).toContain('zim::Searcher searcher');
    expect(reader).toContain('zim::SuggestionSearcher');
    expect(reader).toContain('zim::setClusterCacheMaxSize(16777216)');
    expect(modulemap).toContain('module CoreKiwix');
  });
});
