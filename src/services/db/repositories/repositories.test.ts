import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { sqliteBoolean } from '@/services/db/sqlite-values';

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

  async withTransactionAsync(callback: (tx: TestSQLiteDatabase) => Promise<void>) {
    this.db.exec('BEGIN');
    try {
      await callback(this);
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
let resetStarterPacksSeedFlagForTests: () => void;
let DownloadsRepository: typeof import('@/services/db/repositories/downloads.repo').DownloadsRepository;
let NotesRepository: typeof import('@/services/db/repositories/notes.repo').NotesRepository;
let MapsRepository: typeof import('@/services/db/repositories/maps.repo').MapsRepository;
let RssRepository: typeof import('@/services/db/repositories/rss.repo').RssRepository;
let WeatherRepository: typeof import('@/services/db/repositories/weather.repo').WeatherRepository;
let DocumentsRepository: typeof import('@/services/db/repositories/documents.repo').DocumentsRepository;
let DocumentPagesRepository: typeof import('@/services/db/repositories/document-pages.repo').DocumentPagesRepository;
let SensorsRepository: typeof import('@/services/db/repositories/sensors.repo').SensorsRepository;
let PreferencesService: typeof import('@/services/preferences/preferences.service').PreferencesService;

let testDb: TestSQLiteDatabase;

beforeAll(async () => {
  ({ DatabaseClient } = await import('@/services/db/client'));
  ({ migrateDbIfNeeded } = await import('@/services/db/migrations'));
  ({ SettingsRepository } = await import('@/services/db/repositories/settings.repo'));
  ({ ContentRepository, resetStarterPacksSeedFlagForTests } =
    await import('@/services/db/repositories/content.repo'));
  ({ DownloadsRepository } = await import('@/services/db/repositories/downloads.repo'));
  ({ NotesRepository } = await import('@/services/db/repositories/notes.repo'));
  ({ MapsRepository } = await import('@/services/db/repositories/maps.repo'));
  ({ RssRepository } = await import('@/services/db/repositories/rss.repo'));
  ({ WeatherRepository } = await import('@/services/db/repositories/weather.repo'));
  ({ DocumentsRepository } = await import('@/services/db/repositories/documents.repo'));
  ({ DocumentPagesRepository } = await import('@/services/db/repositories/document-pages.repo'));
  ({ SensorsRepository } = await import('@/services/db/repositories/sensors.repo'));
  ({ PreferencesService } = await import('@/services/preferences/preferences.service'));
});

beforeEach(async () => {
  secureStore.clear();
  testDb?.close();
  testDb = new TestSQLiteDatabase();
  await migrateDbIfNeeded(testDb as never);
  DatabaseClient.setTestDbForTests(testDb as never);
  resetStarterPacksSeedFlagForTests();
});

describe('database migrations', () => {
  test('creates the current schema with FTS and resumable download columns', async () => {
    const version = await testDb.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(version?.user_version).toBe(1);

    const noteColumns = await testDb.getAllAsync<{ name: string }>('PRAGMA table_info(notes)');
    expect(noteColumns.map((column) => column.name)).toContain('theme_id');
    expect(noteColumns.map((column) => column.name)).toContain('sort_order');
    expect(noteColumns.map((column) => column.name)).toContain('content_html');
    expect(noteColumns.map((column) => column.name)).toContain('content_json');
    expect(noteColumns.map((column) => column.name)).toContain('content_format');
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
    expect(markerColumns.map((column) => column.name)).toContain('pin_type');
    expect(markerColumns.map((column) => column.name)).toContain('is_emergency');
    const regionColumns = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA table_info(map_regions)'
    );
    expect(regionColumns.map((column) => column.name)).toContain('estimated_size_mb');
    expect(regionColumns.map((column) => column.name)).toContain('manifest_region_id');
    expect(regionColumns.map((column) => column.name)).toContain('manifest_version');
    expect(regionColumns.map((column) => column.name)).toContain('data_version');
    expect(regionColumns.map((column) => column.name)).toContain('checksum_sha256');
    expect(regionColumns.map((column) => column.name)).toContain('routing_pack_url');
    expect(regionColumns.map((column) => column.name)).toContain('routing_graph_uri');
    expect(regionColumns.map((column) => column.name)).toContain('routing_status');
    expect(regionColumns.map((column) => column.name)).toContain('routing_progress');
    expect(regionColumns.map((column) => column.name)).toContain('routing_size_bytes');
    expect(regionColumns.map((column) => column.name)).toContain('routing_data_version');
    expect(regionColumns.map((column) => column.name)).toContain('routing_checksum_sha256');
    expect(
      (
        await testDb.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'navigation_sessions'"
        )
      )?.name
    ).toBe('navigation_sessions');
    const chatColumns = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA table_info(chat_messages)'
    );
    expect(chatColumns.map((column) => column.name)).toContain('reasoning');
    expect(chatColumns.map((column) => column.name)).toContain('metadata_json');
    expect(chatColumns.map((column) => column.name)).toContain('deleted_at');
    const chatThreadColumns = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA table_info(chat_threads)'
    );
    expect(chatThreadColumns.map((column) => column.name)).toContain('selected_model_id');
    expect(chatThreadColumns.map((column) => column.name)).toContain('chat_model_disabled');
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
    const markerIndexes = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA index_list(map_markers)'
    );
    expect(markerIndexes.map((index) => index.name)).toContain('idx_map_markers_updated');
    expect(
      (
        await testDb.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'map_places'"
        )
      )?.name
    ).toBe('map_places');
    expect(
      (
        await testDb.getFirstAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'map_places_fts'"
        )
      )?.name
    ).toBe('map_places_fts');
    const placeIndexes = await testDb.getAllAsync<{ name: string }>(
      'PRAGMA index_list(map_places)'
    );
    expect(placeIndexes.map((index) => index.name)).toContain('idx_map_places_source');
    expect(placeIndexes.map((index) => index.name)).toContain('idx_map_places_updated');
    const routeIndexes = await testDb.getAllAsync<{ name: string }>('PRAGMA index_list(routes)');
    expect(routeIndexes.map((index) => index.name)).toContain('idx_routes_updated');

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

  test('rejects pre-release database schemas instead of carrying compatibility migrations', async () => {
    const oldDb = new TestSQLiteDatabase();
    try {
      await oldDb.execAsync('PRAGMA user_version = 14');
      await expect(migrateDbIfNeeded(oldDb as never)).rejects.toThrow(
        'Unsupported pre-release database schema v14'
      );
    } finally {
      oldDb.close();
    }
  });
});

