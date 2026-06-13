import type { OfflineMapSearchResult } from '@/types/maps';
import { NetworkService } from '@/services/connectivity/network.service';
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
  static async search(
    query: string,
    limit = 10,
    signal?: AbortSignal
  ): Promise<OfflineMapSearchResult[]> {
    const normalized = query.trim().toLowerCase();

    if (!(await this.isOnline())) {
      return this.getCachedResults(normalized);
    }

    try {
      const url = `${PHOTON_API_URL}?q=${encodeURIComponent(normalized)}&limit=${limit}`;
      const response = await fetch(url, { method: 'GET', signal });
      if (signal?.aborted) return this.getCachedResults(normalized);

      if (response.ok) {
        const data = await response.json();
        if (signal?.aborted) return this.getCachedResults(normalized);
        const results = this.parsePhotonResponse(data);
        await this.cacheResults(normalized, results);
        return results;
      }
    } catch (e) {
      if (this.isAbortError(e)) return [];
      // Offline or network error
    }

    return this.getCachedResults(normalized);
  }

  private static async isOnline(): Promise<boolean> {
    try {
      const state = await NetworkService.getState();
      return NetworkService.isOnline(state) === true;
    } catch {
      return true;
    }
  }

  static async reverseGeocode(
    latitude: number,
    longitude: number,
    signal?: AbortSignal
  ): Promise<{
    name: string;
    bounds?: { west: number; south: number; east: number; north: number };
  }> {
    if (!(await this.isOnline())) {
      return { name: 'this area' };
    }
    try {
      const url = `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`;
      const response = await fetch(url, { method: 'GET', signal });
      if (signal?.aborted) return { name: 'this area' };
      if (response.ok) {
        const data = await response.json();
        if (signal?.aborted) return { name: 'this area' };
        const feature = data?.features?.[0];
        if (feature?.properties) {
          const { city, state, country, name, street, county, extent } = feature.properties;

          let bestName = state || county || city || name || street || country || 'this area';
          let bounds: any = undefined;

          if (state || county) {
            const forwardUrl = `${PHOTON_API_URL}?q=${encodeURIComponent((state || county) + ' ' + country)}&layer=${state ? 'state' : 'county'}&limit=1`;
            const fwdResponse = await fetch(forwardUrl, { method: 'GET', signal });
            if (signal?.aborted) return { name: bestName, bounds };
            if (fwdResponse.ok) {
              const fwdData = await fwdResponse.json();
              if (signal?.aborted) return { name: bestName, bounds };
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
    } catch (e) {
      if (this.isAbortError(e)) return { name: 'this area' };
    }
    return { name: 'this area' };
  }

  private static isAbortError(error: unknown) {
    return error instanceof DOMException && error.name === 'AbortError';
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

    return data.features
      .map((feature: any) => {
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
      })
      .filter((r: any) => r.title !== 'Unknown place');
  }
}
