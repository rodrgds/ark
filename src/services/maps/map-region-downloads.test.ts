import { describe, expect, test } from 'bun:test';
import type { MapPreset } from '@/constants/map-presets';
import { presetToRegionDownloadInput } from '@/services/maps/map-region-downloads';

describe('map preset download mapping', () => {
  test('carries manifest metadata into local region downloads', () => {
    const input = presetToRegionDownloadInput(
      region({
        id: 'pt-lisbon-field-area',
        styleUrl: 'https://maps.example.test/style.json',
        tileUrlTemplate: 'https://maps.example.test/{z}/{x}/{y}.pbf',
        packUrl: 'https://maps.example.test/pt-lisbon.pmtiles',
        packFormat: 'pmtiles',
        dataVersion: '2026-05',
        checksumSha256: 'a'.repeat(64),
        checksumSha256Url: 'https://maps.example.test/pt-lisbon.pmtiles.sha256',
        updatedAt: '2026-05-24',
      }),
      { catalogVersion: 12, theme: 'oled' }
    );

    expect(input.manifestRegionId).toBe('pt-lisbon-field-area');
    expect(input.manifestVersion).toBe(12);
    expect(input.styleUrl).toBe('https://maps.example.test/style.json');
    expect(input.packFormat).toBe('pmtiles');
    expect(input.packUrl).toBe('https://maps.example.test/pt-lisbon.pmtiles');
    expect(input.dataVersion).toBe('2026-05');
    expect(input.checksumSha256).toBe('a'.repeat(64));
    expect(input.checksumSha256Url).toBe('https://maps.example.test/pt-lisbon.pmtiles.sha256');
    expect(input.regionUpdatedAt).toBe('2026-05-24');
  });

  test('uses the themed MapLibre style when the manifest has no override', () => {
    const input = presetToRegionDownloadInput(region({ id: 'pt-portugal-overview' }), {
      catalogVersion: 12,
      theme: 'light',
    });

    expect(input.styleUrl).toBe('https://tiles.openfreemap.org/styles/liberty');
  });
});

function region(input: Partial<MapPreset> & { id: string }): MapPreset {
  return {
    id: input.id,
    name: 'Lisbon field area',
    description: 'Compact operating area for Lisbon.',
    countryCode: 'PT',
    level: 'city',
    bounds: { north: 39.05, south: 38.42, east: -8.72, west: -9.55 },
    bbox: [-9.55, 38.42, -8.72, 39.05],
    center: [-9.14, 38.72],
    minZoom: 8,
    maxZoom: 15,
    estimatedSize: '180-420 MB',
    estimatedSizeMb: 420,
    tags: ['Portugal', 'Lisbon'],
    ...input,
  };
}
