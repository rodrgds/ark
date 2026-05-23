import type { MapCatalog, MapPreset } from '@/constants/map-presets';

const bundledCatalog = require('../../../assets/map-catalog.json') as MapCatalog;
const CATALOG_TIMEOUT_MS = 5000;

export class MapCatalogRepository {
  static getBundledCatalog() {
    return normalizeCatalog(bundledCatalog);
  }

  static async fetchCatalog() {
    const url = process.env.EXPO_PUBLIC_ARK_MAP_CATALOG_URL;
    if (!url) return this.getBundledCatalog();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CATALOG_TIMEOUT_MS);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return this.getBundledCatalog();
      const catalog = (await response.json()) as MapCatalog;
      return normalizeCatalog(catalog);
    } catch {
      return this.getBundledCatalog();
    } finally {
      clearTimeout(timeout);
    }
  }
}

function normalizeCatalog(catalog: MapCatalog): MapCatalog {
  const regions = Array.isArray(catalog.regions) ? catalog.regions.filter(isValidPreset) : [];
  return {
    version: Number.isFinite(catalog.version) ? catalog.version : 1,
    updatedAt: typeof catalog.updatedAt === 'string' ? catalog.updatedAt : '',
    source: typeof catalog.source === 'string' ? catalog.source : 'unknown',
    regions: dedupeById(regions),
  };
}

function isValidPreset(preset: MapPreset) {
  return (
    typeof preset?.id === 'string' &&
    typeof preset.name === 'string' &&
    typeof preset.description === 'string' &&
    isFiniteBounds(preset.bounds) &&
    Number.isFinite(preset.minZoom) &&
    Number.isFinite(preset.maxZoom) &&
    Array.isArray(preset.tags)
  );
}

function isFiniteBounds(bounds: MapPreset['bounds']) {
  return (
    Number.isFinite(bounds?.north) &&
    Number.isFinite(bounds.south) &&
    Number.isFinite(bounds.east) &&
    Number.isFinite(bounds.west) &&
    bounds.north > bounds.south &&
    bounds.east > bounds.west
  );
}

function dedupeById(regions: MapPreset[]) {
  const seen = new Set<string>();
  return regions.filter((region) => {
    if (seen.has(region.id)) return false;
    seen.add(region.id);
    return true;
  });
}
