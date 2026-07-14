import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const files = new Map<string, { data: Uint8Array; isDirectory?: boolean }>();

mock.module('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    throw new Error('Backup tests inject a Bun SQLite database.');
  },
}));

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: async (algorithm: AlgorithmIdentifier, data: Uint8Array) =>
    crypto.subtle.digest(algorithm, data as Uint8Array<ArrayBuffer>),
  getRandomBytesAsync: async (length: number) => crypto.getRandomValues(new Uint8Array(length)),
  randomUUID: () => crypto.randomUUID(),
}));

mock.module('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when_unlocked_this_device_only',
  setItemAsync: async () => undefined,
  getItemAsync: async () => null,
  deleteItemAsync: async () => undefined,
}));

mock.module('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  notificationAsync: async () => undefined,
  selectionAsync: async () => undefined,
}));

mock.module('expo-document-picker', () => ({
  getDocumentAsync: async () => ({ canceled: true, assets: [] }),
}));

mock.module('expo-sharing', () => ({
  isAvailableAsync: async () => true,
  shareAsync: async () => undefined,
}));

mock.module('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///ark-test/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  makeDirectoryAsync: async (uri: string) => {
    files.set(uri, { data: new Uint8Array(), isDirectory: true });
  },
  getInfoAsync: async (uri: string) => {
    const entry = files.get(uri);
    return entry
      ? {
          exists: true,
          isDirectory: !!entry.isDirectory,
          size: entry.data.byteLength,
        }
      : { exists: false, isDirectory: false };
  },
  readAsStringAsync: async (uri: string, options?: { encoding?: string }) => {
    const entry = files.get(uri);
    if (!entry) throw new Error(`Missing file ${uri}`);
    if (options?.encoding === 'base64') return bytesToBase64(entry.data);
    return new TextDecoder().decode(entry.data);
  },
  writeAsStringAsync: async (uri: string, value: string, options?: { encoding?: string }) => {
    files.set(uri, {
      data: options?.encoding === 'base64' ? base64ToBytes(value) : new TextEncoder().encode(value),
    });
  },
  readDirectoryAsync: async () => [],
  deleteAsync: async (uri: string) => {
    files.delete(uri);
  },
  getFreeDiskStorageAsync: async () => 5_000_000_000,
  getTotalDiskCapacityAsync: async () => 10_000_000_000,
}));

type Params = unknown[] | readonly unknown[] | undefined;

class TestSQLiteDatabase {
  readonly db = new Database(':memory:');

  async execAsync(sql: string) {
    this.db.exec(sql);
  }

