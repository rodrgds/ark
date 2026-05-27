import type { OfflineMapSearchResult } from '@/types/maps';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

const PHOTON_API_URL = 'https://photon.komoot.io/api/';
const GEOCODE_CACHE_KEY = 'maps.geocoding.cache';

type GeocodeCache = {
  [query: string]: OfflineMapSearchResult[];
};

export class GeocodingService {
  /**
   * Searches for places. If online, queries Photon (OSM).
   * If offline, relies on the cached SQLite results (if any).
   */
  static async search(query: string, limit = 10): Promise<OfflineMapSearchResult[]> {
    const normalized = query.trim().toLowerCase();
    
    try {
      const url = `${PHOTON_API_URL}?q=${encodeURIComponent(normalized)}&limit=${limit}`;
      const response = await fetch(url, { method: 'GET' });
      
      if (response.ok) {
        const data = await response.json();
        const results = this.parsePhotonResponse(data);
        await this.cacheResults(normalized, results);
        return results;
      }
    } catch (e) {
      // Offline or network error
    }

    return this.getCachedResults(normalized);
  }

  private static async getCachedResults(query: string): Promise<OfflineMapSearchResult[]> {
    try {
      const dataStr = await SettingsRepository.get(GEOCODE_CACHE_KEY);
      if (!dataStr) return [];
      const cache: GeocodeCache = JSON.parse(dataStr);
      
      // Match exact or prefix
      for (const cachedQuery of Object.keys(cache)) {
        if (cachedQuery.includes(query) || query.includes(cachedQuery)) {
          return cache[cachedQuery] || [];
        }
      }
    } catch {
      // Ignored
    }
    return [];
  }

  private static async cacheResults(query: string, results: OfflineMapSearchResult[]) {
    try {
      const dataStr = await SettingsRepository.get(GEOCODE_CACHE_KEY);
      const cache: GeocodeCache = dataStr ? JSON.parse(dataStr) : {};
      
      cache[query] = results;
      
      // Keep cache small
      const keys = Object.keys(cache);
      if (keys.length > 50) {
        delete cache[keys[0]];
      }
      
      await SettingsRepository.set(GEOCODE_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // Best effort
    }
  }

  private static parsePhotonResponse(data: any): OfflineMapSearchResult[] {
    if (!data || !data.features || !Array.isArray(data.features)) return [];
    
    return data.features.map((feature: any) => {
      const { properties, geometry } = feature;
      const [longitude, latitude] = geometry.coordinates;
      
      let subtitle = properties.city || properties.state || properties.country || '';
      if (properties.street) {
        subtitle = `${properties.street}, ${subtitle}`;
      }

      return {
        id: `photon-${properties.osm_id || Math.random().toString()}`,
        kind: 'spot',
        title: properties.name || properties.street || 'Unknown place',
        subtitle: subtitle.replace(/^, /, '').trim() || 'Location',
        latitude,
        longitude,
      };
    }).filter((r: any) => r.title !== 'Unknown place');
  }
}
