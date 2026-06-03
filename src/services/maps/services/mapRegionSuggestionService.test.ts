import { describe, expect, test } from 'bun:test';
import { LOCAL_MAP_REGION_MANIFEST } from '../data/mapRegionManifest.local';
import { getBestMissingRegionSuggestion } from './mapRegionSuggestionService';

describe('MapRegionSuggestionService', () => {
  const regions = LOCAL_MAP_REGION_MANIFEST;

  // Porto center: latitude = 41.4, longitude = -8.275
  const portoCenter = { latitude: 41.4, longitude: -8.275 };
  // Portugal center (outside Porto bbox): latitude = 39.55, longitude = -7.9
  const portugalCenter = { latitude: 39.55, longitude: -7.9 };
  // Madrid center: latitude = 40.4, longitude = -3.8
  const madridCenter = { latitude: 40.4, longitude: -3.8 };
  // Middle of the Atlantic — no region should match
  const atlanticCenter = { latitude: 38.0, longitude: -25.0 };

  test('Center in Porto, high zoom, nothing downloaded -> suggests Porto only', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: portoCenter, zoom: 10 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.id).toBe('pt-porto-north');
  });

  test('Center in Porto, high zoom, Porto dismissed -> returns null (does not suggest Portugal)', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: portoCenter, zoom: 10 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(['pt-porto-north']),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).toBeNull();
  });

  test('Center in Porto, high zoom, Porto downloaded -> returns null (does not suggest Portugal)', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: portoCenter, zoom: 10 },
      regions,
      downloadedRegionIds: new Set(['pt-porto-north']),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).toBeNull();
  });

  test('Center in Porto, medium zoom (6), nothing downloaded -> suggests Portugal because Porto is outside suggest zoom (8-18)', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: portoCenter, zoom: 6 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.id).toBe('pt-portugal-overview');
  });

  test('Center in Portugal (but outside Porto), zoomed out (zoom 7) -> suggests Portugal', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: portugalCenter, zoom: 7 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion!.id).toBe('pt-portugal-overview');
  });

  test('Center in Iberia (e.g. Madrid), zoomed far out (zoom 4) -> does not suggest Western Europe or Iberia because autoSuggest is false', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: madridCenter, zoom: 4 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).toBeNull();
  });

  test('Parent and child both match at high zoom -> child wins', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: portoCenter, zoom: 10 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion!.id).toBe('pt-porto-north');
  });

  test('Region currently downloading -> ignored', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: portoCenter, zoom: 10 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(['pt-porto-north']),
    });

    expect(suggestion).toBeNull();
  });

  test('Dismissed child does not cause parent fallback for same viewport', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: portoCenter, zoom: 10 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(['pt-porto-north']),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).toBeNull();
  });

  test('Center in the Atlantic (no region contains it) -> returns null regardless of zoom', () => {
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: atlanticCenter, zoom: 8 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).toBeNull();
  });

  test('Center far from any region does not suggest a region whose bbox merely overlaps the viewed area', () => {
    // The user is in the middle of nowhere (Atlantic Ocean).
    // Even if a hypothetical wide viewport would geographically intersect with Portugal or Lisbon,
    // the algorithm should NOT suggest those because the center is outside all region bboxes.
    const suggestion = getBestMissingRegionSuggestion({
      viewport: { center: { latitude: 35.0, longitude: -20.0 }, zoom: 5 },
      regions,
      downloadedRegionIds: new Set(),
      dismissedRegionIds: new Set(),
      activeDownloadRegionIds: new Set(),
    });

    expect(suggestion).toBeNull();
  });
});
