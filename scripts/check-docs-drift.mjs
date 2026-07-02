#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('..', import.meta.url).pathname);

const checks = [
  {
    name: 'onboarding step count',
    expected: 8,
    actual: await countFiles('app/onboarding', (name) => /^[a-z]+\.tsx$/.test(name)),
  },
  {
    name: 'store count',
    expected: 4,
    actual: await countFiles('src/stores', (name) => name.endsWith('-store.ts')),
  },
  {
    name: 'service dirs',
    expected: 16,
    actual: await countDirs('src/services'),
  },
  {
    name: 'lib modules',
    expected: 10,
    actual: await countFiles(
      'src/lib',
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts')
    ),
  },
  {
    name: 'ui primitives',
    expected: 11,
    actual: await countFiles(
      'src/components/ui',
      (name) => name.endsWith('.tsx') && !name.endsWith('.test.tsx')
    ),
  },
  {
    name: 'db version',
    expected: 1,
    actual: await findLatestPragmaVersion(),
  },
  {
    name: 'base table count',
    expected: 26,
    actual: await countMigrations((line) => /CREATE TABLE (?!IF NOT EXISTS \w+_fts)/i.test(line)),
  },
  {
    name: 'fts5 table count',
    expected: 4,
    actual: await countMigrations((line) => /CREATE VIRTUAL TABLE.*USING fts5/i.test(line)),
  },
];

const agents = await readFile(resolve(repoRoot, 'AGENTS.md'), 'utf8');
const todo = await readFile(resolve(repoRoot, 'TODO.md'), 'utf8');
const contentPackUrls = await readFile(resolve(repoRoot, 'docs/content-pack-urls.md'), 'utf8');
const architecture = await readFile(resolve(repoRoot, 'docs/architecture.md'), 'utf8');
const v1PrepPlan = await readFile(resolve(repoRoot, 'docs/v1-prep-plan.md'), 'utf8');
const arkRoutingReadme = await readFile(resolve(repoRoot, 'modules/ark-routing/README.md'), 'utf8');
const arkZimIos = {
  podspec: await readFile(resolve(repoRoot, 'modules/ark-zim/ios/ArkZim.podspec'), 'utf8').catch(
    () => ''
  ),
  swift: await readFile(resolve(repoRoot, 'modules/ark-zim/ios/ArkZimModule.swift'), 'utf8').catch(
    () => ''
  ),
  reader: await readFile(resolve(repoRoot, 'modules/ark-zim/ios/ArkZimReader.mm'), 'utf8').catch(
    () => ''
  ),
};
const arkRoutingIos = {
  podspec: await readFile(
    resolve(repoRoot, 'modules/ark-routing/ios/ArkRouting.podspec'),
    'utf8'
  ).catch(() => ''),
  swift: await readFile(
    resolve(repoRoot, 'modules/ark-routing/ios/ArkRoutingModule.swift'),
    'utf8'
  ).catch(() => ''),
};

let drift = 0;
for (const { name, expected, actual } of checks) {
  if (actual === null) {
    console.log(`SKIP  ${name}: could not detect actual count`);
    continue;
  }
  const status = actual === expected ? 'OK' : 'DRIFT';
  if (actual !== expected) drift += 1;
  console.log(`${status.padEnd(4)} ${name}: AGENTS.md says ${expected}, code has ${actual}`);
}

if (hasArkZimIosBridge(arkZimIos)) {
  const staleZimClaims = [
    ['AGENTS.md', agents, /iOS ZIM support is still missing|iOS CoreKiwix binding/i],
    [
      'TODO.md',
      todo,
      /iOS still needs CoreKiwix|iOS native reader support|-\s*\[\s*\]\s*iOS:\s*Bind `CoreKiwix\.xcframework`/i,
    ],
    ['docs/content-pack-urls.md', contentPackUrls, /Android only/i],
  ].filter(([, text, pattern]) => pattern.test(text));
  if (staleZimClaims.length) {
    drift += staleZimClaims.length;
    for (const [file] of staleZimClaims) {
      console.log(`DRIFT ark-zim iOS bridge docs: ${file} still describes iOS ZIM as missing`);
    }
  } else {
    console.log('OK   ark-zim iOS bridge docs: CoreKiwix bridge is reflected in active docs');
  }
}

