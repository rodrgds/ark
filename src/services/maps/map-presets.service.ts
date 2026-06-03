import type { MapCatalog, MapPreset } from '@/constants/map-presets';
import { MapCatalogRepository } from '@/services/maps/map-catalog.repository';
import {
  findChildRegions,
  findParentRegion,
  getRegionForCoordinate,
  getRegionsForBoundingBox,
  isCoordinateInsideRegion,
  sortRegionsByDistanceFromCoordinate,
} from '@/services/maps/map-region-utils';
import { getMapRegionUpdateState } from '@/services/maps/map-region-updates';
import type { MapRegion } from '@/types/maps';

let activeCatalog = MapCatalogRepository.getBundledCatalog();

export class MapPresetsService {
  static listPresets() {
    return activeCatalog.regions;
  }

  static getCatalogMeta() {
    return {
      version: activeCatalog.version,
      schemaVersion: activeCatalog.schemaVersion,
      updatedAt: activeCatalog.updatedAt,
      generatedAt: activeCatalog.generatedAt,
      expiresAt: activeCatalog.expiresAt,
      source: activeCatalog.source,
      sourceUrl: activeCatalog.sourceUrl,
      fetchedAt: activeCatalog.fetchedAt,
      verifiedSha256: activeCatalog.verifiedSha256,
      count: activeCatalog.regions.length,
    };
  }

  static async refreshCatalog() {
    activeCatalog = await MapCatalogRepository.fetchCatalog();
    return this.getCatalogMeta();
  }

  static useCatalogForTests(catalog: MapCatalog) {
    activeCatalog = catalog;
  }

  static resetCatalogForTests() {
    activeCatalog = MapCatalogRepository.getBundledCatalog();
  }

  static search(query: string, limit = 60) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return activeCatalog.regions.slice(0, limit);
    return activeCatalog.regions
      .map((preset) => ({ preset, score: scorePreset(preset, normalized) }))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score || area(a.preset) - area(b.preset))
      .map((result) => result.preset)
      .slice(0, limit);
  }

  static getRegionForCoordinate(latitude: number, longitude: number) {
    return getRegionForCoordinate(latitude, longitude, activeCatalog.regions);
  }

  static getRegionsForBoundingBox(bbox: [number, number, number, number]) {
    return getRegionsForBoundingBox(bbox, activeCatalog.regions);
  }

  static isCoordinateInsideRegion(latitude: number, longitude: number, region: MapPreset) {
    return isCoordinateInsideRegion(latitude, longitude, region);
  }

  static sortRegionsByDistanceFromCoordinate(latitude: number, longitude: number) {
    return sortRegionsByDistanceFromCoordinate(activeCatalog.regions, latitude, longitude);
  }

  static findChildRegions(parentId: string) {
    return findChildRegions(parentId, activeCatalog.regions);
  }

  static findParentRegion(regionId: string) {
    return findParentRegion(regionId, activeCatalog.regions);
  }

  static findPresetForRegion(region: Pick<MapRegion, 'manifestRegionId' | 'name'>) {
    return activeCatalog.regions.find(
      (preset) => preset.id === region.manifestRegionId || preset.name === region.name
    );
  }

  static getRegionUpdateState(region: MapRegion) {
    return getMapRegionUpdateState(
      region,
      this.findPresetForRegion(region),
      activeCatalog.version
    );
  }

  static recommendedForLocation(location?: { latitude: number; longitude: number } | null) {
    const regions = activeCatalog.regions;
    if (!location) {
      const seen = new Set<string>();
      return regions
        .filter((preset) => preset.tags.includes('recommended'))
        .concat(regions)
        .filter((preset) => uniquePreset(preset, seen))
        .slice(0, 6);
    }
    const containing = regions.filter((preset) =>
      isCoordinateInsideRegion(location.latitude, location.longitude, preset)
    );
    if (containing.length) {
      return containing
        .sort((a, b) => area(a) - area(b))
        .concat(regions.filter((preset) => !containing.includes(preset)))
        .slice(0, 6);
    }
    return sortRegionsByDistanceFromCoordinate(regions, location.latitude, location.longitude).slice(0, 6);
  }
}

function uniquePreset(preset: MapPreset, seen: Set<string>) {
  if (seen.has(preset.id)) return false;
  seen.add(preset.id);
  return true;
}

function scorePreset(preset: MapPreset, query: string) {
  const fields = [preset.name, preset.description, ...preset.tags].map((value) =>
    value.toLowerCase()
  );
  let score = 0;
  for (const field of fields) {
    if (field === query) score += 20;
    else if (field.startsWith(query)) score += 12;
    else if (field.includes(query)) score += 6;
  }
  return score;
}

function area(preset: MapPreset) {
  return (preset.bounds.north - preset.bounds.south) * (preset.bounds.east - preset.bounds.west);
}