describe('SQLite value mapping', () => {
  test('parses numeric and text booleans without treating text zero as true', () => {
    expect(sqliteBoolean(1)).toBe(true);
    expect(sqliteBoolean('1')).toBe(true);
    expect(sqliteBoolean(0)).toBe(false);
    expect(sqliteBoolean('0')).toBe(false);
    expect(sqliteBoolean(null)).toBe(false);
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

  test('preferences persist battery reduce mode', async () => {
    expect(await PreferencesService.getBatteryReduceModeEnabled()).toBe(false);
    expect(await PreferencesService.getMotionEnabled()).toBe(true);

    await PreferencesService.setMotionEnabled(false);
    expect(await SettingsRepository.get('battery.reduceModeEnabled')).toBe('true');

    expect(await PreferencesService.getWifiOnlyDownloadsEnabled()).toBe(false);
    await PreferencesService.setWifiOnlyDownloadsEnabled(true);
    expect(await PreferencesService.getWifiOnlyDownloadsEnabled()).toBe(true);
    expect(await SettingsRepository.get('downloads.wifiOnly')).toBe('true');
  });

  test('content packs seed real packs and support install state changes', async () => {
    const packs = await ContentRepository.list({ includeTestOnly: true });
    expect(packs.length).toBeGreaterThan(4);
    expect(packs.some((pack) => pack.id.includes('placeholder'))).toBe(false);
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

    await DownloadsRepository.delete(id);
    expect(await DownloadsRepository.get(id)).toBeNull();
  });

  test('notes CRUD keeps FTS in sync and soft delete hides notes', async () => {
    const note = await NotesRepository.create({
      title: 'Water plan',
      body: 'Filter and boil water before storing it.',
      tags: ['water', 'field'],
    });

    expect(note.themeId).toBe('default');
    expect(note.contentFormat).toBe('plain-text');
    expect(note.contentHtml).toBeNull();
    expect(note.contentJson).toBeNull();
    expect(note.sortOrder).toBeNumber();
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

    await NotesRepository.update(note.id, { themeId: 'yellow' });
    const themed = await NotesRepository.get(note.id);
    expect(themed?.themeId).toBe('yellow');
    expect((await NotesRepository.list('cool'))[0]?.id).toBe(note.id);

    await NotesRepository.softDelete(note.id);
    expect(await NotesRepository.get(note.id)).toBeNull();
    expect(await NotesRepository.list('cool')).toHaveLength(0);
  });

  test('notes preserve rich editor content while FTS tracks plain body', async () => {
    const contentJson = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Radio antenna' }],
        },
      ],
    });
    const note = await NotesRepository.create({
      title: 'Radio setup',
      body: 'Raise the antenna before transmitting.',
      contentHtml: '<p><strong>Radio antenna</strong></p>',
      contentJson,
      contentFormat: 'tiptap-json-v1',
      tags: ['comms'],
    });

    expect(note.contentFormat).toBe('tiptap-json-v1');
    expect(note.contentHtml).toBe('<p><strong>Radio antenna</strong></p>');
    expect(note.contentJson).toBe(contentJson);
    expect((await NotesRepository.list('antenna'))[0]?.id).toBe(note.id);
    expect(await NotesRepository.list('strong')).toEqual([]);

    const updatedJson = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Coil cable' }] }],
            },
          ],
        },
      ],
    });
    await NotesRepository.update(note.id, {
      body: 'Coil cable before storage.',
      contentHtml: '<ul><li><p>Coil cable</p></li></ul>',
      contentJson: updatedJson,
      contentFormat: 'tiptap-json-v1',
    });

    const updated = await NotesRepository.get(note.id);
    expect(updated?.body).toBe('Coil cable before storage.');
    expect(updated?.contentHtml).toBe('<ul><li><p>Coil cable</p></li></ul>');
    expect(updated?.contentJson).toBe(updatedJson);
    expect(updated?.contentFormat).toBe('tiptap-json-v1');
    expect((await NotesRepository.list('coil'))[0]?.id).toBe(note.id);
    expect(await NotesRepository.list('antenna')).toEqual([]);
  });

  test('notes recover plain body from rich content when editor text is an artifact', async () => {
    const contentJson = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Keep iodine tablets with the water kit.' }],
        },
      ],
    });
    const note = await NotesRepository.create({
      title: 'Water kit',
      body: '...',
      contentHtml: '<p>Keep iodine tablets with the water kit.</p>',
      contentJson,
      contentFormat: 'tiptap-json-v1',
    });

    expect(note.body).toBe('Keep iodine tablets with the water kit.');
    expect((await NotesRepository.list('iodine'))[0]?.id).toBe(note.id);
  });

  test('notes bulk actions update metadata, labels, and soft deletes safely', async () => {
    const first = await NotesRepository.create({
      title: 'Radio cache',
      body: 'Charge the crank radio monthly.',
      tags: ['comms'],
    });
    const second = await NotesRepository.create({
      title: 'Food cache',
      body: 'Rotate tins before expiry.',
      tags: ['food'],
    });
    const third = await NotesRepository.create({
      title: 'Private route',
      body: 'Trailhead behind the ridge.',
      tags: ['map'],
    });
    expect((await NotesRepository.list(undefined, 'manual')).map((note) => note.id)).toEqual([
      third.id,
      second.id,
      first.id,
    ]);

    await NotesRepository.updateMany([first.id, second.id], {
      isFavorite: true,
      themeId: 'teal',
    });
    const [updatedFirst, updatedSecond, untouchedThird] = await NotesRepository.getMany([
      first.id,
      second.id,
      third.id,
    ]);
    expect(updatedFirst?.isFavorite).toBe(true);
    expect(updatedFirst?.themeId).toBe('teal');
    expect(updatedSecond?.isFavorite).toBe(true);
    expect(updatedSecond?.themeId).toBe('teal');
    expect(untouchedThird?.isFavorite).toBe(false);
    expect(untouchedThird?.themeId).toBe('default');
    expect((await NotesRepository.list('monthly'))[0]?.id).toBe(first.id);

    await NotesRepository.reorder([first.id, third.id, second.id]);
    expect((await NotesRepository.list(undefined, 'manual')).map((note) => note.id)).toEqual([
      first.id,
      third.id,
      second.id,
    ]);

    await NotesRepository.applyLabels([first.id, second.id], ['offline', ' food ']);
    const labeled = await NotesRepository.getMany([first.id, second.id]);
    expect(labeled[0]?.tags).toEqual(['comms', 'food', 'offline']);
    expect(labeled[1]?.tags).toEqual(['food', 'offline']);
    expect((await NotesRepository.list('offline')).map((note) => note.id).sort()).toEqual(
      [first.id, second.id].sort()
    );

    await NotesRepository.removeLabels([first.id, second.id], ['offline', 'missing']);
    const unlabeled = await NotesRepository.getMany([first.id, second.id]);
    expect(unlabeled[0]?.tags).toEqual(['comms', 'food']);
    expect(unlabeled[1]?.tags).toEqual(['food']);
    expect((await NotesRepository.list('offline')).map((note) => note.id)).toEqual([]);

    const explicitBody = await NotesRepository.create({
      title: 'Body patch test',
      body: 'short body',
      contentHtml: '<p>much longer html content that should not win over the body field</p>',
      contentJson: JSON.stringify({ type: 'doc', content: [] }),
      contentFormat: 'tiptap-json-v1',
    });
    await NotesRepository.update(explicitBody.id, { body: 'USER EDITED' });
    const reloaded = await NotesRepository.get(explicitBody.id);
    expect(reloaded?.body).toBe('USER EDITED');

    const onlyRich = await NotesRepository.create({
      title: 'Rich only test',
      body: 'placeholder',
      contentHtml: '<p>html-only</p>',
      contentJson: null,
      contentFormat: 'tiptap-json-v1',
    });
    await NotesRepository.update(onlyRich.id, {
      contentHtml: '<p>rich updated</p>',
      contentJson: null,
    });
    const reloadedRich = await NotesRepository.get(onlyRich.id);
    expect(reloadedRich?.body).toBe('rich updated');
    expect(reloadedRich?.contentHtml).toBe('<p>rich updated</p>');

    await NotesRepository.softDeleteMany([first.id, second.id]);
    expect(await NotesRepository.get(first.id)).toBeNull();
    expect(await NotesRepository.get(second.id)).toBeNull();
    expect((await NotesRepository.list('offline')).map((note) => note.id)).toEqual([]);
    expect(await NotesRepository.get(third.id)).toMatchObject({ id: third.id });
  });

  test('maps repository manages regions, markers, and routes', async () => {
    const regionId = await MapsRepository.createRegion({
      name: 'Field area',
      manifestRegionId: 'pt-field-area',
      manifestVersion: 7,
      north: 39,
      south: 38,
      east: -8,
      west: -9,
      minZoom: 8,
      maxZoom: 14,
      estimatedSizeMb: 64,
      packFormat: 'pmtiles',
      packUrl: 'https://maps.example.test/pt-field-area.pmtiles',
      dataVersion: '2026-05',
      checksumSha256: 'a'.repeat(64),
      checksumSha256Url: 'https://maps.example.test/pt-field-area.pmtiles.sha256',
      regionUpdatedAt: '2026-05-25',
      routingPackUrl: 'https://maps.example.test/pt-field-area-routing.tar',
      routingDataVersion: '2026-05-routing',
      routingChecksumSha256: 'b'.repeat(64),
    });
    await MapsRepository.updateRegionStatus(regionId, {
      status: 'downloaded',
      progress: 1,
      offlinePackId: 'native-pack',
      sizeBytes: 2048,
    });
    const storedRegion = await MapsRepository.getRegion(regionId);
    expect(storedRegion?.offlinePackId).toBe('native-pack');
    expect(storedRegion?.estimatedSizeMb).toBe(64);
    expect(storedRegion?.manifestRegionId).toBe('pt-field-area');
    expect(storedRegion?.manifestVersion).toBe(7);
    expect(storedRegion?.packFormat).toBe('pmtiles');
    expect(storedRegion?.dataVersion).toBe('2026-05');
    expect(storedRegion?.checksumSha256).toBe('a'.repeat(64));
    expect(storedRegion?.routingPackUrl).toBe(
      'https://maps.example.test/pt-field-area-routing.tar'
    );
    expect(storedRegion?.routingStatus).toBe('not_downloaded');
    expect(storedRegion?.routingDataVersion).toBe('2026-05-routing');
    expect(storedRegion?.routingChecksumSha256).toBe('b'.repeat(64));

    await MapsRepository.updateRegionRouting(regionId, {
      routingStatus: 'ready',
      routingProgress: 1,
      routingGraphUri: 'file:///ark/maps/pt-field-area-routing.tar',
      routingSizeBytes: 4096,
    });
    const routedRegion = await MapsRepository.getRegion(regionId);
    expect(routedRegion?.routingStatus).toBe('ready');
    expect(routedRegion?.routingGraphUri).toBe('file:///ark/maps/pt-field-area-routing.tar');

    await MapsRepository.updateRegionManifest(regionId, {
      name: 'Field area refreshed',
      manifestRegionId: 'pt-field-area',
      manifestVersion: 8,
      north: 39.1,
      south: 38.1,
      east: -7.9,
      west: -9.1,
      minZoom: 7,
      maxZoom: 15,
      estimatedSizeMb: 72,
      packFormat: 'pmtiles',
      packUrl: 'https://maps.example.test/pt-field-area-v2.pmtiles',
      dataVersion: '2026-06',
      checksumSha256: 'c'.repeat(64),
      checksumSha256Url: 'https://maps.example.test/pt-field-area-v2.pmtiles.sha256',
      regionUpdatedAt: '2026-06-01',
      routingPackUrl: 'https://maps.example.test/pt-field-area-routing-v2.tar',
      routingDataVersion: '2026-06-routing',
      routingChecksumSha256: 'd'.repeat(64),
    });
    const refreshedRegion = await MapsRepository.getRegion(regionId);
    expect(refreshedRegion?.name).toBe('Field area refreshed');
    expect(refreshedRegion?.manifestVersion).toBe(8);
    expect(refreshedRegion?.dataVersion).toBe('2026-06');
    expect(refreshedRegion?.checksumSha256).toBe('c'.repeat(64));
    expect(refreshedRegion?.estimatedSizeMb).toBe(72);
    expect(refreshedRegion?.routingPackUrl).toBe(
      'https://maps.example.test/pt-field-area-routing-v2.tar'
    );

    const markerId = await MapsRepository.createMarker({
      title: 'Water source',
      pinType: 'water',
      isEmergencyPin: true,
      latitude: 38.7,
      longitude: -9.1,
      photoUri: 'file:///ark/maps/water.jpg',
    });
    const marker = (await MapsRepository.listMarkers())[0];
    expect(marker?.id).toBe(markerId);
    expect(marker?.pinType).toBe('water');
    expect(marker?.isEmergencyPin).toBe(true);
    expect(marker?.photoUri).toBe('file:///ark/maps/water.jpg');

    await MapsRepository.updateMarker(markerId, {
      title: 'Filtered water',
      description: 'Spring near the north track',
      pinType: 'meeting_point',
      isEmergencyPin: false,
      photoUri: 'file:///ark/maps/spring.jpg',
    });
    const updatedMarker = await MapsRepository.getMarker(markerId);
    expect(updatedMarker?.title).toBe('Filtered water');
    expect(updatedMarker?.description).toBe('Spring near the north track');
    expect(updatedMarker?.pinType).toBe('meeting_point');
    expect(updatedMarker?.isEmergencyPin).toBe(false);
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

    const navigationRoute = {
      profile: 'pedestrian' as const,
      regionId,
      geometry: [
        { latitude: 38.7, longitude: -9.1 },
        { latitude: 38.8, longitude: -9.2 },
      ],
      distanceMeters: 1200,
      durationSeconds: 900,
      maneuvers: [
        {
          instruction: 'Walk north',
          distanceMeters: 1200,
          beginIndex: 0,
          endIndex: 1,
        },
      ],
    };
    const sessionId = await MapsRepository.createNavigationSession({
      destinationTitle: 'Filtered water',
      destination: { latitude: 38.8, longitude: -9.2 },
      profile: 'pedestrian',
      regionId,
      route: navigationRoute,
    });
    await MapsRepository.updateNavigationSession(sessionId, {
      remainingDistanceMeters: 900,
      currentManeuverIndex: 0,
      offRouteCount: 1,
      lastLocation: { latitude: 38.71, longitude: -9.11 },
    });
    const activeNavigation = await MapsRepository.getActiveNavigationSession();
    expect(activeNavigation?.destinationTitle).toBe('Filtered water');
    expect(activeNavigation?.route.distanceMeters).toBe(1200);
    expect(activeNavigation?.remainingDistanceMeters).toBe(900);
    expect(activeNavigation?.lastLocation?.latitude).toBe(38.71);

    await MapsRepository.upsertPlace({
      title: 'Porto pharmacy',
      subtitle: 'Cached emergency pharmacy result',
      latitude: 41.15,
      longitude: -8.61,
      source: 'photon',
      sourceRef: 'osm-node-123',
      terms: 'Porto pharmacy medicine',
    });
    await MapsRepository.upsertPlace({
      title: 'Coimbra',
      subtitle: 'Bundled city seed',
      latitude: 40.2,
      longitude: -8.41,
      source: 'bundled',
      sourceRef: 'pt-coimbra',
      terms: 'Portugal central city',
    });
    const places = await MapsRepository.searchPlaces('pharm', 5);
    expect(places[0]?.title).toBe('Porto pharmacy');
    expect(places[0]?.source).toBe('photon');
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
