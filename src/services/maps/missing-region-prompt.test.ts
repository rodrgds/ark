import { describe, expect, test } from 'bun:test';
import type { MapPreset } from '@/constants/map-presets';
import {
  createMissingRegionPromptState,
  dismissMissingRegionPrompt,
  getMissingRegionPrompt,
  markMissingRegionPromptShown,
} from '@/services/maps/missing-region-prompt';

const lisbon = region('pt-lisbon', 'Lisbon field area', [-9.55, 38.42, -8.72, 39.05]);

describe('missing region prompt logic', () => {
  test('prompts for the best manifest region when it is not downloaded', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 38.72,
      longitude: -9.14,
      regions: [lisbon],
      downloadedRegions: [],
      state: createMissingRegionPromptState(),
      now: 10_000,
    });

    expect(prompt?.id).toBe('pt-lisbon');
  });

  test('does not prompt for downloaded regions', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 38.72,
      longitude: -9.14,
      regions: [lisbon],
      downloadedRegions: [
        {
          name: 'Lisbon field area',
          status: 'downloaded',
          west: -9.55,
          south: 38.42,
          east: -8.72,
          north: 39.05,
        },
      ],
      state: createMissingRegionPromptState(),
      now: 10_000,
    });

    expect(prompt).toBeNull();
  });

  test('prompts for an undownloaded region visible inside the map bounds', () => {
    const prompt = getMissingRegionPrompt({
      latitude: 38.2,
      longitude: -9.7,
      viewedBounds: [-9.8, 38.2, -9.3, 38.6],
      regions: [lisbon],
      downloadedRegions: [],
      state: createMissingRegionPromptState(),
      now: 10_000,
    });

    expect(prompt?.id).toBe('pt-lisbon');
  });

  test('throttles repeated prompts for the same region', () => {
    const state = markMissingRegionPromptShown(createMissingRegionPromptState(), lisbon.id, 10_000);
    const prompt = getMissingRegionPrompt({
      latitude: 38.72,
      longitude: -9.14,
      regions: [lisbon],
      downloadedRegions: [],
      state,
      now: 20_000,
      throttleMs: 60_000,
    });

    expect(prompt).toBeNull();
  });

  test('honors session dismissals', () => {
    const state = dismissMissingRegionPrompt(createMissingRegionPromptState(), lisbon.id);
    const prompt = getMissingRegionPrompt({
      latitude: 38.72,
      longitude: -9.14,
      regions: [lisbon],
      downloadedRegions: [],
      state,
      now: 120_000,
    });

    expect(prompt).toBeNull();
  });
});

function region(id: string, name: string, bbox: [number, number, number, number]): MapPreset {
  const [west, south, east, north] = bbox;
  return {
    id,
    name,
    description: name,
    level: 'city',
    bounds: { north, south, east, west },
    bbox,
    center: [(west + east) / 2, (south + north) / 2],
    minZoom: 8,
    maxZoom: 15,
    estimatedSize: '180-420 MB',
    estimatedSizeMb: 420,
    tags: [],
  };
}
