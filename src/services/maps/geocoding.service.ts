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

  static async reverseGeocode(latitude: number, longitude: number): Promise<{ name: string; bounds?: { west: number; south: number; east: number; north: number } }> {
    try {
      const url = `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`;
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        const feature = data?.features?.[0];
        if (feature?.properties) {
          const { city, state, country, name, street, county, extent } = feature.properties;
          
          let bestName = state || county || city || name || street || country || 'this area';
          let bounds: any = undefined;
          
          if (state || county) {
             const forwardUrl = `${PHOTON_API_URL}?q=${encodeURIComponent((state || county) + ' ' + country)}&layer=${state ? 'state' : 'county'}&limit=1`;
             const fwdResponse = await fetch(forwardUrl, { method: 'GET' });
             if (fwdResponse.ok) {
                const fwdData = await fwdResponse.json();
                const fwdFeature = fwdData?.features?.[0];
                if (fwdFeature?.properties?.extent && fwdFeature.properties.extent.length === 4) {
                   const e = fwdFeature.properties.extent;
                   bounds = { west: e[0], south: e[1], east: e[2], north: e[3] };
                   bestName = fwdFeature.properties.name || bestName;
                }
             }
          }
          
          if (extent && extent.length === 4) {
             bounds = {
               west: Math.min(extent[0], extent[2]),
               south: Math.min(extent[1], extent[3]),
               east: Math.max(extent[0], extent[2]),
               north: Math.max(extent[1], extent[3]),
             };
          }
          return { name: bestName, bounds };
        }
      }
    } catch {
      // Ignored
    }
    return { name: 'this area' };
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
