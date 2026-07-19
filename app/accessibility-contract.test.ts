import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { twMerge } from 'tailwind-merge';

const SOURCE_ROOTS = ['app', 'src/components'];

function sourceFiles(directory: string, files: string[] = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, files);
    else if (['.tsx', '.ts'].includes(extname(entry.name)) && !entry.name.includes('.test.')) {
      files.push(path);
    }
  }
  return files;
}

describe('accessibility contracts', () => {
  test('the resolved shared icon variant stays at least 44px at every breakpoint', () => {
    const buttonSource = readFileSync(join(process.cwd(), 'src/components/ui/button.tsx'), 'utf8');
    const iconVariant = buttonSource.match(/icon:\s*'([^']+)'/)?.[1];
    expect(iconVariant).toBeDefined();
    const classes = twMerge(iconVariant!).split(/\s+/);
    expect(classes).toEqual(expect.arrayContaining(['h-12', 'w-12', 'sm:h-11', 'sm:w-11']));
    expect(classes).not.toEqual(expect.arrayContaining(['sm:h-10', 'sm:w-10', 'sm:h-9', 'sm:w-9']));
  });

  test('icon-only buttons have accessible names and field-sized touch targets', () => {
    const failures: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const path of sourceFiles(join(process.cwd(), root))) {
        const source = readFileSync(path, 'utf8');
        const openingTags = source.match(/<Button\b[^>]*\bsize="icon"[^>]*>/gs) ?? [];
        for (const tag of openingTags) {
          if (!tag.includes('accessibilityLabel=')) {
            failures.push(`${relative(process.cwd(), path)}: missing accessibilityLabel`);
          }
          if (/\b(?:h|w|size)-(?:8|9|10)\b/.test(tag)) {
            failures.push(`${relative(process.cwd(), path)}: icon target is smaller than 44px`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