  async runAsync(sql: string, params?: Params) {
    const stmt = this.db.query(sql);
    const result = stmt.run(...this.normalize(params));
    return { changes: result?.changes ?? 0, lastInsertRowId: result?.lastInsertRowid ?? 0 };
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

  private normalize(params: Params): any[] {
    return Array.from(params ?? [], (value) => (value === undefined ? null : value));
  }
}

let BackupService: typeof import('@/services/backup/backup.service').BackupService;
let DatabaseClient: typeof import('@/services/db/client').DatabaseClient;
let migrateDbIfNeeded: typeof import('@/services/db/migrations').migrateDbIfNeeded;
let NotesRepository: typeof import('@/services/db/repositories/notes.repo').NotesRepository;
let DocumentsRepository: typeof import('@/services/db/repositories/documents.repo').DocumentsRepository;
let DocumentPagesRepository: typeof import('@/services/db/repositories/document-pages.repo').DocumentPagesRepository;
let MapsRepository: typeof import('@/services/db/repositories/maps.repo').MapsRepository;
let RssRepository: typeof import('@/services/db/repositories/rss.repo').RssRepository;
let SettingsRepository: typeof import('@/services/db/repositories/settings.repo').SettingsRepository;
let TracksRepository: typeof import('@/services/db/repositories/tracks.repo').TracksRepository;
let PreferencesService: typeof import('@/services/preferences/preferences.service').PreferencesService;
let FileSystemService: typeof import('@/services/files/filesystem.service').FileSystemService;

let testDb: TestSQLiteDatabase;

const kdf = { N: 2 ** 10, r: 8, p: 1, dkLen: 32 as const };

beforeAll(async () => {
  ({ BackupService } = await import('@/services/backup/backup.service'));
  ({ DatabaseClient } = await import('@/services/db/client'));
  ({ migrateDbIfNeeded } = await import('@/services/db/migrations'));
  ({ NotesRepository } = await import('@/services/db/repositories/notes.repo'));
  ({ DocumentsRepository } = await import('@/services/db/repositories/documents.repo'));
  ({ DocumentPagesRepository } = await import('@/services/db/repositories/document-pages.repo'));
  ({ MapsRepository } = await import('@/services/db/repositories/maps.repo'));
  ({ RssRepository } = await import('@/services/db/repositories/rss.repo'));
  ({ SettingsRepository } = await import('@/services/db/repositories/settings.repo'));
  ({ TracksRepository } = await import('@/services/db/repositories/tracks.repo'));
  ({ PreferencesService } = await import('@/services/preferences/preferences.service'));
  ({ FileSystemService } = await import('@/services/files/filesystem.service'));
});

beforeEach(async () => {
  files.clear();
  testDb?.close();
  testDb = new TestSQLiteDatabase();
  await migrateDbIfNeeded(testDb as never);
  DatabaseClient.setTestDbForTests(testDb as never);
});

describe('encrypted Ark backups', () => {
  test('exports an encrypted arkbackup whose decrypted payload is manifest plus documents', async () => {
    await seedBackupData();

    const backup = await BackupService.createEncryptedBackup('correct horse battery', { kdf });
    const envelopeText = new TextDecoder().decode(backup.bytes);

    expect(backup.fileName.endsWith('.arkbackup')).toBe(true);
    expect(envelopeText).toContain('"format":"ark-backup-envelope"');
    expect(envelopeText).not.toContain('Water plan');
    expect(envelopeText).not.toContain('Keep 4 liters per person');

    await expect(
      BackupService.inspectEncryptedBackup(backup.bytes, 'wrong horse battery')
    ).rejects.toThrow('Backup passphrase did not match');

    const inspected = await BackupService.inspectEncryptedBackup(
      backup.bytes,
      'correct horse battery'
    );
    expect(inspected.entries).toContain('manifest.json');
    expect(inspected.entries.some((entry) => entry.startsWith('documents/'))).toBe(true);
    expect(inspected.manifest.notes[0]?.contentFormat).toBe('tiptap-json-v1');
    expect(inspected.manifest.notes[0]?.themeId).toBe('teal');
    expect(inspected.manifest.version).toBe(3);
    expect(inspected.manifest.tracks[0]?.title).toBe('Water cache scout');
    expect(inspected.manifest.trackPoints).toHaveLength(3);
    expect(inspected.manifest.trackMarkers[0]?.backupPath).toBe(
      'track-markers/track-marker-1/North-ridge-photo.jpg'
    );
    expect(inspected.manifest.settings.map((setting) => setting.key).sort()).toEqual([
      'battery.reduceModeEnabled',
      'downloads.wifiOnly',
      'field.defaultTrackActivity',
      'field.rateMode',
      'field.recordingProfile',
      'field.unitSystem',
      'label.colors',
      'label.registry',
      'notes.sortMode',
      'theme.accentPreference',
      'theme.preference',
      'tools.readiness-checklist',
    ]);
    expect(inspected.manifest.documents[0]?.backupPath?.startsWith('documents/')).toBe(true);
    expect(inspected.manifest.excludes).toContain('models');
    expect(inspected.manifest.excludes).toContain('embeddings');
    expect(JSON.stringify(inspected.manifest)).not.toContain('rss_items');
    expect(JSON.stringify(inspected.manifest)).not.toContain('Download cache');
    expect(JSON.stringify(inspected.manifest)).not.toContain('extractedText');
    expect(JSON.stringify(inspected.manifest)).not.toContain('ocrText');
  });

  test('imports durable data and leaves OCR, RAG, RSS item, map pack, and download caches out', async () => {
    await seedBackupData();
    const backup = await BackupService.createEncryptedBackup('correct horse battery', { kdf });

    testDb.close();
    testDb = new TestSQLiteDatabase();
    await migrateDbIfNeeded(testDb as never);
    DatabaseClient.setTestDbForTests(testDb as never);

    const result = await BackupService.importEncryptedBackup(backup.bytes, 'correct horse battery');

    expect(result.restored).toMatchObject({
      notes: 1,
      documents: 1,
      mapMarkers: 1,
      routes: 1,
      tracks: 1,
      rssFeeds: 1,
    });

    const notes = await NotesRepository.list();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      title: 'Water plan',
      body: 'Keep 4 liters per person.',
      contentHtml: '<p><strong>Keep water</strong></p>',
      contentFormat: 'tiptap-json-v1',
      themeId: 'teal',
      isFavorite: true,
    });

    const settings = await Promise.all([
      SettingsRepository.get('theme.preference'),
      SettingsRepository.get('theme.accentPreference'),
      SettingsRepository.get('label.registry'),
      PreferencesService.getReadinessChecklist(),
      PreferencesService.getBatteryReduceModeEnabled(),
      PreferencesService.getWifiOnlyDownloadsEnabled(),
      PreferencesService.getFieldPreferences(),
    ]);
    expect(settings[0]).toBe('oled');
    expect(settings[1]).toBe('amber');
    expect(settings[2]).toContain('water');
    expect(settings[3]).toEqual({ water: true });
    expect(settings[4]).toBe(true);
    expect(settings[5]).toBe(true);
    expect(settings[6]).toEqual({
      unitSystem: 'imperial',
      rateMode: 'pace',
      defaultTrackActivity: 'scout',
      recordingProfile: 'conserve',
    });

    const documents = await DocumentsRepository.list();
    expect(documents).toHaveLength(1);
    expect(documents[0]?.title).toBe('water-plan.txt');
    expect(documents[0]?.extractedText).toBeNull();
    expect(documents[0]?.ocrText).toBeNull();
    expect(documents[0]?.indexedAt).toBeNull();
    expect(documents[0]?.localUri).toContain('imports/doc-water-water-plan.txt');
    expect(new TextDecoder().decode(files.get(documents[0]?.localUri ?? '')?.data)).toContain(
      'Stored document body'
    );
    expect(await DocumentPagesRepository.listForDocument('doc-water')).toEqual([
      expect.objectContaining({
        documentId: 'doc-water',
        pageNumber: 1,
        text: 'Page index should not be backed up.',
        extractionMethod: 'manual',
      }),
    ]);

    expect(await MapsRepository.listMarkers()).toHaveLength(1);
    expect(await MapsRepository.listRoutes()).toHaveLength(1);
    const tracks = await TracksRepository.listTracks();
    expect(tracks).toHaveLength(1);
    expect(tracks[0]).toMatchObject({
      title: 'Water cache scout',
      activityType: 'scout',
      status: 'finished',
      markerCount: 1,
      sampleCount: 3,
    });
    expect(await TracksRepository.listPoints('track-water')).toHaveLength(3);
    const trackMarkers = await TracksRepository.listMarkers('track-water');
    expect(trackMarkers).toHaveLength(1);
    expect(trackMarkers[0]?.photoUri).toBe(
      'file:///ark-test/ark/tracks/track-marker-1-North-ridge-photo.jpg'
    );
    expect(new TextDecoder().decode(files.get(trackMarkers[0]?.photoUri ?? '')?.data)).toContain(
      'fake jpg'
    );
    expect(await RssRepository.listFeeds()).toHaveLength(1);
    expect(await RssRepository.listRecentItems()).toEqual([]);
    expect(await testDb.getAllAsync('SELECT * FROM downloads')).toEqual([]);
    expect(await testDb.getAllAsync('SELECT * FROM map_regions')).toEqual([]);
    expect(await testDb.getAllAsync('SELECT * FROM rag_sources')).toEqual([]);

    const zip = unzipSync(
      (await BackupService.inspectEncryptedBackup(backup.bytes, 'correct horse battery')).entries
        ? await decryptForShapeOnly(backup.bytes)
        : new Uint8Array()
    );
    expect(Object.keys(zip).sort()).toEqual([
      'documents/doc-water/water-plan.txt',
      'manifest.json',
      'track-markers/track-marker-1/North-ridge-photo.jpg',
    ]);
  });

