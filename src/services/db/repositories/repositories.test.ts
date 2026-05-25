import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';

mock.module('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    throw new Error('Repository tests inject a Bun SQLite database.');
  },
}));

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
  digest: async (algorithm: AlgorithmIdentifier, data: Uint8Array) =>
    crypto.subtle.digest(algorithm, data),
  getRandomBytesAsync: async (length: number) => crypto.getRandomValues(new Uint8Array(length)),
  randomUUID: () => crypto.randomUUID(),
}));

const secureStore = new Map<string, string>();

mock.module('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when_unlocked_this_device_only',
  setItemAsync: async (key: string, value: string) => {
    secureStore.set(key, value);
  },
  getItemAsync: async (key: string) => secureStore.get(key) ?? null,
  deleteItemAsync: async (key: string) => {
    secureStore.delete(key);
  },
}));

mock.module('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  notificationAsync: async () => undefined,
  selectionAsync: async () => undefined,
}));

type Params = unknown[] | readonly unknown[] | undefined;

class TestSQLiteDatabase {
  readonly db = new Database(':memory:');

  async execAsync(sql: string) {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params?: Params) {
    this.db.query(sql).run(...this.normalize(params));
  }

  async getFirstAsync<T>(sql: string, params?: Params): Promise<T | null> {
    return (this.db.query(sql).get(...this.normalize(params)) as T | null) ?? null;
  }

  async getAllAsync<T>(sql: string, params?: Params): Promise<T[]> {
    return this.db.query(sql).all(...this.normalize(params)) as T[];
  }

  async withTransactionAsync(callback: () => Promise<void>) {
    this.db.exec('BEGIN');
    try {
      await callback();
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  private normalize(params: Params) {
    return Array.from(params ?? [], (value) => (value === undefined ? null : value));
  }
}

let DatabaseClient: typeof import('@/services/db/client').DatabaseClient;
let migrateDbIfNeeded: typeof import('@/services/db/migrations').migrateDbIfNeeded;
let SettingsRepository: typeof import('@/services/db/repositories/settings.repo').SettingsRepository;
let ContentRepository: typeof import('@/services/db/repositories/content.repo').ContentRepository;
let DownloadsRepository: typeof import('@/services/db/repositories/downloads.repo').DownloadsRepository;
let NotesRepository: typeof import('@/services/db/repositories/notes.repo').NotesRepository;
let MapsRepository: typeof import('@/services/db/repositories/maps.repo').MapsRepository;
let RssRepository: typeof import('@/services/db/repositories/rss.repo').RssRepository;
let WeatherRepository: typeof import('@/services/db/repositories/weather.repo').WeatherRepository;
let DocumentsRepository: typeof import('@/services/db/repositories/documents.repo').DocumentsRepository;
let DocumentPagesRepository: typeof import('@/services/db/repositories/document-pages.repo').DocumentPagesRepository;
let SensorsRepository: typeof import('@/services/db/repositories/sensors.repo').SensorsRepository;

let testDb: TestSQLiteDatabase;

beforeAll(async () => {
  ({ DatabaseClient } = await import('@/services/db/client'));
  ({ migrateDbIfNeeded } = await import('@/services/db/migrations'));
  ({ SettingsRepository } = await import('@/services/db/repositories/settings.repo'));
  ({ ContentRepository } = await import('@/services/db/repositories/content.repo'));
  ({ DownloadsRepository } = await import('@/services/db/repositories/downloads.repo'));
  ({ NotesRepository } = await import('@/services/db/repositories/notes.repo'));
  ({ MapsRepository } = await import('@/services/db/repositories/maps.repo'));
  ({ RssRepository } = await import('@/services/db/repositories/rss.repo'));
  ({ WeatherRepository } = await import('@/services/db/repositories/weather.repo'));
  ({ DocumentsRepository } = await import('@/services/db/repositories/documents.repo'));
  ({ DocumentPagesRepository } = await import('@/services/db/repositories/document-pages.repo'));
  ({ SensorsRepository } = await import('@/services/db/repositories/sensors.repo'));
});

beforeEach(async () => {
  secureStore.clear();
  testDb?.close();
  testDb = new TestSQLiteDatabase();
  await migrateDbIfNeeded(testDb as never);
  DatabaseClient.setTestDbForTests(testDb as never);
});

describe('database migrations', () => {
  test('creates the current schema with FTS and resumable download columns', async () => {
    const version = await testDb.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(9);

    const downloadColumns = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA table_info(downloads)'
    );
    expect(downloadColumns.map((column) => column.name)).toContain('resume_data');
    expect(downloadColumns.map((column) => column.name)).toContain('expected_checksum_md5');
    expect(downloadColumns.map((column) => column.name)).toContain('expected_checksum_sha256');
    expect(downloadColumns.map((column) => column.name)).toContain('checksum_md5');
    expect(downloadColumns.map((column) => column.name)).toContain('checksum_sha256');
    const contentColumns = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA table_info(content_packs)'
    );
    expect(contentColumns.map((column) => column.name)).toContain('checksum_md5');
    expect(contentColumns.map((column) => column.name)).toContain('checksum_sha256');
    expect(contentColumns.map((column) => column.name)).toContain('checksum_sha256_url');
    const markerColumns = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA table_info(map_markers)'
    );
    expect(markerColumns.map((column) => column.name)).toContain('photo_uri');
    const documentColumns = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA table_info(documents)'
    );
    expect(documentColumns.map((column) => column.name)).toContain('extracted_text');
    expect(documentColumns.map((column) => column.name)).toContain('ocr_text');
    expect(documentColumns.map((column) => column.name)).toContain('ocr_status');
    expect(documentColumns.map((column) => column.name)).toContain('ocr_error');
    expect(documentColumns.map((column) => column.name)).toContain('indexed_at');
    expect(
      (
        await testDb.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'document_pages'"
        )
      )?.name
    ).toBe('document_pages');
    expect(
      (
        await testDb.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'embedding_models'"
        )
      )?.name
    ).toBe('embedding_models');
    expect(
      (
        await testDb.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'zim_articles_cache'"
        )
      )?.name
    ).toBe('zim_articles_cache');

    await testDb.runAsync(
      'INSERT INTO notes_fts (note_id, title, body, tags) VALUES (?, ?, ?, ?)',
      ['note-1', 'Water', 'Filter water before storage.', 'water']
    );
    const rows = await testDb.getAllAsync<{ note_id: string }>(
      'SELECT note_id FROM notes_fts WHERE notes_fts MATCH ?',
      ['filter']
    );
    expect(rows[0]?.note_id).toBe('note-1');
  });
});

