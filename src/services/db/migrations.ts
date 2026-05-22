import type { SQLiteDatabase } from 'expo-sqlite';
import { DB_VERSION } from '@/services/db/schema';

async function getUserVersion(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
  `);

  const currentVersion = await getUserVersion(db);
  if (currentVersion >= DB_VERSION) return;

  if (currentVersion < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
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
          auto_lock_minutes INTEGER DEFAULT 5
        );

        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          tags_json TEXT,
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
          created_at INTEGER,
          updated_at INTEGER
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
          error TEXT,
          created_at INTEGER,
          updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS map_regions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          provider TEXT NOT NULL,
          style_url TEXT,
          north REAL,
          south REAL,
          east REAL,
          west REAL,
          min_zoom INTEGER,
          max_zoom INTEGER,
          offline_pack_id TEXT,
          status TEXT DEFAULT 'not_downloaded',
          progress REAL DEFAULT 0,
          size_bytes INTEGER,
          created_at INTEGER,
          updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS map_markers (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
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
          created_at INTEGER,
          updated_at INTEGER
        );

        CREATE TABLE IF NOT EXISTS chat_messages (
          id TEXT PRIMARY KEY,
          thread_id TEXT NOT NULL,
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          citations_json TEXT,
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

        CREATE INDEX IF NOT EXISTS idx_notes_deleted_updated ON notes(deleted_at, updated_at);
        CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_id, chunk_index);
      `);

      const now = Date.now();
      await db.runAsync(
        `INSERT OR IGNORE INTO onboarding_state
          (id, has_seen_intro, has_created_vault, has_configured_biometrics, has_selected_packs, completed_at)
         VALUES ('main', 0, 0, 0, 0, NULL)`
      );
      await db.runAsync(
        `INSERT OR IGNORE INTO vault_state
          (id, is_initialized, created_at, updated_at, auto_lock_minutes)
         VALUES ('main', 0, ?, ?, 5)`,
        [now, now]
      );
      await db.runAsync('PRAGMA user_version = 1');
    });
  }
}