  test('round-trips chat threads, chat messages, and rebuilds FTS indexes', async () => {
    await seedBackupData();
    const backup = await BackupService.createEncryptedBackup('correct horse battery', { kdf });

    const inspected = await BackupService.inspectEncryptedBackup(
      backup.bytes,
      'correct horse battery'
    );
    expect(inspected.manifest.chatThreads).toHaveLength(1);
    expect(inspected.manifest.chatThreads[0]?.id).toBe('thread-survival');
    expect(inspected.manifest.chatMessages).toHaveLength(2);
    expect(inspected.manifest.chatMessages.map((m) => m.role).sort()).toEqual([
      'assistant',
      'user',
    ]);

    testDb.close();
    testDb = new TestSQLiteDatabase();
    await migrateDbIfNeeded(testDb as never);
    DatabaseClient.setTestDbForTests(testDb as never);

    await BackupService.importEncryptedBackup(backup.bytes, 'correct horse battery');

    const restoredThreads = await testDb.getAllAsync<{ id: string; title: string }>(
      `SELECT id, title FROM chat_threads ORDER BY id`
    );
    expect(restoredThreads).toEqual([{ id: 'thread-survival', title: 'Survival plan' }]);

    const restoredMessages = await testDb.getAllAsync<{
      role: string;
      content: string;
    }>(`SELECT role, content FROM chat_messages ORDER BY created_at ASC`);
    expect(restoredMessages).toEqual([
      { role: 'user', content: 'How much water per day?' },
      { role: 'assistant', content: 'At least 4 liters per person.' },
    ]);

    const ftsRow = await testDb.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM notes_fts WHERE notes_fts MATCH 'water'`
    );
    expect(ftsRow?.count ?? 0).toBeGreaterThan(0);
  });

  test('rejects attacker-controlled scrypt work factors before decryption', async () => {
    await seedBackupData();
    const backup = await BackupService.createEncryptedBackup('correct horse battery', { kdf });
    const envelope = JSON.parse(new TextDecoder().decode(backup.bytes));
    envelope.crypto.N = 2 ** 20;

    await expect(
      BackupService.inspectEncryptedBackup(
        new TextEncoder().encode(JSON.stringify(envelope)),
        'correct horse battery'
      )
    ).rejects.toThrow('outside Ark safety limits');
  });

  test('rejects unsafe archive paths and manifest identifiers', async () => {
    await seedBackupData();
    const backup = await BackupService.createEncryptedBackup('correct horse battery', { kdf });

    const unsafeEntry = await rewriteBackup(backup.bytes, (zip) => {
      zip['../outside.txt'] = strToU8('unsafe');
    });
    await expect(
      BackupService.inspectEncryptedBackup(unsafeEntry, 'correct horse battery')
    ).rejects.toThrow('unsafe archive entry');

    const unsafeManifest = await rewriteBackup(backup.bytes, (zip) => {
      const manifest = JSON.parse(strFromU8(zip['manifest.json']!));
      manifest.documents[0].id = '../outside';
      zip['manifest.json'] = strToU8(JSON.stringify(manifest));
    });
    await expect(
      BackupService.inspectEncryptedBackup(unsafeManifest, 'correct horse battery')
    ).rejects.toThrow('invalid identifier');
  });

  test('does not restore unpackaged file URIs from a backup manifest', async () => {
    await seedBackupData();
    const backup = await BackupService.createEncryptedBackup('correct horse battery', { kdf });
    const crafted = await rewriteBackup(backup.bytes, (zip) => {
      const manifest = JSON.parse(strFromU8(zip['manifest.json']!));
      manifest.mapMarkers[0].photoUri = 'file:///ark-test/ark/imports/unrelated.txt';
      zip['manifest.json'] = strToU8(JSON.stringify(manifest));
    });

    await BackupService.importEncryptedBackup(crafted, 'correct horse battery');

    expect((await MapsRepository.listMarkers())[0]?.photoUri).toBeNull();
  });

  test('only deletes files inside Ark-managed storage', async () => {
    const managedUri = 'file:///ark-test/ark/imports/document.pdf';
    files.set(managedUri, { data: strToU8('managed') });

    await FileSystemService.deleteByUri(managedUri);
    expect(files.has(managedUri)).toBe(false);

    const outsideUri = 'file:///ark-test/unrelated.txt';
    files.set(outsideUri, { data: strToU8('outside') });
    await expect(FileSystemService.deleteByUri(outsideUri)).rejects.toThrow(
      'outside Ark-managed storage'
    );
    await expect(
      FileSystemService.deleteByUri('file:///ark-test/ark/imports/%2E%2E/%2E%2E/unrelated.txt')
    ).rejects.toThrow('outside Ark-managed storage');
    expect(files.has(outsideUri)).toBe(true);
  });
});

async function seedBackupData() {
  await SettingsRepository.set('theme.preference', 'oled');
  await SettingsRepository.set('theme.accentPreference', 'amber');
  await SettingsRepository.set('label.registry', JSON.stringify(['water']));
  await SettingsRepository.set('label.colors', JSON.stringify({ water: '#0f766e' }));
  await SettingsRepository.set('notes.sortMode', 'manual');
  await PreferencesService.setReadinessChecklist({ water: true });
  await PreferencesService.setBatteryReduceModeEnabled(true);
  await PreferencesService.setWifiOnlyDownloadsEnabled(true);
  await PreferencesService.setFieldPreferences({
    unitSystem: 'imperial',
    rateMode: 'pace',
    defaultTrackActivity: 'scout',
    recordingProfile: 'conserve',
  });

  await NotesRepository.create({
    title: 'Water plan',
    body: 'Keep 4 liters per person.',
    contentHtml: '<p><strong>Keep water</strong></p>',
    contentJson: JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Keep water' }] }],
    }),
    contentFormat: 'tiptap-json-v1',
    tags: ['water'],
    themeId: 'teal',
  });
  const note = (await NotesRepository.list())[0]!;
  await NotesRepository.update(note.id, { isFavorite: true });

  const documentUri = 'file:///ark-test/source/water-plan.txt';
  files.set(documentUri, { data: new TextEncoder().encode('Stored document body') });
  await DocumentsRepository.create({
    id: 'doc-water',
    title: 'water-plan.txt',
    mimeType: 'text/plain',
    localUri: documentUri,
    sizeBytes: files.get(documentUri)!.data.byteLength,
    source: 'document-picker',
    encryptionStatus: 'plaintext',
    ocrStatus: 'not_needed',
  });
  await DocumentsRepository.updateText('doc-water', {
    extractedText: 'OCR/cache text should not be backed up.',
    ocrText: 'OCR cache should not be backed up.',
    indexedAt: Date.now(),
  });
  await DocumentPagesRepository.replaceForDocument('doc-water', 'water-plan.txt', [
    {
      pageNumber: 1,
      text: 'Page index should not be backed up.',
      extractionMethod: 'manual',
    },
  ]);

  await MapsRepository.createMarker({
    title: 'Water cache',
    description: 'Behind the north shed',
    pinType: 'water',
    latitude: 38.72,
    longitude: -9.14,
  });
  await MapsRepository.createRoute({
    title: 'Water route',
    points: [{ latitude: 38.72, longitude: -9.14, title: 'Water cache' }],
    distanceMeters: 1200,
  });
  await RssRepository.addFeed('Emergency feed', 'https://example.test/rss.xml');
  const feed = (await RssRepository.listFeeds())[0]!;
  await RssRepository.upsertItems([
    {
      id: 'rss-cache',
      feedId: feed.id,
      title: 'Cached item',
      content: 'RSS item cache should not be backed up.',
    },
  ]);

  const now = Date.now();
  const trackStartedAt = now - 120_000;
  const photoUri = 'file:///ark-test/source/north-ridge-photo.jpg';
  files.set(photoUri, { data: new TextEncoder().encode('fake jpg bytes') });
  await testDb.runAsync(
    `INSERT INTO tracks
       (id, title, description, activity_type, status, started_at, ended_at,
        timezone_offset_minutes, distance_meters, total_time_seconds, moving_time_seconds,
        average_speed_mps, average_moving_speed_mps, max_speed_mps, elevation_gain_meters,
        elevation_loss_meters, min_elevation_meters, max_elevation_meters, sample_count,
        marker_count, recording_gap_count, last_error, created_at, updated_at, deleted_at)
     VALUES
       ('track-water', 'Water cache scout', 'Route to the cache', 'scout', 'finished', ?, ?,
        0, 142.5, 120, 110, 1.18, 1.29, 1.8, 12, 4, 81, 93, 3, 1, 0, NULL, ?, ?, NULL)`,
    [trackStartedAt, now, trackStartedAt, now]
  );
  await testDb.runAsync(
    `INSERT INTO track_points
       (id, track_id, segment_index, point_index, kind, latitude, longitude, altitude_meters,
        altitude_source, pressure_hpa, horizontal_accuracy_meters, vertical_accuracy_meters,
        speed_mps, bearing_degrees, distance_from_previous_meters, elapsed_seconds,
        moving_elapsed_seconds, recorded_at, created_at)
     VALUES
       ('track-point-1', 'track-water', 0, 0, 'start', 38.7200, -9.1400, 81,
        'gps', 1014.1, 6, 4, 0, 20, 0, 0, 0, ?, ?),
       ('track-point-2', 'track-water', 0, 1, 'sample', 38.7204, -9.1408, 93,
        'gps', 1013.8, 8, 5, 1.4, 24, 82.5, 60, 55, ?, ?),
       ('track-point-3', 'track-water', 0, 2, 'stop', 38.7209, -9.1412, 89,
        'gps', 1013.5, 7, 4, 1.1, 26, 60, 120, 110, ?, ?)`,
    [trackStartedAt, trackStartedAt, trackStartedAt + 60_000, trackStartedAt + 60_000, now, now]
  );
  await testDb.runAsync(
    `INSERT INTO track_markers
       (id, track_id, map_marker_id, title, description, marker_type, latitude, longitude,
        altitude_meters, recorded_at, elapsed_seconds, distance_meters, photo_uri, created_at,
        updated_at)
     VALUES
       ('track-marker-1', 'track-water', NULL, 'North ridge photo.jpg', 'Visible cache approach',
        'photo', 38.7204, -9.1408, 93, ?, 60, 82.5, ?, ?, ?)`,
    [trackStartedAt + 60_000, photoUri, trackStartedAt + 60_000, now]
  );

  await testDb.runAsync(
    `INSERT INTO downloads (id, kind, title, source_url, local_uri, status, created_at, updated_at)
     VALUES ('download-cache', 'guide', 'Download cache', 'https://example.test/file', 'file:///tmp/file', 'completed', 1, 1)`
  );
  await testDb.runAsync(
    `INSERT INTO map_regions (id, name, provider, status, progress, created_at, updated_at)
     VALUES ('map-cache', 'Map cache', 'maplibre', 'downloaded', 1, 1, 1)`
  );
  await testDb.runAsync(
    `INSERT INTO rag_sources (id, kind, source_ref, title, updated_at, created_at)
     VALUES ('document:doc-water', 'document', 'doc-water', 'RAG cache', 1, 1)`
  );

  await testDb.runAsync(
    `INSERT INTO chat_threads (id, title, selected_model_id, chat_model_disabled, created_at, updated_at)
     VALUES ('thread-survival', 'Survival plan', NULL, 0, ?, ?)`,
    [now, now]
  );
  await testDb.runAsync(
    `INSERT INTO chat_messages
       (id, thread_id, role, content, citations_json, reasoning, metadata_json, deleted_at, created_at)
     VALUES
       ('msg-1', 'thread-survival', 'user', 'How much water per day?', NULL, NULL, NULL, NULL, ?),
       ('msg-2', 'thread-survival', 'assistant', 'At least 4 liters per person.', '[]', NULL, NULL, NULL, ?)`,
    [now + 1, now + 2]
  );
}

async function decryptForShapeOnly(bytes: Uint8Array) {
  const { BackupService: Service } = await import('@/services/backup/backup.service');
  const inspected = await Service.inspectEncryptedBackup(bytes, 'correct horse battery');
  expect(inspected.entries).toContain('manifest.json');
  const envelope = JSON.parse(new TextDecoder().decode(bytes)) as {
    crypto: { salt: string; nonce: string; N: number; r: number; p: number; dkLen: 32 };
    payload: string;
  };
  const { scryptAsync } = await import('@noble/hashes/scrypt.js');
  const { gcm } = await import('@noble/ciphers/aes.js');
  const key = await scryptAsync('correct horse battery', base64ToBytes(envelope.crypto.salt), {
    N: envelope.crypto.N,
    r: envelope.crypto.r,
    p: envelope.crypto.p,
    dkLen: envelope.crypto.dkLen,
    asyncTick: 10,
  });
  return gcm(
    key,
    base64ToBytes(envelope.crypto.nonce),
    new TextEncoder().encode('ark-backup-v3')
  ).decrypt(base64ToBytes(envelope.payload));
}

async function rewriteBackup(bytes: Uint8Array, mutate: (zip: Record<string, Uint8Array>) => void) {
  const envelope = JSON.parse(new TextDecoder().decode(bytes)) as {
    crypto: { salt: string; nonce: string; N: number; r: number; p: number; dkLen: 32 };
    payload: string;
  };
  const { scryptAsync } = await import('@noble/hashes/scrypt.js');
  const { gcm } = await import('@noble/ciphers/aes.js');
  const key = await scryptAsync('correct horse battery', base64ToBytes(envelope.crypto.salt), {
    N: envelope.crypto.N,
    r: envelope.crypto.r,
    p: envelope.crypto.p,
    dkLen: envelope.crypto.dkLen,
    asyncTick: 10,
  });
  const nonce = base64ToBytes(envelope.crypto.nonce);
  const aad = new TextEncoder().encode('ark-backup-v3');
  const zip = unzipSync(gcm(key, nonce, aad).decrypt(base64ToBytes(envelope.payload)));
  mutate(zip);
  envelope.payload = bytesToBase64(gcm(key, nonce, aad).encrypt(zipSync(zip, { level: 6 })));
  return new TextEncoder().encode(JSON.stringify(envelope));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
