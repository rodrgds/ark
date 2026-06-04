import { randomUUID } from 'expo-crypto';
import { getMapPinMeta, normalizeMapPinType, type MapPinType } from '@/constants/map-pins';
import { DatabaseClient } from '@/services/db/client';
import { sqliteBoolean } from '@/services/db/sqlite-values';
import type { MapMarker, MapRegion, MapRegionPackFormat, SavedRoute } from '@/types/maps';

function mapRegion(row: {
  id: string;
  name: string;
  provider: string;
  manifest_region_id: string | null;
  manifest_version: number | null;
  style_url: string | null;
  tile_url_template: string | null;
  pack_format: string | null;
  pack_url: string | null;
  data_version: string | null;
  checksum_sha256: string | null;
  checksum_sha256_url: string | null;
  region_updated_at: string | null;
  north: number | null;
  south: number | null;
  east: number | null;
  west: number | null;
  min_zoom: number | null;
  max_zoom: number | null;
  offline_pack_id: string | null;
  status: MapRegion['status'];
  progress: number;
  estimated_size_mb: number | null;
  size_bytes: number | null;
  created_at: number;
  updated_at: number;
}): MapRegion {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    manifestRegionId: row.manifest_region_id,
    manifestVersion: row.manifest_version,
    styleUrl: row.style_url,
    tileUrlTemplate: row.tile_url_template,
    packFormat: normalizePackFormat(row.pack_format),
    packUrl: row.pack_url,
    dataVersion: row.data_version,
    checksumSha256: row.checksum_sha256,
    checksumSha256Url: row.checksum_sha256_url,
    regionUpdatedAt: row.region_updated_at,
    north: row.north,
    south: row.south,
    east: row.east,
    west: row.west,
    minZoom: row.min_zoom,
    maxZoom: row.max_zoom,
    offlinePackId: row.offline_pack_id,
    status: row.status,
    progress: row.progress,
    estimatedSizeMb: row.estimated_size_mb,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMarker(row: {
  id: string;
  title: string;
  description: string | null;
  pin_type?: string | null;
  is_emergency?: number | null;
  latitude: number;
  longitude: number;
  photo_uri: string | null;
  icon: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
}): MapMarker {
  const pinType = normalizeMapPinType(row.pin_type ?? row.icon);
  const pinMeta = getMapPinMeta(pinType);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pinType,
    isEmergencyPin: sqliteBoolean(row.is_emergency),
    latitude: row.latitude,
    longitude: row.longitude,
    photoUri: row.photo_uri,
    icon: row.icon ?? pinType,
    color: row.color ?? pinMeta.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRoute(row: {
  id: string;
  title: string;
  points_json: string;
  distance_meters: number | null;
  created_at: number;
  updated_at: number;
}): SavedRoute {
  return {
    id: row.id,
    title: row.title,
    points: JSON.parse(row.points_json),
    distanceMeters: row.distance_meters,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class MapsRepository {
  static async listRegions() {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof mapRegion>[0]>(
      'SELECT * FROM map_regions ORDER BY created_at DESC'
    );
    return rows.map(mapRegion);
  }

  static async getRegion(id: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<Parameters<typeof mapRegion>[0]>(
      'SELECT * FROM map_regions WHERE id = ?',
      [id]
    );
    return row ? mapRegion(row) : null;
  }

  static async createRegion(region: {
    name: string;
    manifestRegionId?: string | null;
    manifestVersion?: number | null;
    north?: number;
    south?: number;
    east?: number;
    west?: number;
    minZoom?: number;
    maxZoom?: number;
    estimatedSizeMb?: number | null;
    styleUrl?: string;
    tileUrlTemplate?: string | null;
    packFormat?: MapRegionPackFormat | null;
    packUrl?: string | null;
    dataVersion?: string | null;
    checksumSha256?: string | null;
    checksumSha256Url?: string | null;
    regionUpdatedAt?: string | null;
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    const id = randomUUID();
    await db.runAsync(
      `INSERT INTO map_regions
        (id, name, provider, manifest_region_id, manifest_version, style_url, tile_url_template, pack_format, pack_url, data_version, checksum_sha256, checksum_sha256_url, region_updated_at, north, south, east, west, min_zoom, max_zoom, status, progress, estimated_size_mb, created_at, updated_at)
       VALUES (?, ?, 'maplibre', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?, ?)`,
      [
        id,
        region.name,
        region.manifestRegionId ?? null,
        region.manifestVersion ?? null,
        region.styleUrl ?? null,
        region.tileUrlTemplate ?? null,
        region.packFormat ?? null,
        region.packUrl ?? null,
        region.dataVersion ?? null,
        region.checksumSha256 ?? null,
        region.checksumSha256Url ?? null,
        region.regionUpdatedAt ?? null,
        region.north ?? null,
        region.south ?? null,
        region.east ?? null,
        region.west ?? null,
        region.minZoom ?? null,
        region.maxZoom ?? null,
        region.estimatedSizeMb ?? null,
        timestamp,
        timestamp,
      ]
    );
    return id;
  }

  static async deleteRegion(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('DELETE FROM map_regions WHERE id = ?', [id]);
  }

  static async updateRegionManifest(
    id: string,
    region: {
      name: string;
      manifestRegionId?: string | null;
      manifestVersion?: number | null;
      north?: number | null;
      south?: number | null;
      east?: number | null;
      west?: number | null;
      minZoom?: number | null;
      maxZoom?: number | null;
      estimatedSizeMb?: number | null;
      styleUrl?: string | null;
      tileUrlTemplate?: string | null;
      packFormat?: MapRegionPackFormat | null;
      packUrl?: string | null;
      dataVersion?: string | null;
      checksumSha256?: string | null;
      checksumSha256Url?: string | null;
      regionUpdatedAt?: string | null;
    }
  ) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE map_regions
       SET name = ?,
           manifest_region_id = ?,
           manifest_version = ?,
           style_url = ?,
           tile_url_template = ?,
           pack_format = ?,
           pack_url = ?,
           data_version = ?,
           checksum_sha256 = ?,
           checksum_sha256_url = ?,
           region_updated_at = ?,
           north = ?,
           south = ?,
           east = ?,
           west = ?,
           min_zoom = ?,
           max_zoom = ?,
           estimated_size_mb = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        region.name,
        region.manifestRegionId ?? null,
        region.manifestVersion ?? null,
        region.styleUrl ?? null,
        region.tileUrlTemplate ?? null,
        region.packFormat ?? null,
        region.packUrl ?? null,
        region.dataVersion ?? null,
        region.checksumSha256 ?? null,
        region.checksumSha256Url ?? null,
        region.regionUpdatedAt ?? null,
        region.north ?? null,
        region.south ?? null,
        region.east ?? null,
        region.west ?? null,
        region.minZoom ?? null,
        region.maxZoom ?? null,
        region.estimatedSizeMb ?? null,
        Date.now(),
        id,
      ]
    );
  }

  static async updateRegionStatus(
    id: string,
    patch: {
      status: MapRegion['status'];
      progress?: number;
      offlinePackId?: string | null;
      sizeBytes?: number | null;
    }
  ) {
    const db = await DatabaseClient.getDb();
    const sets = ['status = ?', 'updated_at = ?'];
    const params: Array<string | number | null> = [patch.status, Date.now()];

    if ('progress' in patch) {
      sets.splice(1, 0, 'progress = ?');
      params.splice(1, 0, patch.progress ?? null);
    }
    if ('offlinePackId' in patch) {
      sets.splice(1, 0, 'offline_pack_id = ?');
      params.splice(1, 0, patch.offlinePackId ?? null);
    }
    if ('sizeBytes' in patch) {
      sets.splice(1, 0, 'size_bytes = ?');
      params.splice(1, 0, patch.sizeBytes ?? null);
    }
    params.push(id);

    await db.runAsync(
      `UPDATE map_regions
       SET ${sets.join(',\n           ')}
       WHERE id = ?`,
      params
    );
  }

  static async listMarkers() {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof mapMarker>[0]>(
      'SELECT * FROM map_markers ORDER BY updated_at DESC'
    );
    return rows.map(mapMarker);
  }

  static async getMarker(id: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<Parameters<typeof mapMarker>[0]>(
      'SELECT * FROM map_markers WHERE id = ?',
      [id]
    );
    return row ? mapMarker(row) : null;
  }

  static async createMarker(marker: {
    title: string;
    description?: string | null;
    pinType?: MapPinType;
    isEmergencyPin?: boolean;
    latitude: number;
    longitude: number;
    photoUri?: string | null;
    icon?: string | null;
    color?: string | null;
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    const id = randomUUID();
    const pinType = normalizeMapPinType(marker.pinType ?? marker.icon);
    const pinMeta = getMapPinMeta(pinType);
    await db.runAsync(
      `INSERT INTO map_markers
        (id, title, description, pin_type, is_emergency, latitude, longitude, photo_uri, icon, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        marker.title,
        marker.description ?? null,
        pinType,
        marker.isEmergencyPin ? 1 : 0,
        marker.latitude,
        marker.longitude,
        marker.photoUri ?? null,
        marker.icon ?? pinType,
        marker.color ?? pinMeta.color,
        timestamp,
        timestamp,
      ]
    );
    return id;
  }

  static async updateMarker(
    id: string,
    marker: {
      title: string;
      description?: string | null;
      pinType?: MapPinType;
      isEmergencyPin?: boolean;
      photoUri?: string | null;
    }
  ) {
    const db = await DatabaseClient.getDb();
    const existing = await this.getMarker(id);
    const pinType = normalizeMapPinType(marker.pinType ?? existing?.pinType);
    const pinMeta = getMapPinMeta(pinType);
    await db.runAsync(
      `UPDATE map_markers
       SET title = ?,
           description = ?,
           pin_type = ?,
           is_emergency = ?,
           photo_uri = ?,
           icon = ?,
           color = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        marker.title,
        marker.description ?? null,
        pinType,
        (marker.isEmergencyPin ?? existing?.isEmergencyPin) ? 1 : 0,
        marker.photoUri ?? null,
        pinType,
        pinMeta.color,
        Date.now(),
        id,
      ]
    );
  }

  static async deleteMarker(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('DELETE FROM map_markers WHERE id = ?', [id]);
  }

  static async listRoutes() {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof mapRoute>[0]>(
      'SELECT * FROM routes ORDER BY updated_at DESC'
    );
    return rows.map(mapRoute);
  }

  static async createRoute(route: {
    title: string;
    points: SavedRoute['points'];
    distanceMeters?: number | null;
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    const id = randomUUID();
    await db.runAsync(
      `INSERT INTO routes
        (id, title, points_json, distance_meters, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        route.title,
        JSON.stringify(route.points),
        route.distanceMeters ?? null,
        timestamp,
        timestamp,
      ]
    );
    return id;
  }

  static async deleteRoute(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync('DELETE FROM routes WHERE id = ?', [id]);
  }
}

function normalizePackFormat(format?: string | null): MapRegionPackFormat | null {
  if (
    format === 'maplibre_offline_pack' ||
    format === 'pmtiles' ||
    format === 'mbtiles' ||
    format === 'vector_tiles'
  ) {
    return format;
  }
  return null;
}
