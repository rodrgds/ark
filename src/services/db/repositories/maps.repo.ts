import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import type { MapMarker, MapRegion, SavedRoute } from '@/types/maps';

function mapRegion(row: {
  id: string;
  name: string;
  provider: string;
  style_url: string | null;
  north: number | null;
  south: number | null;
  east: number | null;
  west: number | null;
  min_zoom: number | null;
  max_zoom: number | null;
  offline_pack_id: string | null;
  status: MapRegion['status'];
  progress: number;
  size_bytes: number | null;
  created_at: number;
  updated_at: number;
}): MapRegion {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    styleUrl: row.style_url,
    north: row.north,
    south: row.south,
    east: row.east,
    west: row.west,
    minZoom: row.min_zoom,
    maxZoom: row.max_zoom,
    offlinePackId: row.offline_pack_id,
    status: row.status,
    progress: row.progress,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMarker(row: {
  id: string;
  title: string;
  description: string | null;
  latitude: number;
  longitude: number;
  icon: string | null;
  color: string | null;
  created_at: number;
  updated_at: number;
}): MapMarker {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    latitude: row.latitude,
    longitude: row.longitude,
    icon: row.icon,
    color: row.color,
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
      'SELECT * FROM map_regions ORDER BY updated_at DESC'
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
    north?: number;
    south?: number;
    east?: number;
    west?: number;
    minZoom?: number;
    maxZoom?: number;
    styleUrl?: string;
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    const id = randomUUID();
    await db.runAsync(
      `INSERT INTO map_regions
        (id, name, provider, style_url, north, south, east, west, min_zoom, max_zoom, status, progress, created_at, updated_at)
       VALUES (?, ?, 'maplibre', ?, ?, ?, ?, ?, ?, ?, 'queued', 0, ?, ?)`,
      [
        id,
        region.name,
        region.styleUrl ?? null,
        region.north ?? null,
        region.south ?? null,
        region.east ?? null,
        region.west ?? null,
        region.minZoom ?? null,
        region.maxZoom ?? null,
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
    await db.runAsync(
      `UPDATE map_regions
       SET status = ?,
           progress = COALESCE(?, progress),
           offline_pack_id = COALESCE(?, offline_pack_id),
           size_bytes = COALESCE(?, size_bytes),
           updated_at = ?
       WHERE id = ?`,
      [
        patch.status,
        patch.progress ?? null,
        patch.offlinePackId ?? null,
        patch.sizeBytes ?? null,
        Date.now(),
        id,
      ]
    );
  }

  static async listMarkers() {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof mapMarker>[0]>(
      'SELECT * FROM map_markers ORDER BY updated_at DESC'
    );
    return rows.map(mapMarker);
  }

  static async createMarker(marker: {
    title: string;
    description?: string | null;
    latitude: number;
    longitude: number;
    icon?: string | null;
    color?: string | null;
  }) {
    const db = await DatabaseClient.getDb();
    const timestamp = Date.now();
    const id = randomUUID();
    await db.runAsync(
      `INSERT INTO map_markers
        (id, title, description, latitude, longitude, icon, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        marker.title,
        marker.description ?? null,
        marker.latitude,
        marker.longitude,
        marker.icon ?? 'pin',
        marker.color ?? '#F2B84B',
        timestamp,
        timestamp,
      ]
    );
    return id;
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
