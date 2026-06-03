import { LOCAL_MAP_REGION_MANIFEST } from '../data/mapRegionManifest.local';
import type { MapRegion } from '../types/mapRegions';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

const CACHED_MANIFEST_KEY = 'maps.manifest.cached';
const MANIFEST_TIMEOUT_MS = 5000;

export class MapRegionManifestService {
  private static cachedManifest: MapRegion[] | null = null;

  static getLocalFallbackManifest(): MapRegion[] {
    return LOCAL_MAP_REGION_MANIFEST;
  }

  static async getMapRegionManifest(): Promise<MapRegion[]> {
    if (this.cachedManifest) {
      return this.cachedManifest;
    }

    // Try to load cached manifest from database settings
    try {
      const cachedStr = await SettingsRepository.get(CACHED_MANIFEST_KEY);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr) as MapRegion[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.cachedManifest = parsed;
          return parsed;
        }
      }
    } catch {
      // Fall through to fallback
    }

    return LOCAL_MAP_REGION_MANIFEST;
  }

  static async refreshMapRegionManifest(): Promise<void> {
    const url = process.env.EXPO_PUBLIC_ARK_MAP_MANIFEST_URL;
    if (!url) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), MANIFEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        this.cachedManifest = data as MapRegion[];
        await SettingsRepository.set(CACHED_MANIFEST_KEY, JSON.stringify(data));
      }
    } catch {
      // Fail silently, use local/cached fallback
    } finally {
      clearTimeout(timeout);
    }
  }

  static clearCacheForTests() {
    this.cachedManifest = null;
  }
}
