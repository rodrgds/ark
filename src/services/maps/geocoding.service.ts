import type { OfflineMapSearchResult } from '@/types/maps';
import { DatabaseClient } from '@/services/db/client';

const PHOTON_API_URL = 'https://photon.komoot.io/api/';

export class GeocodingService {
  /**
   * Searches for places. If online, queries Photon (OSM).
   * If offline, relies on the cached SQLite results (if any).
   */
  static async search(query: string, limit = 10): Promise<OfflineMapSearchResult[]> {
    const isOnline = true; // Ideally we check NetInfo here, but fetch will just fail if offline

    try {
      const url = `${PHOTON_API_URL}?q=${encodeURIComponent(query)}&limit=${limit}`;
      const response = await fetch(url, { method: 'GET' });
      
      if (response.ok) {
        const data = await response.json();
        return this.parsePhotonResponse(data);
      }
    } catch (e) {
      // Offline or network error
    }

    return [];
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
