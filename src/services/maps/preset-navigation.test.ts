import { describe, expect, test } from 'bun:test';
import type { MapPreset } from '@/constants/map-presets';
import {
  formatPresetTotalSize,
  presetIncludesNavigation,
  presetTotalSizeMb,
  routingStatusLabel,
} from '@/services/maps/preset-navigation';
import type { MapRegion } from '@/types/maps';

const preset = (overrides: Partial<MapPreset>): MapPreset => ({
  id: 'pt-lisbon-south',
  name: 'Lisbon and South Portugal',
  description: 'Southern mainland coverage.',
  level: 'region',
  bounds: { north: 39.45, south: 36.85, east: -6.95, west: -9.55 },
  bbox: [-9.55, 36.85, -6.95, 39.45],
  center: [-8.25, 38.15],
  minZoom: 7,
  maxZoom: 14,
  estimatedSize: '240-560 MB',
  estimatedSizeMb: 240,
  routingSizeMb: 140,
  routingPackUrl:
    'https://github.com/rodrgds/ark/releases/download/routing-v1/pt-lisbon-south.valhalla.tar',
  routingDataVersion: 'osm-2026-05',
  tags: ['Portugal', 'Lisbon'],
  ...overrides,
});

const region = (overrides: Partial<MapRegion>): MapRegion => ({
  id: 'region-1',
  name: 'Lisbon and South Portugal',
  provider: 'maplibre',
  status: 'downloaded',
  progress: 1,
  routingStatus: 'ready',
  routingProgress: 1,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('preset navigation helpers', () => {
  test('presetIncludesNavigation reflects routingPackUrl presence', () => {
    expect(presetIncludesNavigation(preset({}))).toBe(true);
    expect(presetIncludesNavigation(preset({ routingPackUrl: undefined }))).toBe(false);
  });

  test('presetTotalSizeMb sums map + routing when navigation is advertised', () => {
    expect(presetTotalSizeMb(preset({}))).toBe(380);
    expect(presetTotalSizeMb(preset({ routingSizeMb: undefined }))).toBe(240);
    expect(presetTotalSizeMb(preset({ routingPackUrl: undefined }))).toBe(240);
  });

  test('formatPresetTotalSize surfaces the combined total', () => {
    expect(formatPresetTotalSize(preset({}))).toBe('Map + navigation: 380 MB');
    expect(formatPresetTotalSize(preset({ routingPackUrl: undefined }))).toBe('About 240 MB');
  });
});

describe('routingStatusLabel', () => {
  test('returns a human label for each routing state', () => {
    expect(routingStatusLabel(region({ routingStatus: 'ready' }))).toBe('navigation ready');
    expect(
      routingStatusLabel(region({ routingStatus: 'downloading', routingProgress: 0.42 }))
    ).toBe('navigation 42%');
    expect(routingStatusLabel(region({ routingStatus: 'queued' }))).toBe('navigation queued');
    expect(routingStatusLabel(region({ routingStatus: 'paused' }))).toBe('navigation paused');
    expect(routingStatusLabel(region({ routingStatus: 'failed' }))).toBe('navigation failed');
    expect(routingStatusLabel(region({ routingStatus: 'not_downloaded' }))).toBeNull();
  });
});
