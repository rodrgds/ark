import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { MapService } from '@/services/maps/map.service';
import type { MapMarker, SavedRoutePoint } from '@/types/maps';

const DEFAULT_MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

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

  static async refreshRegion(id: string) {
    const region = await MapsRepository.getRegion(id);
    if (!region) return { ok: false, reason: 'Map region not found.' };
    if (
      region.north == null ||
      region.south == null ||
      region.east == null ||
      region.west == null
    ) {
      return { ok: false, reason: 'Region bounds are incomplete.' };
    }
    const maplibre = await MapService.loadMapLibre();
    if (!maplibre) {
      await MapsRepository.updateRegionStatus(id, { status: 'failed', progress: 0 });
      return { ok: false, reason: 'MapLibre native module is unavailable in this build.' };
    }

    await MapsRepository.updateRegionStatus(id, { status: 'downloading', progress: 0 });
    try {
      const pack = await maplibre.OfflineManager.createPack(
        {
          mapStyle: region.styleUrl ?? DEFAULT_MAP_STYLE,
          bounds: [region.west, region.south, region.east, region.north],
          minZoom: region.minZoom ?? undefined,
          maxZoom: region.maxZoom ?? undefined,
          metadata: { regionId: id, name: region.name },
        },
        (_offlinePack, status) => {
          void MapsRepository.updateRegionStatus(id, {
            status: status.state === 'complete' ? 'downloaded' : 'downloading',
            progress: Math.max(0, Math.min(1, status.percentage / 100)),
            sizeBytes: status.completedResourceSize || status.completedTileSize || null,
          });
        },
        (_offlinePack, error) => {
          void MapsRepository.updateRegionStatus(id, { status: 'failed', progress: 0 });
          console.warn(error.message);
        }
      );
      await MapsRepository.updateRegionStatus(id, {
        status: 'downloaded',
        progress: 1,
        offlinePackId: pack.id,
      });
      return { ok: true };
    } catch (error) {
      await MapsRepository.updateRegionStatus(id, { status: 'failed', progress: 0 });
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Offline map download failed.',
      };
    }
  }

  static listMarkers() {
    return MapsRepository.listMarkers();
  }

  static createMarker(input: {
    title: string;
    description?: string | null;
    latitude: number;
    longitude: number;
  }) {
    return MapsRepository.createMarker(input);
  }

  static deleteMarker(id: string) {
    return MapsRepository.deleteMarker(id);
  }

  static listRoutes() {
    return MapsRepository.listRoutes();
  }

  static async createRouteFromMarkers(title: string, markers: MapMarker[]) {
    const points = markers.map<SavedRoutePoint>((marker) => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
      title: marker.title,
    }));
    return MapsRepository.createRoute({
      title,
      points,
      distanceMeters: routeDistanceMeters(points),
    });
  }

  static deleteRoute(id: string) {
    return MapsRepository.deleteRoute(id);
  }
}

function routeDistanceMeters(points: SavedRoutePoint[]) {
  return points.slice(1).reduce((total, point, index) => total + distance(points[index], point), 0);
}

function distance(a: SavedRoutePoint, b: SavedRoutePoint) {
  const earthRadiusMeters = 6371000;
  const latA = toRad(a.latitude);
  const latB = toRad(b.latitude);
  const deltaLat = toRad(b.latitude - a.latitude);
  const deltaLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}
