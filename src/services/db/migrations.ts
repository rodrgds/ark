import type { SQLiteDatabase } from 'expo-sqlite';
import type { ArkSQLiteDatabase } from '@/services/db/client';
import { DB_VERSION } from '@/services/db/schema';

async function getUserVersion(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

async function execStatements(db: SQLiteDatabase, sql: string) {
  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);
  for (const statement of statements) {
    await db.execAsync(`${statement};`);
  }
}

export async function migrateDbIfNeeded(db: ArkSQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const currentVersion = await getUserVersion(db);
  if (currentVersion === DB_VERSION) return;
  if (currentVersion > 0) {
    throw new Error(
      `Unsupported pre-release database schema v${currentVersion}. Clear Ark app data and restore from a current backup.`
    );
  }

  await execStatements(
    db,
    `
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS onboarding_state (
        id TEXT PRIMARY KEY DEFAULT 'main',
        has_seen_intro INTEGER DEFAULT 0,
        has_created_vault INTEGER DEFAULT 0,
        has_configured_biometrics INTEGER DEFAULT 0,
        has_selected_packs INTEGER DEFAULT 0,
        completed_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS vault_state (
        id TEXT PRIMARY KEY DEFAULT 'main',
        is_initialized INTEGER NOT NULL,
        password_hint TEXT,
        kdf_salt TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        last_unlocked_at INTEGER,
        auto_lock_minutes INTEGER DEFAULT 5,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until INTEGER
      );

      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        content_html TEXT,
        content_json TEXT,
        content_format TEXT NOT NULL DEFAULT 'plain-text',
        tags_json TEXT,
        theme_id TEXT NOT NULL DEFAULT 'default',
        sort_order REAL,
        is_favorite INTEGER DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER,
        deleted_at INTEGER
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
        note_id UNINDEXED,
        title,
        body,
        tags
      );

      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        mime_type TEXT,
        local_uri TEXT,
        size_bytes INTEGER,
        sha256 TEXT,
        source TEXT,
        is_personal INTEGER DEFAULT 1,
        encryption_status TEXT NOT NULL DEFAULT 'unknown',
        extracted_text TEXT,
        ocr_text TEXT,
        ocr_status TEXT NOT NULL DEFAULT 'not_needed',
        ocr_error TEXT,
        indexed_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS document_pages (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        text TEXT,
        extraction_method TEXT NOT NULL,
        confidence REAL,
        indexed_at INTEGER,
        created_at INTEGER NOT NULL,
        UNIQUE(document_id, page_number)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS document_pages_fts USING fts5(
        page_id UNINDEXED,
        document_id UNINDEXED,
        text,
        title
      );

      CREATE TABLE IF NOT EXISTS content_packs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        language TEXT DEFAULT 'en',
        source_url TEXT,
        local_uri TEXT,
        format TEXT NOT NULL,
        size_bytes INTEGER,
        checksum_md5 TEXT,
        checksum_sha256 TEXT,
        checksum_sha256_url TEXT,
        installed INTEGER DEFAULT 0,
        install_status TEXT DEFAULT 'not_installed',
        progress REAL DEFAULT 0,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        source_url TEXT,
        local_uri TEXT,
        status TEXT NOT NULL,
        progress REAL DEFAULT 0,
        total_bytes INTEGER,
        downloaded_bytes INTEGER,
        resume_data TEXT,
        expected_checksum_md5 TEXT,
        expected_checksum_sha256 TEXT,
        checksum_md5 TEXT,
        checksum_sha256 TEXT,
        error TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS map_regions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        manifest_region_id TEXT,
        manifest_version INTEGER,
        style_url TEXT,
        tile_url_template TEXT,
        pack_format TEXT,
        pack_url TEXT,
        routing_pack_url TEXT,
        routing_graph_uri TEXT,
        routing_status TEXT NOT NULL DEFAULT 'not_downloaded',
        routing_progress REAL NOT NULL DEFAULT 0,
        routing_size_bytes INTEGER,
        routing_data_version TEXT,
        routing_checksum_sha256 TEXT,
        data_version TEXT,
        checksum_sha256 TEXT,
        checksum_sha256_url TEXT,
        region_updated_at TEXT,
        north REAL,
        south REAL,
        east REAL,
        west REAL,
        min_zoom INTEGER,
        max_zoom INTEGER,
        offline_pack_id TEXT,
        status TEXT DEFAULT 'not_downloaded',
        progress REAL DEFAULT 0,
        estimated_size_mb REAL,
        size_bytes INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS map_markers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        pin_type TEXT NOT NULL DEFAULT 'custom',
        is_emergency INTEGER NOT NULL DEFAULT 0,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        photo_uri TEXT,
        icon TEXT,
        color TEXT,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS routes (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        points_json TEXT NOT NULL,
        distance_meters REAL,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS navigation_sessions (
        id TEXT PRIMARY KEY,
        destination_title TEXT NOT NULL,
        destination_latitude REAL NOT NULL,
        destination_longitude REAL NOT NULL,
        profile TEXT NOT NULL,
        region_id TEXT NOT NULL,
        route_json TEXT NOT NULL,
        status TEXT NOT NULL,
        remaining_distance_meters REAL,
        current_maneuver_index INTEGER NOT NULL DEFAULT 0,
        off_route_count INTEGER NOT NULL DEFAULT 0,
        last_location_json TEXT,
        last_rerouted_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tracks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        activity_type TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        ended_at INTEGER,
        timezone_offset_minutes INTEGER NOT NULL,
        distance_meters REAL NOT NULL DEFAULT 0,
        total_time_seconds REAL NOT NULL DEFAULT 0,
        moving_time_seconds REAL NOT NULL DEFAULT 0,
        average_speed_mps REAL,
        average_moving_speed_mps REAL,
        max_speed_mps REAL,
        elevation_gain_meters REAL NOT NULL DEFAULT 0,
        elevation_loss_meters REAL NOT NULL DEFAULT 0,
        min_elevation_meters REAL,
        max_elevation_meters REAL,
        sample_count INTEGER NOT NULL DEFAULT 0,
        marker_count INTEGER NOT NULL DEFAULT 0,
        recording_gap_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS track_points (
        id TEXT PRIMARY KEY,
        track_id TEXT NOT NULL,
        segment_index INTEGER NOT NULL,
        point_index INTEGER NOT NULL,
        kind TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        altitude_meters REAL,
        altitude_source TEXT NOT NULL DEFAULT 'unknown',
        pressure_hpa REAL,
        horizontal_accuracy_meters REAL,
        vertical_accuracy_meters REAL,
        speed_mps REAL,
        bearing_degrees REAL,
        distance_from_previous_meters REAL NOT NULL DEFAULT 0,
        elapsed_seconds REAL NOT NULL DEFAULT 0,
        moving_elapsed_seconds REAL NOT NULL DEFAULT 0,
        recorded_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        UNIQUE(track_id, point_index),
        FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS track_markers (
        id TEXT PRIMARY KEY,
        track_id TEXT NOT NULL,
        map_marker_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        marker_type TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        altitude_meters REAL,
        recorded_at INTEGER NOT NULL,
        elapsed_seconds REAL NOT NULL DEFAULT 0,
        distance_meters REAL NOT NULL DEFAULT 0,
        photo_uri TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE,
        FOREIGN KEY(map_marker_id) REFERENCES map_markers(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS map_places (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        subtitle TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        source TEXT NOT NULL,
        source_ref TEXT,
        terms TEXT,
        last_seen_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(source, source_ref)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS map_places_fts USING fts5(
        place_id UNINDEXED,
        title,
        subtitle,
        terms
      );

      CREATE TABLE IF NOT EXISTS rss_feeds (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 1,
        last_fetched_at INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS rss_items (
        id TEXT PRIMARY KEY,
        feed_id TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT,
        author TEXT,
        summary TEXT,
        content TEXT,
        published_at INTEGER,
        saved_offline INTEGER DEFAULT 1,
        read_at INTEGER,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS weather_cache (
        id TEXT PRIMARY KEY,
        latitude REAL,
        longitude REAL,
        location_label TEXT,
        provider TEXT,
        forecast_json TEXT NOT NULL,
        confidence_json TEXT,
        fetched_at INTEGER NOT NULL,
        expires_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS sensor_snapshots (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        data_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ai_models (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        model_kind TEXT NOT NULL,
        repo_id TEXT,
        filename TEXT,
        local_uri TEXT,
        size_bytes INTEGER,
        status TEXT DEFAULT 'not_downloaded',
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS chat_threads (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        selected_model_id TEXT,
        chat_model_disabled INTEGER,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        citations_json TEXT,
        reasoning TEXT,
        metadata_json TEXT,
        deleted_at INTEGER,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS rag_sources (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        source_ref TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at INTEGER,
        updated_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS rag_chunks (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        token_count INTEGER,
        embedding_model_id TEXT,
        embedding_blob BLOB,
        created_at INTEGER
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
        chunk_id UNINDEXED,
        text,
        source_title
      );

      CREATE TABLE IF NOT EXISTS embedding_models (
        id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        family TEXT NOT NULL,
        dimension INTEGER NOT NULL,
        distance TEXT NOT NULL,
        quantization TEXT,
        query_prefix TEXT,
        document_prefix TEXT,
        normalize INTEGER NOT NULL DEFAULT 1,
        installed_at INTEGER,
        active INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chunk_embeddings (
        chunk_id TEXT NOT NULL,
        model_id TEXT NOT NULL,
        dimension INTEGER NOT NULL,
        embedding_blob BLOB NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY(chunk_id, model_id)
      );

      CREATE TABLE IF NOT EXISTS zim_articles_cache (
        id TEXT PRIMARY KEY,
        zim_id TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        html_hash TEXT NOT NULL,
        extracted_at INTEGER NOT NULL,
        last_accessed_at INTEGER NOT NULL,
        UNIQUE(zim_id, path)
      );

      CREATE TABLE IF NOT EXISTS zim_paragraph_chunks (
        id TEXT PRIMARY KEY,
        article_cache_id TEXT NOT NULL,
        zim_id TEXT NOT NULL,
        path TEXT NOT NULL,
        title TEXT NOT NULL,
        section_title TEXT,
        paragraph_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        token_estimate INTEGER,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_notes_deleted_updated ON notes(deleted_at, updated_at);
      CREATE INDEX IF NOT EXISTS idx_notes_deleted_sort ON notes(deleted_at, sort_order);
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
      CREATE INDEX IF NOT EXISTS idx_map_markers_updated ON map_markers(updated_at);
      CREATE INDEX IF NOT EXISTS idx_map_places_source ON map_places(source, source_ref);
      CREATE INDEX IF NOT EXISTS idx_map_places_updated ON map_places(updated_at);
      CREATE INDEX IF NOT EXISTS idx_routes_updated ON routes(updated_at);
      CREATE INDEX IF NOT EXISTS idx_navigation_sessions_status_updated ON navigation_sessions(status, updated_at);
      CREATE INDEX IF NOT EXISTS idx_tracks_status_started ON tracks(status, started_at);
      CREATE INDEX IF NOT EXISTS idx_tracks_deleted_started ON tracks(deleted_at, started_at);
      CREATE INDEX IF NOT EXISTS idx_track_points_track_index ON track_points(track_id, point_index);
      CREATE INDEX IF NOT EXISTS idx_track_points_track_recorded ON track_points(track_id, recorded_at);
      CREATE INDEX IF NOT EXISTS idx_track_markers_track_recorded ON track_markers(track_id, recorded_at);
      CREATE INDEX IF NOT EXISTS idx_track_markers_map_marker ON track_markers(map_marker_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_visible ON chat_messages(thread_id, deleted_at, created_at);
      CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_id, chunk_index);
      CREATE INDEX IF NOT EXISTS idx_document_pages_document ON document_pages(document_id, page_number);
      CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_model ON chunk_embeddings(model_id);
      CREATE INDEX IF NOT EXISTS idx_zim_paragraphs_article ON zim_paragraph_chunks(article_cache_id, paragraph_index);
  `
  );

  const now = Date.now();
  await db.runAsync(
    `INSERT OR IGNORE INTO onboarding_state
        (id, has_seen_intro, has_created_vault, has_configured_biometrics, has_selected_packs, completed_at)
       VALUES ('main', 0, 0, 0, 0, NULL)`
  );
  await db.runAsync(
    `INSERT OR IGNORE INTO vault_state
        (id, is_initialized, created_at, updated_at, auto_lock_minutes, failed_attempts)
       VALUES ('main', 0, ?, ?, 5, 0)`,
    [now, now]
  );
  await db.runAsync(`PRAGMA user_version = ${DB_VERSION}`);
}
