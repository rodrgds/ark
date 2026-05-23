import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const appDir = join(process.cwd(), 'app');

const ROUTE_FILES = walk(appDir)
  .filter((file) => file.endsWith('.tsx'))
  .filter((file) => !file.endsWith('.test.tsx'))
  .filter((file) => !file.endsWith('.test.ts'))
  .filter((file) => !relative(appDir, file).startsWith('+'));

describe('app route contracts', () => {
  test('every route module has a default export', () => {
    for (const file of ROUTE_FILES) {
      const source = readFileSync(file, 'utf8');
      expect(source, relative(appDir, file)).toContain('export default');
    }
  });

  test('root layout registers all top-level route groups', () => {
    const source = readFileSync(join(appDir, '_layout.tsx'), 'utf8');
    for (const route of ['index', 'onboarding', '(tabs)', 'tools', 'content', 'documents']) {
      expect(source).toContain(`name="${route}"`);
    }
  });

  test('tab layout registers the primary app sections', () => {
    const source = readFileSync(join(appDir, '(tabs)/_layout.tsx'), 'utf8');
    for (const route of ['index', 'chat', 'map', 'library', 'notes', 'tools', 'settings']) {
      expect(source).toContain(`name="${route}"`);
    }
  });

  test('onboarding flow keeps the expected step order and tab handoff', () => {
    const intro = readFileSync(join(appDir, 'onboarding/index.tsx'), 'utf8');
    const security = readFileSync(join(appDir, 'onboarding/security.tsx'), 'utf8');
    const permissions = readFileSync(join(appDir, 'onboarding/permissions.tsx'), 'utf8');
    const power = readFileSync(join(appDir, 'onboarding/power.tsx'), 'utf8');
    const packs = readFileSync(join(appDir, 'onboarding/packs.tsx'), 'utf8');
    const finish = readFileSync(join(appDir, 'onboarding/finish.tsx'), 'utf8');

    expect(intro).toContain('nextHref="/onboarding/security"');
    expect(security).toContain('nextHref="/onboarding/permissions"');
    expect(permissions).toContain('/onboarding/power');
    expect(power).toContain('nextHref="/onboarding/packs"');
    expect(packs).toContain('nextHref="/onboarding/finish"');
    expect(finish).toContain("router.replace('/(tabs)')");
    expect(finish).toContain('completeOnboarding');
  });

  test('screens do not ship obvious placeholder copy', () => {
    const allowed = new Set([
      'app/(tabs)/notes.tsx',
      'app/(tabs)/chat.tsx',
      'app/(tabs)/library.tsx',
      'app/(tabs)/map.tsx',
      'app/(tabs)/settings.tsx',
      'app/onboarding/security.tsx',
      'src/components/ui/input.tsx',
    ]);
    const offenders = ROUTE_FILES.filter((file) => {
      const rel = relative(process.cwd(), file);
      const source = readFileSync(file, 'utf8');
      return !allowed.has(rel) && /\bplaceholder\b/i.test(source);
    }).map((file) => relative(process.cwd(), file));
    expect(offenders).toEqual([]);
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = join(dir, name);
    return statSync(file).isDirectory() ? walk(file) : [file];
  });
}
