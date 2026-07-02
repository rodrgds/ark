import { randomUUID } from 'expo-crypto';
import { DatabaseClient, type ArkSQLiteDatabase } from '@/services/db/client';
import { computeTrackStats, routeCoordinates } from '@/services/tracks/track-statistics';
import type {
  Track,
  TrackActivityType,
  TrackMarker,
  TrackMarkerType,
  TrackPoint,
  TrackPointDraft,
  TrackRoutePreview,
  TrackStats,
  TrackStatus,
} from '@/types/tracks';

type TrackRow = {
  id: string;
  title: string;
  description: string | null;
  activity_type: TrackActivityType;
  status: TrackStatus;
  started_at: number;
  ended_at: number | null;
  timezone_offset_minutes: number;
  distance_meters: number;
  total_time_seconds: number;
  moving_time_seconds: number;
  average_speed_mps: number | null;
  average_moving_speed_mps: number | null;
  max_speed_mps: number | null;
  elevation_gain_meters: number;
  elevation_loss_meters: number;
  min_elevation_meters: number | null;
  max_elevation_meters: number | null;
  sample_count: number;
  marker_count: number;
  recording_gap_count: number;
  last_error: string | null;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

type TrackPointRow = {
  id: string;
  track_id: string;
  segment_index: number;
  point_index: number;
  kind: TrackPoint['kind'];
  latitude: number | null;
  longitude: number | null;
  altitude_meters: number | null;
  altitude_source: TrackPoint['altitudeSource'];
  pressure_hpa: number | null;
  horizontal_accuracy_meters: number | null;
  vertical_accuracy_meters: number | null;
  speed_mps: number | null;
  bearing_degrees: number | null;
  distance_from_previous_meters: number;
  elapsed_seconds: number;
  moving_elapsed_seconds: number;
  recorded_at: number;
  created_at: number;
};

type TrackMarkerRow = {
  id: string;
  track_id: string;
  map_marker_id: string | null;
  title: string;
  description: string | null;
  marker_type: TrackMarkerType;
  latitude: number;
  longitude: number;
  altitude_meters: number | null;
  recorded_at: number;
  elapsed_seconds: number;
  distance_meters: number;
  photo_uri: string | null;
  created_at: number;
  updated_at: number;
};

type TrackDbReader = Pick<ArkSQLiteDatabase, 'getAllAsync'>;
type TrackDbWriter = Pick<ArkSQLiteDatabase, 'runAsync'>;

function mapTrack(row: TrackRow): Track {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    activityType: row.activity_type,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    timezoneOffsetMinutes: row.timezone_offset_minutes,
    distanceMeters: row.distance_meters,
    totalTimeSeconds: row.total_time_seconds,
    movingTimeSeconds: row.moving_time_seconds,
    averageSpeedMps: row.average_speed_mps,
    averageMovingSpeedMps: row.average_moving_speed_mps,
    maxSpeedMps: row.max_speed_mps,
    elevationGainMeters: row.elevation_gain_meters,
    elevationLossMeters: row.elevation_loss_meters,
    minElevationMeters: row.min_elevation_meters,
    maxElevationMeters: row.max_elevation_meters,
    sampleCount: row.sample_count,
    markerCount: row.marker_count,
    recordingGapCount: row.recording_gap_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapPoint(row: TrackPointRow): TrackPoint {
  return {
    id: row.id,
    trackId: row.track_id,
    segmentIndex: row.segment_index,
    pointIndex: row.point_index,
    kind: row.kind,
    latitude: row.latitude,
    longitude: row.longitude,
    altitudeMeters: row.altitude_meters,
    altitudeSource: row.altitude_source,
    pressureHpa: row.pressure_hpa,
    horizontalAccuracyMeters: row.horizontal_accuracy_meters,
    verticalAccuracyMeters: row.vertical_accuracy_meters,
    speedMps: row.speed_mps,
    bearingDegrees: row.bearing_degrees,
    distanceFromPreviousMeters: row.distance_from_previous_meters,
    elapsedSeconds: row.elapsed_seconds,
    movingElapsedSeconds: row.moving_elapsed_seconds,
    recordedAt: row.recorded_at,
    createdAt: row.created_at,
  };
}

function mapMarker(row: TrackMarkerRow): TrackMarker {
  return {
    id: row.id,
    trackId: row.track_id,
    mapMarkerId: row.map_marker_id,
    title: row.title,
    description: row.description,
    markerType: row.marker_type,
    latitude: row.latitude,
    longitude: row.longitude,
    altitudeMeters: row.altitude_meters,
    recordedAt: row.recorded_at,
    elapsedSeconds: row.elapsed_seconds,
    distanceMeters: row.distance_meters,
    photoUri: row.photo_uri,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class TracksRepository {
  static async createTrack(input: {
    title: string;
    activityType: TrackActivityType;
    description?: string | null;
    startedAt?: number;
  }) {
    const db = await DatabaseClient.getDb();
    const now = input.startedAt ?? Date.now();
    const id = randomUUID();
    await db.runAsync(
      `INSERT INTO tracks
        (id, title, description, activity_type, status, started_at, timezone_offset_minutes,
         created_at, updated_at)
       VALUES (?, ?, ?, ?, 'recording', ?, ?, ?, ?)`,
      [
        id,
        input.title.trim() || defaultTrackTitle(input.activityType, now),
        input.description?.trim() || null,
        input.activityType,
        now,
        new Date(now).getTimezoneOffset(),
        now,
        now,
      ]
    );
    return (await this.getTrack(id))!;
  }

  static async listTracks(limit = 50) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<TrackRow>(
      `SELECT * FROM tracks
       WHERE deleted_at IS NULL AND status != 'discarded'
       ORDER BY started_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map(mapTrack);
  }

  static async searchTracks(query: string, limit = 8) {
    const db = await DatabaseClient.getDb();
    const like = `%${escapeLike(query.trim().toLowerCase())}%`;
    const rows = await db.getAllAsync<TrackRow>(
      `SELECT * FROM tracks
       WHERE deleted_at IS NULL
         AND status = 'finished'
         AND (lower(title) LIKE ? ESCAPE '\\'
              OR lower(COALESCE(description, '')) LIKE ? ESCAPE '\\'
              OR lower(activity_type) LIKE ? ESCAPE '\\')
       ORDER BY started_at DESC
       LIMIT ?`,
      [like, like, like, limit]
    );
    return rows.map(mapTrack);
  }

  static async getTrack(id: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<TrackRow>('SELECT * FROM tracks WHERE id = ?', [id]);
    return row ? mapTrack(row) : null;
  }

  static async getActiveTrack() {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<TrackRow>(
      `SELECT * FROM tracks
       WHERE deleted_at IS NULL AND status IN ('recording', 'paused')
       ORDER BY started_at DESC
       LIMIT 1`
    );
    return row ? mapTrack(row) : null;
  }

  static async renameTrack(id: string, title: string, description?: string | null) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE tracks
       SET title = ?, description = ?, updated_at = ?
       WHERE id = ?`,
      [title.trim() || 'Untitled track', description?.trim() || null, Date.now(), id]
    );
  }

  static async updateTrackStatus(id: string, status: TrackStatus, endedAt?: number | null) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE tracks
       SET status = ?, ended_at = COALESCE(?, ended_at), updated_at = ?
       WHERE id = ?`,
      [status, endedAt ?? null, Date.now(), id]
    );
  }

  static async updateTrackStats(id: string, stats: TrackStats) {
    const db = await DatabaseClient.getDb();
    await writeTrackStats(db, id, stats);
  }

  static async recalculateTrackStats(id: string) {
    const [track, points] = await Promise.all([this.getTrack(id), this.listPoints(id)]);
    if (!track) return null;
    const stats = computeTrackStats(points, track);
    await this.updateTrackStats(id, stats);
    return stats;
  }

  static async recordTrackError(id: string, message: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE tracks
       SET recording_gap_count = recording_gap_count + 1,
           last_error = ?,
           updated_at = ?
       WHERE id = ?`,
      [message.slice(0, 240), Date.now(), id]
    );
  }

  static async softDeleteTrack(id: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE tracks
       SET deleted_at = ?, status = 'discarded', updated_at = ?
       WHERE id = ?`,
      [Date.now(), Date.now(), id]
    );
  }

  static async listPoints(trackId: string) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<TrackPointRow>(
      `SELECT * FROM track_points
       WHERE track_id = ?
       ORDER BY point_index ASC`,
      [trackId]
    );
    return rows.map(mapPoint);
  }

  static async getLastPoint(trackId: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<TrackPointRow>(
      `SELECT * FROM track_points
       WHERE track_id = ?
       ORDER BY point_index DESC
       LIMIT 1`,
      [trackId]
    );
    return row ? mapPoint(row) : null;
  }

  static async insertPoints(trackId: string, drafts: TrackPointDraft[]) {
    if (!drafts.length) return [];
    const db = await DatabaseClient.getDb();
    const inserted: TrackPoint[] = [];
    await db.withTransactionAsync(async (tx) => {
      for (const draft of drafts) {
        const row = normalizePointDraft(draft);
        await tx.runAsync(
          `INSERT INTO track_points
            (id, track_id, segment_index, point_index, kind, latitude, longitude, altitude_meters,
             altitude_source, pressure_hpa, horizontal_accuracy_meters, vertical_accuracy_meters,
             speed_mps, bearing_degrees, distance_from_previous_meters, elapsed_seconds,
             moving_elapsed_seconds, recorded_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.id,
            row.trackId,
            row.segmentIndex,
            row.pointIndex,
            row.kind,
            row.latitude,
            row.longitude,
            row.altitudeMeters,
            row.altitudeSource,
            row.pressureHpa,
            row.horizontalAccuracyMeters,
            row.verticalAccuracyMeters,
            row.speedMps,
            row.bearingDegrees,
            row.distanceFromPreviousMeters,
            row.elapsedSeconds,
            row.movingElapsedSeconds,
            row.recordedAt,
            row.createdAt,
          ]
        );
        inserted.push(row);
      }
      const points = await getPointsWithTx(tx, trackId);
      await writeTrackStats(tx, trackId, computeTrackStats(points));
    });
    return inserted;
  }

  static async createMarker(input: {
    trackId: string;
    title: string;
    description?: string | null;
    markerType: TrackMarkerType;
    latitude: number;
    longitude: number;
    altitudeMeters?: number | null;
    recordedAt?: number;
    elapsedSeconds?: number;
    distanceMeters?: number;
    photoUri?: string | null;
    mapMarkerId?: string | null;
  }) {
    const db = await DatabaseClient.getDb();
    const now = Date.now();
    const id = randomUUID();
    await db.runAsync(
      `INSERT INTO track_markers
        (id, track_id, map_marker_id, title, description, marker_type, latitude, longitude,
         altitude_meters, recorded_at, elapsed_seconds, distance_meters, photo_uri, created_at,
         updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.trackId,
        input.mapMarkerId ?? null,
        input.title.trim() || 'Track marker',
        input.description?.trim() || null,
        input.markerType,
        input.latitude,
        input.longitude,
        input.altitudeMeters ?? null,
        input.recordedAt ?? now,
        input.elapsedSeconds ?? 0,
        input.distanceMeters ?? 0,
        input.photoUri ?? null,
        now,
        now,
      ]
    );
    await db.runAsync(
      `UPDATE tracks
       SET marker_count = (SELECT COUNT(*) FROM track_markers WHERE track_id = ?),
           updated_at = ?
       WHERE id = ?`,
      [input.trackId, now, input.trackId]
    );
    return (await this.getMarker(id))!;
  }

  static async getMarker(id: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<TrackMarkerRow>('SELECT * FROM track_markers WHERE id = ?', [
      id,
    ]);
    return row ? mapMarker(row) : null;
  }

  static async listMarkers(trackId: string) {
    const db = await DatabaseClient.getDb();
    const rows = await db.getAllAsync<TrackMarkerRow>(
      `SELECT * FROM track_markers
       WHERE track_id = ?
       ORDER BY recorded_at ASC`,
      [trackId]
    );
    return rows.map(mapMarker);
  }

  static async getRoutePreview(trackId: string): Promise<TrackRoutePreview | null> {
    const [track, points] = await Promise.all([this.getTrack(trackId), this.listPoints(trackId)]);
    if (!track) return null;
    return {
      id: track.id,
      title: track.title,
      coordinates: routeCoordinates(points),
      distanceMeters: track.distanceMeters,
    };
  }
}

async function getPointsWithTx(tx: TrackDbReader, trackId: string) {
  const rows = await tx.getAllAsync<TrackPointRow>(
    `SELECT * FROM track_points
     WHERE track_id = ?
     ORDER BY point_index ASC`,
    [trackId]
  );
  return rows.map(mapPoint);
}

async function writeTrackStats(db: TrackDbWriter, id: string, stats: TrackStats) {
  await db.runAsync(
    `UPDATE tracks
     SET distance_meters = ?,
         total_time_seconds = ?,
         moving_time_seconds = ?,
         average_speed_mps = ?,
         average_moving_speed_mps = ?,
         max_speed_mps = ?,
         elevation_gain_meters = ?,
         elevation_loss_meters = ?,
         min_elevation_meters = ?,
         max_elevation_meters = ?,
         sample_count = ?,
         updated_at = ?
     WHERE id = ?`,
    [
      stats.distanceMeters,
      stats.totalTimeSeconds,
      stats.movingTimeSeconds,
      stats.averageSpeedMps,
      stats.averageMovingSpeedMps,
      stats.maxSpeedMps,
      stats.elevationGainMeters,
      stats.elevationLossMeters,
      stats.minElevationMeters,
      stats.maxElevationMeters,
      stats.sampleCount,
      Date.now(),
      id,
    ]
  );
}

function normalizePointDraft(draft: TrackPointDraft): TrackPoint {
  const now = draft.createdAt ?? Date.now();
  return {
    ...draft,
    id: draft.id ?? randomUUID(),
    createdAt: now,
  };
}

function defaultTrackTitle(activityType: TrackActivityType, timestamp: number) {
  const label = activityType.charAt(0).toUpperCase() + activityType.slice(1);
  return `${label} ${new Date(timestamp).toLocaleDateString()}`;
}

function escapeLike(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
