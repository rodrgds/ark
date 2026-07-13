import { expect, test, describe } from 'bun:test';
import { getMissingRegionPrompt } from './missing-region-prompt';
import type { MapPreset } from '@/constants/map-presets';

const lisbon: MapPreset = {
  id: 'pt-lisbon',
  name: 'Lisbon',
  description: 'Lisbon region',
  bounds: { north: 39.0, south: 38.0, east: -9.0, west: -10.0 },
  bbox: [-10.0, 38.0, -9.0, 39.0],
  center: [-9.5, 38.5],
  minZoom: 8,
  maxZoom: 14,
  estimatedSize: '100 MB',
  estimatedSizeMb: 100,
  level: 'region',
  tags: [],
};

describe('missing region prompt logic', () => {
  test('prompts for the best manifest region when it is not downloaded', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 38.5,
      longitude: -9.5,
      regions: [lisbon],
      downloadedRegions: [],
      zoom: 10,
    });

    expect(prompt?.id).toBe('pt-lisbon');
  });

  test('does not prompt for downloaded regions', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 38.5,
      longitude: -9.5,
      regions: [lisbon],
      downloadedRegions: [{ manifestRegionId: 'pt-lisbon', status: 'downloaded', name: 'Lisbon' }],
      zoom: 10,
    });

    expect(prompt).toBeNull();
  });

  test('does not prompt while a matching navigation graph download is active', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 38.5,
      longitude: -9.5,
      regions: [lisbon],
      downloadedRegions: [
        {
          manifestRegionId: 'pt-lisbon',
          status: 'not_downloaded',
          routingStatus: 'downloading',
          name: 'Lisbon',
        },
      ],
      zoom: 10,
    });

    expect(prompt).toBeNull();
  });

  test('prompts for a dynamic region when center is outside any predefined high-detail region', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 37.0, // outside lisbon south (38.0)
      longitude: -9.5,
      regions: [lisbon],
      downloadedRegions: [],
      zoom: 10,
    });

    expect(prompt?.id).toContain('dynamic-');
  });

  test('calling getMissingRegionPrompt twice with the same inputs returns the same result (no internal throttle)', () => {
    const input = {
      latitude: 38.5,
      longitude: -9.5,
      regions: [lisbon],
      downloadedRegions: [],
      zoom: 10,
    };

    const first = getMissingRegionPrompt(input);
    const second = getMissingRegionPrompt(input);

    expect(first?.id).toBe('pt-lisbon');
    expect(second?.id).toBe('pt-lisbon');
  });

  test('does not prompt when zoom is below the region suggest range', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 38.5,
      longitude: -9.5,
      regions: [lisbon],
      downloadedRegions: [],
      zoom: 5,
    });

    expect(prompt).toBeNull();
  });

  test('estimates zoom from viewedBounds when native zoom is not tracked', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 38.5,
      longitude: -9.5,
      regions: [lisbon],
      downloadedRegions: [],
      viewedBounds: [-9.6, 38.4, -9.4, 38.6], // tight bounds ~ zoom 10+
    });

    expect(prompt?.id).toBe('pt-lisbon');
  });
});
