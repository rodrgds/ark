#!/usr/bin/env node
// Verifies the git index does not contain generated build caches or accidental
// binary blobs. F-Droid's scanner rejects source trees that ship `.gradle`,
// `.cxx`, `.externalNativeBuild`, or `build/` artifacts, and untraceable
// binaries need explicit provenance. Run as part of `bun run check`.
import { execFileSync } from 'node:child_process';

const CACHE_DIR_PATTERNS = [
  /(^|\/)\.gradle\//,
  /(^|\/)\.cxx\//,
  /(^|\/)\.externalNativeBuild\//,
  /(^|\/)build\//,
];

const BINARY_PATTERNS = [/\.(aar|jar|so|dll|dylib|exe|class|o|a|bin|wasm|apk|tflite|pte|ptl)$/i];

// Known-good tracked artifacts with published provenance. The Gradle wrapper
// jar has official checksums and is required by fdroidserver; debug.keystore
// is the standard public Android debug key shipped by the RN/Expo template.
const ALLOWED_BINARIES = new Set([
  'android/gradle/wrapper/gradle-wrapper.jar',
  'android/app/debug.keystore',
]);

const errors = [];

function main() {
  const output = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  for (const path of output.split('\n')) {
    if (!path) continue;
    for (const pattern of CACHE_DIR_PATTERNS) {
      if (pattern.test(path)) {
        errors.push(`Generated build cache is tracked: ${path}`);
      }
    }
    if (ALLOWED_BINARIES.has(path)) continue;
    for (const pattern of BINARY_PATTERNS) {
      if (pattern.test(path)) {
        errors.push(`Unexpected binary is tracked: ${path}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('Repository hygiene check failed:');
    for (const error of errors) console.error(`- ${error}`);
    console.error(
      '\nRemove these files from the git index with `git rm --cached` and update .gitignore.'
    );
    process.exit(1);
  }

  console.log('Repository hygiene: no tracked build caches or unexpected binaries.');
}

main();
