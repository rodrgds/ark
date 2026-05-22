import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import type { MapRegion } from '@/types/maps';

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

export class MapsRepository {
  static async listRegions() {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<Parameters<typeof mapRegion>[0]>(
      'SELECT * FROM map_regions ORDER BY updated_at DESC'
    );
    return rows.map(mapRegion);
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
}
