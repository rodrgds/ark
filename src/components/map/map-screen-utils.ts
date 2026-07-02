import type { MapLocationIssue } from '@/services/maps/map-location.service';
import type { MapLibreModule } from '@/services/maps/map.service';
import type {
  MapMarker,
  MapRegion,
  NavigationSession,
  OfflineMapSearchResult,
  SavedRoute,
} from '@/types/maps';
import type { LocationObject } from 'expo-location';
import type * as React from 'react';

export type LngLat = [number, number];
export type MapViewBounds = [number, number, number, number];
export type CameraAction =
  | { type: 'center'; center: LngLat; zoom: number; duration: number }
  | { type: 'bounds'; bounds: MapViewBounds; padding: number; duration: number };

export const DEFAULT_CENTER: LngLat = [0, 20];
export const OFFLINE_REGION_ZOOM = 8;
export const CENTER_UPDATE_EPSILON_DEGREES = 0.00001;

const WORLD_OVERVIEW_POLYGONS: LngLat[][] = [
  [
    [-168, 72],
    [-52, 72],
    [-50, 8],
    [-88, -8],
    [-126, 15],
    [-168, 50],
    [-168, 72],
  ],
  [
    [-82, 12],
    [-34, 6],
    [-44, -56],
    [-72, -54],
    [-86, -20],
    [-82, 12],
  ],
  [
    [-12, 72],
    [46, 72],
    [72, 36],
    [45, 6],
    [5, 24],
    [-12, 72],
  ],
  [
    [-18, 34],
    [50, 34],
    [58, -35],
    [24, -36],
    [5, -4],
    [-18, 34],
  ],
  [
    [40, 68],
    [178, 68],
    [150, 8],
    [92, 6],
    [58, 30],
    [40, 68],
  ],
  [
    [110, -10],
    [156, -10],
    [154, -44],
    [112, -44],
    [110, -10],
  ],
];

export function getMapComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Map');
}

export function getCameraComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Camera');
}

export function getGeoJSONSourceComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'GeoJSONSource');
}

export function getLayerComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Layer');
}

export function getMarkerComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Marker');
}

function getMapLibreExport(maplibre: MapLibreModule | null, name: string) {
  const maybeDefault = maplibre as (MapLibreModule & { default?: Record<string, unknown> }) | null;
  return (maplibre?.[name as keyof MapLibreModule] ?? maybeDefault?.default?.[name]) as
    | React.ComponentType<any>
    | undefined;
}

export function routeFeatureCollection(routes: SavedRoute[]) {
  return {
    type: 'FeatureCollection',
    features: routes
      .filter((route) => route.points.length >= 2)
      .map((route) => ({
        type: 'Feature',
        properties: { id: route.id, title: route.title },
        geometry: {
          type: 'LineString',
          coordinates: route.points.map((point) => [point.longitude, point.latitude]),
        },
      })),
  };
}

export function navigationRouteFeatureCollection(session: NavigationSession | null) {
  return {
    type: 'FeatureCollection',
    features:
      session && session.route.geometry.length >= 2
        ? [
            {
              type: 'Feature',
              properties: { id: session.id, title: session.destinationTitle },
              geometry: {
                type: 'LineString',
                coordinates: session.route.geometry.map((point) => [
                  point.longitude,
                  point.latitude,
                ]),
              },
            },
          ]
        : [],
  };
}

export function markerFeatureCollection(markers: MapMarker[]) {
  return {
    type: 'FeatureCollection',
    features: markers.map((marker) => ({
      type: 'Feature',
      properties: {
        markerId: marker.id,
        title: marker.title,
      },
      geometry: {
        type: 'Point',
        coordinates: [marker.longitude, marker.latitude],
      },
    })),
  };
}

export function worldOverviewFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: WORLD_OVERVIEW_POLYGONS.map((polygon, index) => ({
      type: 'Feature',
      properties: { id: `overview-${index}` },
      geometry: {
        type: 'Polygon',
        coordinates: [polygon],
      },
    })),
  };
}

export function regionBounds(region: MapRegion): MapViewBounds | null {
  if (region.west == null || region.south == null || region.east == null || region.north == null) {
    return null;
  }
  return [region.west, region.south, region.east, region.north];
}

function mapPadding(value: number) {
  return { top: value, right: value, bottom: value, left: value };
}

export function runCameraAction(camera: any, action: CameraAction) {
  if (!camera) return false;
  if (action.type === 'center') {
    if (typeof camera.easeTo === 'function') {
      camera.easeTo({
        center: action.center,
        zoom: action.zoom,
        duration: action.duration,
      });
      return true;
    }
    if (typeof camera.flyTo === 'function') {
      camera.flyTo({
        center: action.center,
        zoom: action.zoom,
        duration: action.duration,
      });
      return true;
    }
    return false;
  }

  if (typeof camera.fitBounds === 'function') {
    camera.fitBounds(action.bounds, {
      padding: mapPadding(action.padding),
      duration: action.duration,
    });
    return true;
  }
  return false;
}

