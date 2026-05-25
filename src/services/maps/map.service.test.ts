import { describe, expect, test } from 'bun:test';
import { MapService } from '@/services/maps/map.service';
import { sizeFromPackStatus } from '@/services/maps/offline-map.service';

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

  test('uses a local low-detail overview style for the default map shell', () => {
    const style = MapService.getOverviewStyle('oled');

    expect(typeof style).toBe('object');
    expect(style.sources).toEqual({});
    expect(style.layers.map((layer) => layer.type)).toEqual(['background']);
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

  test('counts native offline map resources and tiles as map storage', () => {
    expect(
      sizeFromPackStatus({
        completedResourceSize: 40 * 1024 * 1024,
        completedTileSize: 104 * 1024 * 1024,
      })
    ).toBe(144 * 1024 * 1024);
    expect(sizeFromPackStatus({ completedResourceSize: 0, completedTileSize: 0 })).toBeNull();
  });
});
