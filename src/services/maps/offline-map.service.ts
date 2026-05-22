import { MapsRepository } from '@/services/db/repositories/maps.repo';

export class OfflineMapService {
  static async createRegionDownload(input: {
    name: string;
    bounds?: { north: number; south: number; east: number; west: number };
    minZoom?: number;
    maxZoom?: number;
    styleUrl?: string;
  }) {
    return MapsRepository.createRegion({
      name: input.name,
      north: input.bounds?.north,
      south: input.bounds?.south,
      east: input.bounds?.east,
      west: input.bounds?.west,
      minZoom: input.minZoom,
      maxZoom: input.maxZoom,
      styleUrl: input.styleUrl,
    });
  }

  static listRegions() {
    return MapsRepository.listRegions();
  }

  static deleteRegion(id: string) {
    return MapsRepository.deleteRegion(id);
  }

  static async refreshRegion(_id: string) {
    return {
      ok: false,
      reason: 'MapLibre OfflineManager requires a native development build.',
    };
  }
}
