import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const TEST_ROOTS = ['app', 'src', 'modules'];
const UNIT_TEST_PATTERN = /\.test\.tsx?$/;
const RNTL_TEST_PATTERN = /\.rntl\.tsx?$/;

function collectTests(directory, matches) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      collectTests(path, matches);
    } else if (UNIT_TEST_PATTERN.test(entry.name) || RNTL_TEST_PATTERN.test(entry.name)) {
      matches.push(`./${relative(process.cwd(), path)}`);
    }
  }
}

const tests = [];
for (const root of TEST_ROOTS) collectTests(join(process.cwd(), root), tests);
tests.sort();

const unitTests = tests.filter((path) => UNIT_TEST_PATTERN.test(path));
const mountedTests = tests.filter((path) => RNTL_TEST_PATTERN.test(path));

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Running ${unitTests.length} unit test files.`);
for (const test of unitTests) run(['test', test]);

console.log(`Running ${mountedTests.length} mounted component test files.`);
for (const test of mountedTests) run(['test', test, '--timeout', '12000']);