if (hasArkRoutingIosStub(arkRoutingIos)) {
  const missingRoutingStubClaims = [
    ['AGENTS.md', agents, /iOS Valhalla routing is a stub/i],
    ['TODO.md', todo, /iOS Swift Package bridge/i],
    ['docs/architecture.md', architecture, /iOS routing remains a future native path/i],
    ['docs/v1-prep-plan.md', v1PrepPlan, /Keep iOS routing documented as unavailable/i],
    ['modules/ark-routing/README.md', arkRoutingReadme, /iOS is still a stub/i],
  ].filter(([, text, pattern]) => !pattern.test(text));
  if (missingRoutingStubClaims.length) {
    drift += missingRoutingStubClaims.length;
    for (const [file] of missingRoutingStubClaims) {
      console.log(`DRIFT ark-routing iOS docs: ${file} does not reflect the iOS stub`);
    }
  } else {
    console.log('OK   ark-routing iOS docs: active docs reflect the iOS routing stub');
  }
} else if (hasArkRoutingIosBridge(arkRoutingIos)) {
  const staleRoutingStubClaims = [
    ['AGENTS.md', agents, /iOS Valhalla routing is a stub/i],
    ['TODO.md', todo, /iOS Swift Package bridge/i],
    ['docs/architecture.md', architecture, /iOS routing remains a future native path/i],
    ['docs/v1-prep-plan.md', v1PrepPlan, /Keep iOS routing documented as unavailable/i],
    ['modules/ark-routing/README.md', arkRoutingReadme, /iOS is still a stub/i],
  ].filter(([, text, pattern]) => pattern.test(text));
  if (staleRoutingStubClaims.length) {
    drift += staleRoutingStubClaims.length;
    for (const [file] of staleRoutingStubClaims) {
      console.log(`DRIFT ark-routing iOS docs: ${file} still describes iOS routing as a stub`);
    }
  } else {
    console.log('OK   ark-routing iOS docs: active docs reflect the iOS routing bridge');
  }
}

const factsInDoc = extractNumbersNear(agents, [
  'onboarding',
  'services/',
  'stores',
  'lib',
  '26 base tables',
  '4 FTS5',
  'versioned to 1',
]);

if (factsInDoc.length) {
  console.log('\nHints in AGENTS.md that may need updating:');
  for (const hint of factsInDoc) {
    console.log(`  - ${hint}`);
  }
}

if (drift > 0) {
  console.log(`\n${drift} drift(s) detected. Run scripts/check-docs-drift to inspect.`);
  process.exit(1);
}

async function countFiles(dir, predicate) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(resolve(repoRoot, dir)).catch(() => []);
  return entries.filter(predicate).length;
}

async function countDirs(dir) {
  const { readdir } = await import('node:fs/promises');
  const entries = await readdir(resolve(repoRoot, dir), { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).length;
}

async function findLatestPragmaVersion() {
  const schema = await readFile(resolve(repoRoot, 'src/services/db/schema.ts'), 'utf8');
  const schemaMatch = schema.match(/export const DB_VERSION = (\d+)/);
  if (schemaMatch) return Number(schemaMatch[1]);
  const text = await readFile(resolve(repoRoot, 'src/services/db/migrations.ts'), 'utf8');
  const matches = [...text.matchAll(/PRAGMA user_version = (\d+)/g)];
  if (!matches.length) return null;
  return Math.max(...matches.map((m) => Number(m[1])));
}

async function countMigrations(predicate) {
  const text = await readFile(resolve(repoRoot, 'src/services/db/migrations.ts'), 'utf8');
  const lines = text.split('\n');
  const dedup = new Set();
  for (const line of lines) {
    if (predicate(line.trim())) {
      const m = line.match(/CREATE (TABLE|VIRTUAL TABLE) (?:IF NOT EXISTS )?(\w+)/i);
      if (m) dedup.add(m[2]);
    }
  }
  return dedup.size;
}

function extractNumbersNear(text, needles) {
  const hints = [];
  const lines = text.split('\n');
  for (const needle of needles) {
    const normalizedNeedle = needle.toLowerCase();
    for (const line of lines) {
      if (line.toLowerCase().includes(normalizedNeedle)) {
        const numbers = [...line.matchAll(/\b(\d+)\b/g)].map((m) => Number(m[1]));
        if (numbers.length) {
          hints.push(`${needle}: ${numbers.join(', ')}`);
        }
        break;
      }
    }
  }
  return hints;
}

function hasArkZimIosBridge({ podspec, swift, reader }) {
  return (
    podspec.includes("s.vendored_frameworks = 'CoreKiwix.xcframework'") &&
    podspec.includes('libkiwix_xcframework') &&
    swift.includes('private let reader = ArkZimReader()') &&
    !swift.includes('notImplemented') &&
    reader.includes('#include "zim/archive.h"') &&
    reader.includes('zim::Searcher searcher') &&
    reader.includes('zim::SuggestionSearcher')
  );
}

function hasArkRoutingIosStub({ podspec, swift }) {
  return (
    podspec.includes("s.dependency 'ExpoModulesCore'") &&
    !hasArkRoutingIosDependency(podspec) &&
    swift.includes('"available": false') &&
    swift.includes('E_ROUTING_ENGINE_UNAVAILABLE') &&
    swift.includes('Valhalla native routing is not linked into this development build') &&
    !swift.includes('import Valhalla')
  );
}

function hasArkRoutingIosBridge({ podspec, swift }) {
  return (
    (hasArkRoutingIosDependency(podspec) || swift.includes('import Valhalla')) &&
    swift.includes('calculateRoute') &&
    !swift.includes('"available": false')
  );
}

function hasArkRoutingIosDependency(podspec) {
  return /s\.dependency\s+['"]Valhalla['"]/.test(podspec) || /valhalla-mobile/i.test(podspec);
}
