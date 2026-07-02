import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { unzipSync } from 'fflate';

const files = new Map<string, { data: Uint8Array; isDirectory?: boolean }>();

mock.module('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    throw new Error('Backup tests inject a Bun SQLite database.');
  },
}));

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digest: async (algorithm: AlgorithmIdentifier, data: Uint8Array) =>
    crypto.subtle.digest(algorithm, data),
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

  private normalize(params: Params) {
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
let PreferencesService: typeof import('@/services/preferences/preferences.service').PreferencesService;

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
  ({ PreferencesService } = await import('@/services/preferences/preferences.service'));
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
    expect(inspected.manifest.settings.map((setting) => setting.key).sort()).toEqual([
      'battery.reduceModeEnabled',
      'downloads.wifiOnly',
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
    ]);
    expect(settings[0]).toBe('oled');
    expect(settings[1]).toBe('amber');
    expect(settings[2]).toContain('water');
    expect(settings[3]).toEqual({ water: true });
    expect(settings[4]).toBe(true);
    expect(settings[5]).toBe(true);

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

  const now = Date.now();
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
    new TextEncoder().encode('ark-backup-v1')
  ).decrypt(base64ToBytes(envelope.payload));
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
