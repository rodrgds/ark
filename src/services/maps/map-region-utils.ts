import type { MapManifestRegion, MapRegion } from '@/types/maps';

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type ManifestRegionLike = MapManifestRegion & {
  bounds?: MapBounds;
  tags?: string[];
};

export type DownloadedRegionLike = {
  id?: string;
  regionId?: string;
  manifestRegionId?: string | null;
  name?: string;
  status?: string;
  north?: number | null;
  south?: number | null;
  east?: number | null;
  west?: number | null;
  bbox?: [number, number, number, number];
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function isCoordinateInsideRegion(
  latitude: number,
  longitude: number,
  region: Pick<ManifestRegionLike, 'bbox'> | { bounds: MapBounds }
) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  const bbox = getRegionBbox(region);
  if (!bbox) return false;
  const [west, south, east, north] = bbox;
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

export function getRegionForCoordinate<T extends ManifestRegionLike>(
  latitude: number,
  longitude: number,
  regions: T[]
) {
  return regions
    .filter((region) => isCoordinateInsideRegion(latitude, longitude, region))
    .sort((a, b) => regionArea(a) - regionArea(b) || levelRank(b.level) - levelRank(a.level))[0];
}

export function getRegionsForBoundingBox<T extends ManifestRegionLike>(
  bbox: [number, number, number, number],
  regions: T[]
) {
  return regions
    .filter((region) => {
      const candidate = getRegionBbox(region);
      return candidate ? boxesIntersect(bbox, candidate) : false;
    })
    .sort((a, b) => regionArea(a) - regionArea(b));
}

export function getDownloadedRegionForCoordinate<T extends DownloadedRegionLike>(
  latitude: number,
  longitude: number,
  downloadedRegions: T[]
) {
  return downloadedRegions
    .filter((region) => isDownloaded(region))
    .filter((region) => isCoordinateInsideDownloadedRegion(latitude, longitude, region))
    .sort((a, b) => downloadedRegionArea(a) - downloadedRegionArea(b))[0];
}

export function sortRegionsByDistanceFromCoordinate<T extends ManifestRegionLike>(
  regions: T[],
  latitude: number,
  longitude: number
) {
  return regions
    .slice()
    .sort((a, b) => distanceToRegionCenter(a, { latitude, longitude }) - distanceToRegionCenter(b, { latitude, longitude }));
}

export function findChildRegions<T extends { parentId?: string }>(parentId: string, regions: T[]) {
  return regions.filter((region) => region.parentId === parentId);
}

export function findParentRegion<T extends { id: string; parentId?: string }>(
  regionId: string,
  regions: T[]
) {
  const region = regions.find((candidate) => candidate.id === regionId);
  if (!region?.parentId) return undefined;
  return regions.find((candidate) => candidate.id === region.parentId);
}

export function isPresetDownloaded(
  preset: ManifestRegionLike,
  downloadedRegions: Array<MapRegion | DownloadedRegionLike>
) {
  return downloadedRegions.some((region) => {
    if (!isDownloaded(region)) return false;
    const regionId = 'regionId' in region ? region.regionId : undefined;
    const manifestRegionId = 'manifestRegionId' in region ? region.manifestRegionId : undefined;
    if (
      region.id === preset.id ||
      regionId === preset.id ||
      manifestRegionId === preset.id ||
      region.name === preset.name
    ) {
      return true;
    }
    return regionsShareBounds(preset, region);
  });
}

export function getBboxCenter(bbox: [number, number, number, number]): [number, number] {
  const [west, south, east, north] = bbox;
  return [(west + east) / 2, (south + north) / 2];
}

function getRegionBbox(region: Pick<ManifestRegionLike, 'bbox'> | { bounds: MapBounds }) {
  if ('bbox' in region && region.bbox) return region.bbox;
  if ('bounds' in region && region.bounds) {
    return [
      region.bounds.west,
      region.bounds.south,
      region.bounds.east,
      region.bounds.north,
    ] satisfies [number, number, number, number];
  }
  return null;
}

function isCoordinateInsideDownloadedRegion(latitude: number, longitude: number, region: DownloadedRegionLike) {
  const bbox = getDownloadedBbox(region);
  if (!bbox) return false;
  const [west, south, east, north] = bbox;
  return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
}

function getDownloadedBbox(region: DownloadedRegionLike) {
  if (region.bbox) return region.bbox;
  if (
    region.west == null ||
    region.south == null ||
    region.east == null ||
    region.north == null
  ) {
    return null;
  }
  return [
    region.west,
    region.south,
    region.east,
    region.north,
  ] satisfies [number, number, number, number];
}

function boxesIntersect(a: [number, number, number, number], b: [number, number, number, number]) {
  const [westA, southA, eastA, northA] = a;
  const [westB, southB, eastB, northB] = b;
  return westA <= eastB && eastA >= westB && southA <= northB && northA >= southB;
}

function regionArea(region: ManifestRegionLike) {
  const bbox = getRegionBbox(region);
  if (!bbox) return Number.POSITIVE_INFINITY;
  const [west, south, east, north] = bbox;
  return Math.abs((east - west) * (north - south));
}

function downloadedRegionArea(region: DownloadedRegionLike) {
  const bbox = getDownloadedBbox(region);
  if (!bbox) return Number.POSITIVE_INFINITY;
  const [west, south, east, north] = bbox;
  return Math.abs((east - west) * (north - south));
}

function regionsShareBounds(region: ManifestRegionLike, downloadedRegion: DownloadedRegionLike) {
  const bbox = getRegionBbox(region);
  const downloadedBbox = getDownloadedBbox(downloadedRegion);
  if (!bbox || !downloadedBbox) return false;
  return bbox.every((value, index) => Math.abs(value - downloadedBbox[index]) < 0.000001);
}

function distanceToRegionCenter(region: ManifestRegionLike, coordinate: Coordinate) {
  const bbox = getRegionBbox(region);
  const center = region.center ?? (bbox ? getBboxCenter(bbox) : null);
  if (!center) return Number.POSITIVE_INFINITY;
  return haversineMeters(coordinate.latitude, coordinate.longitude, center[1], center[0]);
}

function haversineMeters(latA: number, lonA: number, latB: number, lonB: number) {
  const earthRadiusMeters = 6371000;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value: number) {
  return (value * Math.PI) / 180;
}

function levelRank(level: ManifestRegionLike['level']) {
  if (level === 'city') return 4;
  if (level === 'region') return 3;
  if (level === 'country') return 2;
  return 1;
}

function isDownloaded(region: DownloadedRegionLike | MapRegion) {
  return region.status === 'downloaded';
}
