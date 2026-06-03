import type { SQLiteDatabase } from 'expo-sqlite';
import { DB_VERSION } from '@/services/db/schema';

async function getUserVersion(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

async function backfillNoteSortOrder(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM notes
     WHERE deleted_at IS NULL
     ORDER BY is_favorite DESC, updated_at DESC, created_at DESC`
  );

  for (const [index, row] of rows.entries()) {
    await db.runAsync('UPDATE notes SET sort_order = ? WHERE id = ?', [(index + 1) * 1000, row.id]);
  }
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
        CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON chat_messages(thread_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_rag_chunks_source ON rag_chunks(source_id, chunk_index);
        CREATE INDEX IF NOT EXISTS idx_document_pages_document ON document_pages(document_id, page_number);
        CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_model ON chunk_embeddings(model_id);
        CREATE INDEX IF NOT EXISTS idx_zim_paragraphs_article ON zim_paragraph_chunks(article_cache_id, paragraph_index);
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

  if (currentVersion < 2) {
    await db.withTransactionAsync(async () => {
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(downloads)');
      if (!columns.some((column) => column.name === 'resume_data')) {
        await db.execAsync('ALTER TABLE downloads ADD COLUMN resume_data TEXT');
      }
      await db.runAsync('PRAGMA user_version = 2');
    });
  }

  if (currentVersion < 3) {
    await db.withTransactionAsync(async () => {
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(downloads)');
      if (!columns.some((column) => column.name === 'checksum_md5')) {
        await db.execAsync('ALTER TABLE downloads ADD COLUMN checksum_md5 TEXT');
      }
      await db.runAsync('PRAGMA user_version = 3');
    });
  }

  if (currentVersion < 4) {
    await db.withTransactionAsync(async () => {
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(content_packs)');
      if (!columns.some((column) => column.name === 'checksum_md5')) {
        await db.execAsync('ALTER TABLE content_packs ADD COLUMN checksum_md5 TEXT');
      }
      await db.runAsync('PRAGMA user_version = 4');
    });
  }

  if (currentVersion < 5) {
    await db.withTransactionAsync(async () => {
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(downloads)');
      if (!columns.some((column) => column.name === 'expected_checksum_md5')) {
        await db.execAsync('ALTER TABLE downloads ADD COLUMN expected_checksum_md5 TEXT');
      }
      await db.runAsync('PRAGMA user_version = 5');
    });
  }

  if (currentVersion < 6) {
    await db.withTransactionAsync(async () => {
      const downloadColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(downloads)'
      );
      if (!downloadColumns.some((column) => column.name === 'expected_checksum_sha256')) {
        await db.execAsync('ALTER TABLE downloads ADD COLUMN expected_checksum_sha256 TEXT');
      }
      if (!downloadColumns.some((column) => column.name === 'checksum_sha256')) {
        await db.execAsync('ALTER TABLE downloads ADD COLUMN checksum_sha256 TEXT');
      }

      const packColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(content_packs)'
      );
      if (!packColumns.some((column) => column.name === 'checksum_sha256')) {
        await db.execAsync('ALTER TABLE content_packs ADD COLUMN checksum_sha256 TEXT');
      }
      if (!packColumns.some((column) => column.name === 'checksum_sha256_url')) {
        await db.execAsync('ALTER TABLE content_packs ADD COLUMN checksum_sha256_url TEXT');
      }

      await db.runAsync('PRAGMA user_version = 6');
    });
  }

  if (currentVersion < 7) {
    await db.withTransactionAsync(async () => {
      const markerColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(map_markers)'
      );
      if (!markerColumns.some((column) => column.name === 'photo_uri')) {
        await db.execAsync('ALTER TABLE map_markers ADD COLUMN photo_uri TEXT');
      }
      await db.runAsync('PRAGMA user_version = 7');
    });
  }

  if (currentVersion < 8) {
    await db.withTransactionAsync(async () => {
      const documentColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(documents)'
      );
      if (!documentColumns.some((column) => column.name === 'extracted_text')) {
        await db.execAsync('ALTER TABLE documents ADD COLUMN extracted_text TEXT');
      }
      if (!documentColumns.some((column) => column.name === 'ocr_text')) {
        await db.execAsync('ALTER TABLE documents ADD COLUMN ocr_text TEXT');
      }
      if (!documentColumns.some((column) => column.name === 'ocr_status')) {
        await db.execAsync(
          "ALTER TABLE documents ADD COLUMN ocr_status TEXT NOT NULL DEFAULT 'not_needed'"
        );
      }
      if (!documentColumns.some((column) => column.name === 'ocr_error')) {
        await db.execAsync('ALTER TABLE documents ADD COLUMN ocr_error TEXT');
      }
      if (!documentColumns.some((column) => column.name === 'indexed_at')) {
        await db.execAsync('ALTER TABLE documents ADD COLUMN indexed_at INTEGER');
      }
      await db.runAsync('PRAGMA user_version = 8');
    });
  }

  if (currentVersion < 9) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
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

        CREATE INDEX IF NOT EXISTS idx_document_pages_document ON document_pages(document_id, page_number);
        CREATE INDEX IF NOT EXISTS idx_chunk_embeddings_model ON chunk_embeddings(model_id);
        CREATE INDEX IF NOT EXISTS idx_zim_paragraphs_article ON zim_paragraph_chunks(article_cache_id, paragraph_index);
      `);
      await db.runAsync('PRAGMA user_version = 9');
    });
  }

  if (currentVersion < 10) {
    await db.withTransactionAsync(async () => {
      const markerColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(map_markers)'
      );
      if (!markerColumns.some((column) => column.name === 'pin_type')) {
        await db.execAsync(
          "ALTER TABLE map_markers ADD COLUMN pin_type TEXT NOT NULL DEFAULT 'custom'"
        );
      }
      if (!markerColumns.some((column) => column.name === 'is_emergency')) {
        await db.execAsync(
          'ALTER TABLE map_markers ADD COLUMN is_emergency INTEGER NOT NULL DEFAULT 0'
        );
      }
      await db.runAsync('PRAGMA user_version = 10');
    });
  }

  if (currentVersion < 11) {
    await db.withTransactionAsync(async () => {
      const regionColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(map_regions)'
      );
      if (!regionColumns.some((column) => column.name === 'estimated_size_mb')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN estimated_size_mb REAL');
      }
      await db.runAsync('PRAGMA user_version = 11');
    });
  }

  if (currentVersion < 12) {
    await db.withTransactionAsync(async () => {
      const regionColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(map_regions)'
      );
      const hasRegionColumn = (name: string) =>
        regionColumns.some((column) => column.name === name);
      if (!hasRegionColumn('manifest_region_id')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN manifest_region_id TEXT');
      }
      if (!hasRegionColumn('manifest_version')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN manifest_version INTEGER');
      }
      if (!hasRegionColumn('tile_url_template')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN tile_url_template TEXT');
      }
      if (!hasRegionColumn('pack_format')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN pack_format TEXT');
      }
      if (!hasRegionColumn('pack_url')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN pack_url TEXT');
      }
      if (!hasRegionColumn('data_version')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN data_version TEXT');
      }
      if (!hasRegionColumn('checksum_sha256')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN checksum_sha256 TEXT');
      }
      if (!hasRegionColumn('checksum_sha256_url')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN checksum_sha256_url TEXT');
      }
      if (!hasRegionColumn('region_updated_at')) {
        await db.execAsync('ALTER TABLE map_regions ADD COLUMN region_updated_at TEXT');
      }
      await db.runAsync('PRAGMA user_version = 12');
    });
  }

  if (currentVersion < 13) {
    await db.withTransactionAsync(async () => {
      const chatColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(chat_messages)'
      );
      const hasChatColumn = (name: string) => chatColumns.some((column) => column.name === name);
      if (!hasChatColumn('reasoning')) {
        await db.execAsync('ALTER TABLE chat_messages ADD COLUMN reasoning TEXT');
      }
      if (!hasChatColumn('metadata_json')) {
        await db.execAsync('ALTER TABLE chat_messages ADD COLUMN metadata_json TEXT');
      }
      if (!hasChatColumn('deleted_at')) {
        await db.execAsync('ALTER TABLE chat_messages ADD COLUMN deleted_at INTEGER');
      }
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_visible ON chat_messages(thread_id, deleted_at, created_at)'
      );
      await db.runAsync('PRAGMA user_version = 13');
    });
  }

  if (currentVersion < 14) {
    await db.withTransactionAsync(async () => {
      const threadColumns = await db.getAllAsync<{ name: string }>(
        'PRAGMA table_info(chat_threads)'
      );
      const hasThreadColumn = (name: string) =>
        threadColumns.some((column) => column.name === name);
      if (!hasThreadColumn('selected_model_id')) {
        await db.execAsync('ALTER TABLE chat_threads ADD COLUMN selected_model_id TEXT');
      }
      if (!hasThreadColumn('chat_model_disabled')) {
        await db.execAsync('ALTER TABLE chat_threads ADD COLUMN chat_model_disabled INTEGER');
      }
      await db.runAsync('PRAGMA user_version = 14');
    });
  }

  if (currentVersion < 15) {
    await db.withTransactionAsync(async () => {
      const noteColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes)');
      if (!noteColumns.some((column) => column.name === 'theme_id')) {
        await db.execAsync("ALTER TABLE notes ADD COLUMN theme_id TEXT NOT NULL DEFAULT 'default'");
      }
      await db.runAsync('PRAGMA user_version = 15');
    });
  }

  if (currentVersion < 16) {
    await db.withTransactionAsync(async () => {
      const noteColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes)');
      if (!noteColumns.some((column) => column.name === 'sort_order')) {
        await db.execAsync('ALTER TABLE notes ADD COLUMN sort_order REAL');
      }
      await backfillNoteSortOrder(db);
      await db.runAsync(
        'CREATE INDEX IF NOT EXISTS idx_notes_deleted_sort ON notes(deleted_at, sort_order)'
      );
      await db.runAsync('PRAGMA user_version = 16');
    });
  }

  if (currentVersion < 17) {
    await db.withTransactionAsync(async () => {
      const noteColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes)');
      const hasNoteColumn = (name: string) => noteColumns.some((column) => column.name === name);
      if (!hasNoteColumn('content_html')) {
        await db.execAsync('ALTER TABLE notes ADD COLUMN content_html TEXT');
      }
      if (!hasNoteColumn('content_json')) {
        await db.execAsync('ALTER TABLE notes ADD COLUMN content_json TEXT');
      }
      if (!hasNoteColumn('content_format')) {
        await db.execAsync(
          "ALTER TABLE notes ADD COLUMN content_format TEXT NOT NULL DEFAULT 'plain-text'"
        );
      }
      await db.runAsync('PRAGMA user_version = 17');
    });
  }
}
