import { describe, expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const toolsDir = join(process.cwd(), 'app/tools');

describe('tools routes', () => {
  test('keeps every tool screen registered in the stack layout', () => {
    const routeFiles = readdirSync(toolsDir)
      .filter((name) => name.endsWith('.tsx'))
      .filter((name) => !name.startsWith('_'))
      .map((name) => name.replace(/\.tsx$/, ''));
    const layout = readFileSync(join(toolsDir, '_layout.tsx'), 'utf8');

    for (const route of routeFiles) {
      expect(layout).toContain(`${route}:`);
    }
  });

  test('keeps the new field tools as real screens', () => {
    expect(existsSync(join(toolsDir, 'coordinates.tsx'))).toBe(true);
    expect(existsSync(join(toolsDir, 'weather.tsx'))).toBe(true);
    expect(existsSync(join(toolsDir, 'checklist.tsx'))).toBe(true);
  });

  test('compass can navigate toward saved map spots', () => {
    const compass = readFileSync(join(toolsDir, 'compass.tsx'), 'utf8');

    expect(compass).toContain('OfflineMapService.listMarkers');
    expect(compass).toContain('MapLocationService.resolveUserLocation');
    expect(compass).toContain('Navigate to saved spot');
    expect(compass).toContain('bearingDegrees');
    expect(compass).toContain('formatTurnGuidance');
  });
});
