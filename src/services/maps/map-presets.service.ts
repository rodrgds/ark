import type { MapCatalog, MapPreset } from '@/constants/map-presets';
import { MapCatalogRepository } from '@/services/maps/map-catalog.repository';

let activeCatalog = MapCatalogRepository.getBundledCatalog();

export class MapPresetsService {
  static listPresets() {
    return activeCatalog.regions;
  }

  static getCatalogMeta() {
    return {
      version: activeCatalog.version,
      updatedAt: activeCatalog.updatedAt,
      source: activeCatalog.source,
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
    const containing = regions.filter((preset) => contains(preset, location));
    if (containing.length) {
      return containing
        .sort((a, b) => area(a) - area(b))
        .concat(regions.filter((preset) => !containing.includes(preset)))
        .slice(0, 6);
    }
    return regions
      .slice()
      .sort((a, b) => distanceToCenter(a, location) - distanceToCenter(b, location))
      .slice(0, 6);
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

function contains(preset: MapPreset, location: { latitude: number; longitude: number }) {
  return (
    location.latitude <= preset.bounds.north &&
    location.latitude >= preset.bounds.south &&
    location.longitude <= preset.bounds.east &&
    location.longitude >= preset.bounds.west
  );
}

function area(preset: MapPreset) {
  return (preset.bounds.north - preset.bounds.south) * (preset.bounds.east - preset.bounds.west);
}

function distanceToCenter(preset: MapPreset, location: { latitude: number; longitude: number }) {
  const latitude = (preset.bounds.north + preset.bounds.south) / 2;
  const longitude = (preset.bounds.east + preset.bounds.west) / 2;
  return Math.hypot(latitude - location.latitude, longitude - location.longitude);
}
