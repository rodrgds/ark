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
    actual: await countFiles('src/lib', (name) => name.endsWith('.ts') && !name.endsWith('.test.ts')),
  },
  {
    name: 'ui primitives',
    expected: 11,
    actual: await countFiles('src/components/ui', (name) =>
      name.endsWith('.tsx') && !name.endsWith('.test.tsx')
    ),
  },
  {
    name: 'db version',
    expected: 18,
    actual: await findLatestPragmaVersion(),
  },
  {
    name: 'base table count',
    expected: 24,
    actual: await countMigrations((line) => /CREATE TABLE (?!IF NOT EXISTS \w+_fts)/i.test(line)),
  },
  {
    name: 'fts5 table count',
    expected: 3,
    actual: await countMigrations((line) => /CREATE VIRTUAL TABLE.*USING fts5/i.test(line)),
  },
];

const agents = await readFile(resolve(repoRoot, 'AGENTS.md'), 'utf8');

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

const factsInDoc = extractNumbersNear(agents, [
  'onboarding',
  'services/',
  'stores',
  'lib',
  '24 base tables',
  '3 FTS5',
  '18',
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
  const text = await readFile(
    resolve(repoRoot, 'src/services/db/migrations.ts'),
    'utf8'
  );
  const matches = [...text.matchAll(/PRAGMA user_version = (\d+)/g)];
  if (!matches.length) return null;
  return Math.max(...matches.map((m) => Number(m[1])));
}

async function countMigrations(predicate) {
  const text = await readFile(
    resolve(repoRoot, 'src/services/db/migrations.ts'),
    'utf8'
  );
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
    for (const line of lines) {
      if (line.toLowerCase().includes(needle)) {
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
