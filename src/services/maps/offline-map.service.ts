import { MapsRepository } from '@/services/db/repositories/maps.repo';
import { MapService } from '@/services/maps/map.service';
import type { MapMarker, OfflineMapSearchResult, SavedRoutePoint } from '@/types/maps';

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
          mapStyle: region.styleUrl ?? MapService.getDefaultStyleUrl(),
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

  static async createRegionFromMarkers(input: {
    name: string;
    markers: MapMarker[];
    paddingKm?: number;
    minZoom?: number;
    maxZoom?: number;
  }) {
    if (input.markers.length < 2) {
      throw new Error('Save at least two spots before planning a map region.');
    }
    return this.createRegionDownload({
      name: input.name,
      bounds: boundsForMarkers(input.markers, input.paddingKm ?? 5),
      minZoom: input.minZoom ?? 8,
      maxZoom: input.maxZoom ?? 15,
    });
  }

  static async createRegionFromBounds(input: {
    name: string;
    north: number;
    south: number;
    east: number;
    west: number;
    minZoom?: number;
    maxZoom?: number;
  }) {
    const bounds = validateBounds(input);
    const zoom = validateZoom(input.minZoom ?? 6, input.maxZoom ?? 13);
    return this.createRegionDownload({
      name: input.name.trim() || 'Custom offline region',
      bounds,
      minZoom: zoom.minZoom,
      maxZoom: zoom.maxZoom,
    });
  }

  static deleteMarker(id: string) {
    return MapsRepository.deleteMarker(id);
  }

  static listRoutes() {
    return MapsRepository.listRoutes();
  }

  static async searchOffline(query: string, limit = 12): Promise<OfflineMapSearchResult[]> {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return [];
    const [markers, regions, routes] = await Promise.all([
      MapsRepository.listMarkers(),
      MapsRepository.listRegions(),
      MapsRepository.listRoutes(),
    ]);

    const markerResults = markers
      .filter((marker) => matches(normalized, marker.title, marker.description))
      .map<OfflineMapSearchResult>((marker) => ({
        id: marker.id,
        kind: 'spot',
        title: marker.title,
        subtitle: marker.description || formatPoint(marker.latitude, marker.longitude),
        latitude: marker.latitude,
        longitude: marker.longitude,
      }));

    const regionResults = regions
      .filter((region) => matches(normalized, region.name, region.status, region.provider))
      .map<OfflineMapSearchResult>((region) => {
        const center = centerForBounds(region);
        return {
          id: region.id,
          kind: 'region',
          title: region.name,
          subtitle: `${region.status.replace('_', ' ')} · Zoom ${region.minZoom ?? '-'}-${
            region.maxZoom ?? '-'
          }`,
          latitude: center?.latitude ?? null,
          longitude: center?.longitude ?? null,
        };
      });

    const routeResults = routes
      .filter((route) =>
        matches(
          normalized,
          route.title,
          ...route.points.map((point) => point.title).filter((title): title is string => !!title)
        )
      )
      .map<OfflineMapSearchResult>((route) => ({
        id: route.id,
        kind: 'route',
        title: route.title,
        subtitle: `${route.points.length} points${
          route.distanceMeters ? ` · ${(route.distanceMeters / 1000).toFixed(1)} km` : ''
        }`,
        latitude: route.points[0]?.latitude ?? null,
        longitude: route.points[0]?.longitude ?? null,
      }));

    return [...markerResults, ...regionResults, ...routeResults].slice(0, limit);
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

function boundsForMarkers(markers: MapMarker[], paddingKm: number) {
  const latitudes = markers.map((marker) => marker.latitude);
  const longitudes = markers.map((marker) => marker.longitude);
  const centerLatitude = (Math.min(...latitudes) + Math.max(...latitudes)) / 2;
  const latitudePadding = paddingKm / 111;
  const longitudePadding = paddingKm / (111 * Math.max(0.2, Math.cos(toRad(centerLatitude))));
  return {
    north: Math.max(...latitudes) + latitudePadding,
    south: Math.min(...latitudes) - latitudePadding,
    east: Math.max(...longitudes) + longitudePadding,
    west: Math.min(...longitudes) - longitudePadding,
  };
}

function validateBounds(input: { north: number; south: number; east: number; west: number }) {
  const { north, south, east, west } = input;
  const values = [north, south, east, west];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error('Region bounds must be valid numbers.');
  }
  if (north > 90 || north < -90 || south > 90 || south < -90) {
    throw new Error('Latitude bounds must be between -90 and 90.');
  }
  if (east > 180 || east < -180 || west > 180 || west < -180) {
    throw new Error('Longitude bounds must be between -180 and 180.');
  }
  if (north <= south) {
    throw new Error('North must be greater than south.');
  }
  if (east <= west) {
    throw new Error('East must be greater than west for this region planner.');
  }
  return { north, south, east, west };
}

function validateZoom(minZoom: number, maxZoom: number) {
  if (!Number.isFinite(minZoom) || !Number.isFinite(maxZoom)) {
    throw new Error('Zoom levels must be valid numbers.');
  }
  const nextMin = Math.round(minZoom);
  const nextMax = Math.round(maxZoom);
  if (nextMin < 0 || nextMax > 22 || nextMin > nextMax) {
    throw new Error('Zoom levels must stay between 0 and 22, with minimum before maximum.');
  }
  return { minZoom: nextMin, maxZoom: nextMax };
}

function matches(query: string, ...values: Array<string | null | undefined>) {
  return values.some((value) => value?.toLowerCase().includes(query));
}

function centerForBounds(region: {
  north?: number | null;
  south?: number | null;
  east?: number | null;
  west?: number | null;
}) {
  if (
    region.north == null ||
    region.south == null ||
    region.east == null ||
    region.west == null
  ) {
    return null;
  }
  return {
    latitude: (region.north + region.south) / 2,
    longitude: (region.east + region.west) / 2,
  };
}

function formatPoint(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
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
