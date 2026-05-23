import { describe, expect, test } from 'bun:test';
import { MapService } from '@/services/maps/map.service';

describe('MapService runtime status', () => {
  test('does not report MapLibre available before the dynamic native check completes', () => {
    const status = MapService.getRuntimeStatus(null, false);

    expect(status.available).toBe(false);
    expect(status.checking).toBe(true);
  });

  test('reports unavailable when the package is installed but native runtime is missing', () => {
    const status = MapService.getRuntimeStatus(null, true);

    expect(status.available).toBe(false);
    expect(status.checking).toBe(false);
    expect(status.reason).toContain('native runtime is not loaded');
  });

  test('reports available only after a module is actually loaded', () => {
    const status = MapService.getRuntimeStatus({} as never, true);

    expect(status.available).toBe(true);
    expect(status.checking).toBe(false);
  });

  test('does not use MapLibre demo tiles as the built-in style', () => {
    expect(MapService.isDemoStyle()).toBe(false);
    expect(MapService.isDemoStyle('https://demotiles.maplibre.org/style.json')).toBe(true);
    expect(MapService.isDemoStyle('https://example.test/style.json')).toBe(false);
  });

  test('guards MapLibre network mode behind the native manager', () => {
    const calls: boolean[] = [];

    MapService.setNetworkConnected(
      {
        NetworkManager: {
          setConnected: (connected: boolean) => calls.push(connected),
        },
      } as never,
      false
    );
    MapService.setNetworkConnected(null, true);

    expect(calls).toEqual([false]);
  });
});