describe('repositories', () => {
  test('settings persist onboarding, vault, and app settings', async () => {
    await SettingsRepository.set('theme.preference', 'oled');
    expect(await SettingsRepository.get('theme.preference')).toBe('oled');

    await SettingsRepository.setLabelColor('water', '#2563eb');
    expect(await SettingsRepository.getLabelColors()).toEqual({ water: '#2563eb' });

    await SettingsRepository.deleteLabelColor('water');
    expect(await SettingsRepository.getLabelColors()).toEqual({});

    await SettingsRepository.updateOnboardingState({ hasSeenIntro: true, completedAt: 123 });
    const onboarding = await SettingsRepository.getOnboardingState();
    expect(onboarding.hasSeenIntro).toBe(true);
    expect(onboarding.completedAt).toBe(123);

    await SettingsRepository.updateVaultState({ autoLockMinutes: 15, passwordHint: 'hint' });
    const vault = await SettingsRepository.getVaultState();
    expect(vault.autoLockMinutes).toBe(15);
    expect(vault.passwordHint).toBe('hint');
  });

  test('content packs seed real packs and support install state changes', async () => {
    await testDb.runAsync(
      `INSERT INTO content_packs
        (id, title, description, category, language, source_url, format, installed, install_status, progress, created_at, updated_at)
       VALUES (?, 'Gemma old row', 'Removed model', 'AI Models', 'en', 'https://example.test/gemma.gguf', 'gguf', 0, 'not_installed', 0, 1, 1)`,
      ['model-gemma3-1b-it-q4-0']
    );

    const packs = await ContentRepository.list({ includeTestOnly: true });
    expect(packs.length).toBeGreaterThan(4);
    expect(packs.some((pack) => pack.id.includes('placeholder'))).toBe(false);
    expect(packs.some((pack) => pack.id === 'model-gemma3-1b-it-q4-0')).toBe(false);
    expect(packs.some((pack) => pack.id === 'model-gemma4-e2b-it-q4-k-m')).toBe(true);

    const pack = packs.find((item) => item.id === 'wikipedia-en-top100-nopic');
    expect(pack?.sourceUrl).toMatch(/^https:\/\//);

    await testDb.runAsync(
      `UPDATE content_packs
       SET installed = 1,
           install_status = 'installed',
           progress = 1,
           local_uri = 'file:///ark/content/top100.zim',
           updated_at = 12345
       WHERE id = ?`,
      ['wikipedia-en-top100-nopic']
    );
    const seededAgain = (await ContentRepository.list({ includeTestOnly: true })).find(
      (item) => item.id === 'wikipedia-en-top100-nopic'
    );
    expect(seededAgain?.updatedAt).toBe(12345);

    await ContentRepository.updateInstallStatus({
      id: 'wikipedia-en-top100-nopic',
      status: 'paused',
      progress: 0.42,
      localUri: 'file:///ark/content/top100.zim',
      sizeBytes: 1024,
    });
    const updated = (await ContentRepository.list({ includeTestOnly: true })).find(
      (item) => item.id === 'wikipedia-en-top100-nopic'
    );
    expect(updated?.installStatus).toBe('paused');
    expect(updated?.progress).toBe(0.42);
    expect(updated?.localUri).toBe('file:///ark/content/top100.zim');

    await ContentRepository.uninstall('wikipedia-en-top100-nopic');
    const uninstalled = (await ContentRepository.list({ includeTestOnly: true })).find(
      (item) => item.id === 'wikipedia-en-top100-nopic'
    );
    expect(uninstalled?.installed).toBe(false);
    expect(uninstalled?.installStatus).toBe('not_installed');
  });

  test('downloads track progress, pause state, checksum, and completion', async () => {
    const id = await DownloadsRepository.create({
      kind: 'zim',
      title: 'Wikipedia test',
      sourceUrl: 'https://example.test/wiki.zim',
      localUri: 'file:///ark/content/wiki.zim',
      expectedChecksumMd5: 'abc123',
      expectedChecksumSha256: 'a'.repeat(64),
    });

    await DownloadsRepository.updateProgress({
      id,
      progress: 0.25,
      totalBytes: 100,
      downloadedBytes: 25,
      localUri: 'file:///ark/content/wiki.zim',
    });
    await DownloadsRepository.pause({ id, progress: 0.25, resumeData: 'resume-token' });
    let row = await DownloadsRepository.get(id);
    expect(row?.status).toBe('paused');
    expect(row?.resumeData).toBe('resume-token');
    expect(row?.expectedChecksumMd5).toBe('abc123');
    expect(row?.expectedChecksumSha256).toBe('a'.repeat(64));

    await DownloadsRepository.complete({
      id,
      localUri: 'file:///ark/content/wiki.zim',
      totalBytes: 100,
      downloadedBytes: 100,
      checksumMd5: 'abc123',
      checksumSha256: 'a'.repeat(64),
    });
    row = await DownloadsRepository.get(id);
    expect(row?.status).toBe('completed');
    expect(row?.checksumMd5).toBe('abc123');
    expect(row?.checksumSha256).toBe('a'.repeat(64));
    expect(row?.progress).toBe(1);
  });

  test('notes CRUD keeps FTS in sync and soft delete hides notes', async () => {
    const note = await NotesRepository.create({
      title: 'Water plan',
      body: 'Filter and boil water before storing it.',
      tags: ['water', 'field'],
    });

    expect((await NotesRepository.list('boil'))[0]?.id).toBe(note.id);
    expect((await NotesRepository.list('water-plan'))[0]?.id).toBe(note.id);
    expect(await NotesRepository.list("what's water-plan?")).toEqual([]);

    await NotesRepository.update(note.id, { isFavorite: true, body: 'Boil and cool water.' });
    const updated = await NotesRepository.get(note.id);
    expect(updated?.isFavorite).toBe(true);
    expect(updated?.tags).toEqual(['water', 'field']);
    expect((await NotesRepository.list('cool'))[0]?.id).toBe(note.id);

    await NotesRepository.update(note.id, { tags: ['water', 'storage'] });
    const labeled = await NotesRepository.get(note.id);
    expect(labeled?.body).toBe('Boil and cool water.');
    expect(labeled?.tags).toEqual(['water', 'storage']);

    await NotesRepository.softDelete(note.id);
    expect(await NotesRepository.get(note.id)).toBeNull();
    expect(await NotesRepository.list('cool')).toHaveLength(0);
  });

  test('maps repository manages regions, markers, and routes', async () => {
    const regionId = await MapsRepository.createRegion({
      name: 'Field area',
      north: 39,
      south: 38,
      east: -8,
      west: -9,
      minZoom: 8,
      maxZoom: 14,
    });
    await MapsRepository.updateRegionStatus(regionId, {
      status: 'downloaded',
      progress: 1,
      offlinePackId: 'native-pack',
      sizeBytes: 2048,
    });
    expect((await MapsRepository.getRegion(regionId))?.offlinePackId).toBe('native-pack');

    const markerId = await MapsRepository.createMarker({
      title: 'Water source',
      latitude: 38.7,
      longitude: -9.1,
      photoUri: 'file:///ark/maps/water.jpg',
    });
    const marker = (await MapsRepository.listMarkers())[0];
    expect(marker?.id).toBe(markerId);
    expect(marker?.photoUri).toBe('file:///ark/maps/water.jpg');

    await MapsRepository.updateMarker(markerId, {
      title: 'Filtered water',
      description: 'Spring near the north track',
      photoUri: 'file:///ark/maps/spring.jpg',
    });
    const updatedMarker = await MapsRepository.getMarker(markerId);
    expect(updatedMarker?.title).toBe('Filtered water');
    expect(updatedMarker?.description).toBe('Spring near the north track');
    expect(updatedMarker?.photoUri).toBe('file:///ark/maps/spring.jpg');

    const routeId = await MapsRepository.createRoute({
      title: 'Walk out',
      points: [
        { latitude: 38.7, longitude: -9.1, title: 'Start' },
        { latitude: 38.8, longitude: -9.2, title: 'End' },
      ],
      distanceMeters: 1200,
    });
    expect((await MapsRepository.listRoutes())[0]?.id).toBe(routeId);
  });

  test('rss, weather, documents, and sensors persist offline data', async () => {
    await RssRepository.addFeed('USGS', 'https://example.test/feed.xml');
    const feed = (await RssRepository.listEnabledFeeds())[0];
    expect(feed.title).toBe('USGS');

    await RssRepository.upsertItems([
      {
        id: 'quake-1',
        feedId: feed.id,
        title: 'Significant earthquake',
        publishedAt: 1000,
      },
    ]);
    expect((await RssRepository.listRecentItems())[0]?.title).toBe('Significant earthquake');

    await WeatherRepository.saveForecast({
      latitude: 38.7,
      longitude: -9.1,
      locationLabel: 'Current location',
      provider: 'open-meteo',
      forecast: { summary: 'Clear' },
      confidence: { note: 'cached' },
    });
    expect((await WeatherRepository.getLatest())?.provider).toBe('open-meteo');

    const document = await DocumentsRepository.create({
      id: 'doc-1',
      title: 'Permit PDF',
      mimeType: 'application/pdf',
      localUri: 'file:///ark/imports/permit.pdf',
      sizeBytes: 500,
    });
    expect(document?.title).toBe('Permit PDF');
    const indexedDocument = await DocumentsRepository.updateText('doc-1', {
      extractedText: 'Permit allows water cache access.',
      ocrStatus: 'not_needed',
      indexedAt: 123,
    });
    expect(indexedDocument?.extractedText).toContain('water cache');
    expect(indexedDocument?.indexedAt).toBe(123);
    await DocumentPagesRepository.replaceForDocument('doc-1', 'Permit PDF', [
      {
        pageNumber: 1,
        text: 'Permit page allows water cache access.',
        extractionMethod: 'text_layer',
      },
    ]);
    expect((await DocumentPagesRepository.listForDocument('doc-1'))[0]?.text).toContain(
      'water cache'
    );
    await DocumentsRepository.delete('doc-1');
    await DocumentPagesRepository.deleteForDocument('doc-1');
    expect(await DocumentsRepository.get('doc-1')).toBeNull();

    await SensorsRepository.saveSnapshot('barometer', { hpa: 1013 });
    const snapshot = (await SensorsRepository.listSnapshots('barometer'))[0];
    expect(JSON.parse(snapshot.data_json).hpa).toBe(1013);
  });
});
