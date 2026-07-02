import type { OfflineMapSearchResult } from '@/types/maps';
import { NetworkService } from '@/services/connectivity/network.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { MapCatalogRepository } from '@/services/maps/map-catalog.repository';
import { OfflinePlaceIndexService } from '@/services/maps/offline-place-index.service';
import { getRegionForCoordinate } from '@/services/maps/map-region-utils';

const PHOTON_API_URL = 'https://photon.komoot.io/api/';
const GEOCODE_CACHE_KEY = 'maps.geocoding.cache';
const REVERSE_GEOCODE_CACHE_KEY = 'maps.reverseGeocoding.cache';
const REVERSE_GEOCODE_CACHE_LIMIT = 80;
const REVERSE_GEOCODE_GRID_SIZE = 0.05;

type GeocodeCache = {
  [query: string]: OfflineMapSearchResult[];
};

type ReverseGeocodeResult = {
  name: string;
  bounds?: { west: number; south: number; east: number; north: number };
};

type ReverseGeocodeCacheEntry = ReverseGeocodeResult & {
  latitude: number;
  longitude: number;
  updatedAt: number;
};

type ReverseGeocodeCache = {
  [cell: string]: ReverseGeocodeCacheEntry;
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

    if (!(await this.isOnline())) return this.getCachedResults(normalized);

    try {
      const url = `${PHOTON_API_URL}?q=${encodeURIComponent(normalized)}&limit=${limit}`;
      const response = await fetch(url, { method: 'GET', signal });
      if (signal?.aborted) return this.getCachedResults(normalized);

      if (response.ok) {
        const data = await response.json();
        if (signal?.aborted) return this.getCachedResults(normalized);
        const results = this.parsePhotonResponse(data);
        await this.cacheResults(normalized, results);
        await OfflinePlaceIndexService.indexPhotonResults(results).catch(() => undefined);
        return results;
      }
    } catch (error) {
      if (this.isAbortError(error)) return [];
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
  ): Promise<ReverseGeocodeResult> {
    if (!(await this.isOnline())) {
      return this.getReverseGeocodeFallback(latitude, longitude);
    }
    try {
      const url = `https://photon.komoot.io/reverse?lon=${longitude}&lat=${latitude}`;
      const response = await fetch(url, { method: 'GET', signal });
      if (signal?.aborted) return this.getReverseGeocodeFallback(latitude, longitude);
      if (response.ok) {
        const data = await response.json();
        if (signal?.aborted) return this.getReverseGeocodeFallback(latitude, longitude);
        const feature = data?.features?.[0];
        if (feature?.properties) {
          const { city, state, country, name, street, county, extent } = feature.properties;

          let bestName = state || county || city || name || street || country || 'this area';
          let bounds: any = undefined;

          if (state || county) {
            const forwardUrl = `${PHOTON_API_URL}?q=${encodeURIComponent((state || county) + ' ' + country)}&layer=${state ? 'state' : 'county'}&limit=1`;
            const fwdResponse = await fetch(forwardUrl, { method: 'GET', signal });
            if (signal?.aborted) return this.getReverseGeocodeFallback(latitude, longitude);
            if (fwdResponse.ok) {
              const fwdData = await fwdResponse.json();
              if (signal?.aborted) return this.getReverseGeocodeFallback(latitude, longitude);
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
          const result = { name: bestName, bounds };
          await this.cacheReverseGeocode(latitude, longitude, result);
          return result;
        }
      }
    } catch (e) {
      if (this.isAbortError(e)) return this.getReverseGeocodeFallback(latitude, longitude);
    }
    return this.getReverseGeocodeFallback(latitude, longitude);
  }

  private static isAbortError(error: unknown) {
    return (
      (typeof DOMException !== 'undefined' &&
        error instanceof DOMException &&
        error.name === 'AbortError') ||
      (error instanceof Error && error.name === 'AbortError')
    );
  }

  private static async getCachedResults(query: string): Promise<OfflineMapSearchResult[]> {
    try {
      const dataStr = await SettingsRepository.get(GEOCODE_CACHE_KEY);
      if (!dataStr) return [];
      const cache: GeocodeCache = JSON.parse(dataStr);

      // Match exact or prefix
      for (const cachedQuery of Object.keys(cache)) {
        if (cachedQuery.includes(query) || query.includes(cachedQuery)) {
          return (cache[cachedQuery] || []).map((result) =>
            result.kind === 'place' ? { ...result, placeSource: 'cached' } : result
          );
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

  private static async getReverseGeocodeFallback(
    latitude: number,
    longitude: number
  ): Promise<ReverseGeocodeResult> {
    return (
      (await this.getCachedReverseGeocode(latitude, longitude)) ??
      (await this.getCatalogReverseGeocode(latitude, longitude)) ?? { name: 'this area' }
    );
  }

  private static async getCachedReverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<ReverseGeocodeResult | null> {
    try {
      const dataStr = await SettingsRepository.get(REVERSE_GEOCODE_CACHE_KEY);
      if (!dataStr) return null;
      const cache: ReverseGeocodeCache = JSON.parse(dataStr);
      const direct = cache[this.reverseCacheKey(latitude, longitude)];
      if (direct) return { name: direct.name, bounds: direct.bounds };

      const nearest = Object.values(cache)
        .filter((entry) => Math.abs(entry.latitude - latitude) <= REVERSE_GEOCODE_GRID_SIZE)
        .filter((entry) => Math.abs(entry.longitude - longitude) <= REVERSE_GEOCODE_GRID_SIZE)
        .sort((a, b) => b.updatedAt - a.updatedAt)[0];
      return nearest ? { name: nearest.name, bounds: nearest.bounds } : null;
    } catch {
      return null;
    }
  }

  private static async getCatalogReverseGeocode(
    latitude: number,
    longitude: number
  ): Promise<ReverseGeocodeResult | null> {
    try {
      const catalog = await MapCatalogRepository.fetchCatalog();
      const region = getRegionForCoordinate(latitude, longitude, catalog.regions);
      return region ? { name: region.name } : null;
    } catch {
      return null;
    }
  }

  private static async cacheReverseGeocode(
    latitude: number,
    longitude: number,
    result: ReverseGeocodeResult
  ) {
    if (!result.name || result.name === 'this area') return;
    try {
      const dataStr = await SettingsRepository.get(REVERSE_GEOCODE_CACHE_KEY);
      const cache: ReverseGeocodeCache = dataStr ? JSON.parse(dataStr) : {};
      cache[this.reverseCacheKey(latitude, longitude)] = {
        ...result,
        latitude,
        longitude,
        updatedAt: Date.now(),
      };
      const entries = Object.entries(cache).sort((a, b) => b[1].updatedAt - a[1].updatedAt);
      await SettingsRepository.set(
        REVERSE_GEOCODE_CACHE_KEY,
        JSON.stringify(Object.fromEntries(entries.slice(0, REVERSE_GEOCODE_CACHE_LIMIT)))
      );
    } catch {
      // Best effort; catalog fallback still keeps the prompt readable offline.
    }
  }

  private static reverseCacheKey(latitude: number, longitude: number) {
    const lat = Math.round(latitude / REVERSE_GEOCODE_GRID_SIZE) * REVERSE_GEOCODE_GRID_SIZE;
    const lon = Math.round(longitude / REVERSE_GEOCODE_GRID_SIZE) * REVERSE_GEOCODE_GRID_SIZE;
    return `${lat.toFixed(2)},${lon.toFixed(2)}`;
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
          kind: 'place',
          title: properties.name || properties.street || 'Unknown place',
          subtitle: subtitle.replace(/^, /, '').trim() || 'Location',
          latitude,
          longitude,
          placeSource: 'online',
        };
      })
      .filter((r: any) => r.title !== 'Unknown place');
  }
}
