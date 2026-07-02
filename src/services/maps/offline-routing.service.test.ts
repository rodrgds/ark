import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { estimatedBundledRoutingPackBytesForRegion } from '@/services/maps/routing-storage';

describe('estimatedBundledRoutingPackBytesForRegion', () => {
  test('uses the routing graph size from the preset catalog', () => {
    expect(
      estimatedBundledRoutingPackBytesForRegion({
        manifestRegionId: 'pt-portugal-overview',
        name: 'Portugal Mainland',
      })
    ).toBe(523 * 1024 * 1024);
  });

  test('returns null when catalog metadata is missing', () => {
    expect(
      estimatedBundledRoutingPackBytesForRegion({
        manifestRegionId: 'custom-region',
        name: 'Custom Region',
      })
    ).toBeNull();
  });
});

describe('offline route geometry safety', () => {
  test('rejects routed geometry that is nowhere near the requested endpoints', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/services/maps/offline-routing.service.ts'),
      'utf8'
    );

    expect(source).toContain('ROUTE_ENDPOINT_TOLERANCE_METERS = 2_000');
    expect(source).toContain('normalizeRouteGeometry(result.geometry)');
    expect(source).toContain(
      'routeGeometryMatchesEndpoints(geometry, input.origin, input.destination)'
    );
    expect(source).toContain('route geometry outside the requested area');
    expect(source).toContain(
      'routeGeometryMatchesEndpoints(session.route.geometry, location, session.destination)'
    );
    expect(source).toContain('lastReroutedAt: Date.now()');
  });
});