export function regionCenter(region: MapRegion | null): LngLat | null {
  const bounds = region ? regionBounds(region) : null;
  if (!bounds) return null;
  return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}

export function regionInitialZoom(region: MapRegion) {
  const minZoom = region.minZoom ?? OFFLINE_REGION_ZOOM;
  const maxZoom = region.maxZoom ?? Math.max(minZoom, OFFLINE_REGION_ZOOM);
  return Math.max(minZoom, Math.min(maxZoom, OFFLINE_REGION_ZOOM));
}

export function isDefaultCenter(center: LngLat) {
  return center[0] === DEFAULT_CENTER[0] && center[1] === DEFAULT_CENTER[1];
}

export function routeBounds(route: SavedRoute): MapViewBounds | null {
  if (!route.points.length) return null;
  const latitudes = route.points.map((point) => point.latitude);
  const longitudes = route.points.map((point) => point.longitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function navigationRouteBounds(session: NavigationSession): MapViewBounds | null {
  if (!session.route.geometry.length) return null;
  const latitudes = session.route.geometry.map((point) => point.latitude);
  const longitudes = session.route.geometry.map((point) => point.longitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

export function uniqueSearchResults(results: OfflineMapSearchResult[], limit = 12) {
  const seen = new Set<string>();
  return results
    .filter((result) => {
      const key = [
        result.kind,
        result.id,
        result.title.toLowerCase(),
        result.latitude?.toFixed(4) ?? '',
        result.longitude?.toFixed(4) ?? '',
      ].join(':');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function routeFallbackLabel(route: NavigationSession['route']) {
  if (route.routingFallbackReason === 'no_region') return 'navigation map missing';
  if (route.routingFallbackReason === 'navigation_downloading') return 'navigation downloading';
  if (route.routingFallbackReason === 'navigation_failed') return 'navigation download failed';
  if (route.routingFallbackReason === 'navigation_graph_missing') return 'navigation data missing';
  if (route.routingFallbackReason === 'engine_unavailable') return 'routing engine unavailable';
  if (route.routingFallbackReason === 'route_calculation_failed') return 'road route failed';
  return 'navigation not downloaded';
}

export function statusLabel(status: MapRegion['status']) {
  if (status === 'downloaded') return 'Downloaded';
  if (status === 'downloading') return 'Downloading';
  if (status === 'failed') return 'Failed';
  if (status === 'queued') return 'Queued';
  return 'Not downloaded';
}

export function locationIssueCopy(issue: MapLocationIssue) {
  if (issue.kind === 'permission_denied') {
    return {
      title: 'Location is off',
      body: issue.canOpenSettings
        ? 'Enable location in system settings to center the map and show GPS coordinates.'
        : 'Allow location access to center the map and show GPS coordinates.',
      retryLabel: 'Retry',
    };
  }
  if (issue.kind === 'timeout') {
    return {
      title: 'Location not fixed',
      body: 'Move near open sky or use saved pins and downloaded regions until GPS locks.',
      retryLabel: 'Try again',
    };
  }
  return {
    title: 'Location unavailable',
    body: 'GPS is not returning a position right now. Saved pins and offline regions still work.',
    retryLabel: 'Try again',
  };
}

export function sameLocation(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
) {
  return (
    Math.abs(left.latitude - right.latitude) < CENTER_UPDATE_EPSILON_DEGREES &&
    Math.abs(left.longitude - right.longitude) < CENTER_UPDATE_EPSILON_DEGREES
  );
}

export function isFiniteLngLat(center: LngLat) {
  return Number.isFinite(center[0]) && Number.isFinite(center[1]);
}

export function normalizeMapEventBounds(bounds: unknown): MapViewBounds | null {
  if (!Array.isArray(bounds) || bounds.length !== 4) return null;
  const [west, south, east, north] = bounds;
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north) ||
    east <= west ||
    north <= south
  ) {
    return null;
  }
  return [west, south, east, north];
}

export function formatVisibleBounds(bounds: MapViewBounds) {
  const [west, south, east, north] = bounds;
  const latitudeSpan = Math.abs(north - south);
  const longitudeSpan = Math.abs(east - west);
  return `${latitudeSpan.toFixed(2)} by ${longitudeSpan.toFixed(2)} degrees`;
}

export function centerDistance(left: LngLat, right: LngLat) {
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]));
}

export function locationToCenter(position: LocationObject): LngLat {
  return [position.coords.longitude, position.coords.latitude];
}

export function normalizeBearing(bearing: number) {
  return ((bearing % 360) + 360) % 360;
}

export function bearingDelta(left: number, right: number) {
  return bearingDistanceFromNorth(right - left);
}

export function bearingDistanceFromNorth(bearing: number) {
  const normalized = normalizeBearing(bearing);
  return Math.min(normalized, 360 - normalized);
}
