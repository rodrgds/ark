import { describe, expect, test } from 'bun:test';
import type { MapPreset } from '@/constants/map-presets';
import {
  findChildRegions,
  findParentRegion,
  getDownloadedRegionForCoordinate,
  getRegionForCoordinate,
  getRegionsForBoundingBox,
  isCoordinateInsideRegion,
  isPresetDownloaded,
  sortRegionsByDistanceFromCoordinate,
} from '@/services/maps/map-region-utils';

const portugal = region({
  id: 'pt',
  name: 'Portugal',
  level: 'country',
  bbox: [-9.7, 36.8, -6.1, 42.3],
});
const lisbon = region({
  id: 'pt-lisbon',
  name: 'Lisbon',
  parentId: 'pt',
  level: 'city',
  bbox: [-9.55, 38.42, -8.72, 39.05],
});
const porto = region({
  id: 'pt-porto',
  name: 'Porto',
  parentId: 'pt',
  level: 'city',
  bbox: [-8.9, 40.85, -7.9, 41.4],
});

describe('map region utilities', () => {
  test('matches coordinates inside bbox boundaries', () => {
    expect(isCoordinateInsideRegion(38.72, -9.14, lisbon)).toBe(true);
    expect(isCoordinateInsideRegion(41.15, -8.61, lisbon)).toBe(false);
  });

  test('returns the smallest matching manifest region for a coordinate', () => {
    expect(getRegionForCoordinate(38.72, -9.14, [portugal, lisbon])?.id).toBe('pt-lisbon');
    expect(getRegionForCoordinate(37.02, -8.91, [portugal, lisbon])?.id).toBe('pt');
  });

  test('finds regions that intersect a viewed bounding box', () => {
    const matches = getRegionsForBoundingBox([-9.4, 38.55, -8.9, 38.9], [portugal, lisbon, porto]);

    expect(matches.map((match) => match.id)).toEqual(['pt-lisbon', 'pt']);
  });

  test('finds the downloaded region covering a coordinate', () => {
    const downloaded = getDownloadedRegionForCoordinate(38.72, -9.14, [
      {
        id: 'wide',
        status: 'downloaded',
        west: -10,
        south: 35,
        east: -5,
        north: 43,
      },
      {
        id: 'lisbon',
        status: 'downloaded',
        west: -9.55,
        south: 38.42,
        east: -8.72,
        north: 39.05,
      },
    ]);

    expect(downloaded?.id).toBe('lisbon');
  });

  test('sorts manifest regions by distance from a coordinate', () => {
    const matches = sortRegionsByDistanceFromCoordinate([porto, lisbon], 38.72, -9.14);

    expect(matches.map((match) => match.id)).toEqual(['pt-lisbon', 'pt-porto']);
  });

  test('finds parent and child regions', () => {
    expect(findChildRegions('pt', [portugal, lisbon, porto]).map((match) => match.id)).toEqual([
      'pt-lisbon',
      'pt-porto',
    ]);
    expect(findParentRegion('pt-lisbon', [portugal, lisbon, porto])?.id).toBe('pt');
  });

  test('matches downloaded presets by manifest id before display name', () => {
    expect(
      isPresetDownloaded(lisbon, [
        {
          id: 'local-random-id',
          manifestRegionId: 'pt-lisbon',
          name: 'Renamed Lisbon pack',
          status: 'downloaded',
        },
      ])
    ).toBe(true);
  });
});

function region(input: {
  id: string;
  name: string;
  parentId?: string;
  level: MapPreset['level'];
  bbox: [number, number, number, number];
}): MapPreset {
  const [west, south, east, north] = input.bbox;
  return {
    id: input.id,
    name: input.name,
    description: input.name,
    parentId: input.parentId,
    level: input.level,
    bounds: { north, south, east, west },
    bbox: input.bbox,
    center: [(west + east) / 2, (south + north) / 2],
    minZoom: 6,
    maxZoom: 13,
    estimatedSize: '100 MB',
    estimatedSizeMb: 100,
    tags: [],
  };
}
