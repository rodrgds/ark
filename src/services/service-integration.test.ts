import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';

const secureStore = new Map<string, string>();

mock.module('expo-sqlite', () => ({
  openDatabaseAsync: async () => {
    throw new Error('Service tests inject a Bun SQLite database.');
  },
}));

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
    SHA512: 'SHA-512',
  },
  digestStringAsync: async (algorithm: AlgorithmIdentifier, data: string) => {
    const buffer = await crypto.subtle.digest(algorithm, new TextEncoder().encode(data));
    return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  },
  getRandomBytesAsync: async (length: number) => crypto.getRandomValues(new Uint8Array(length)),
  randomUUID: () => crypto.randomUUID(),
}));

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

mock.module('expo-local-authentication', () => ({
  hasHardwareAsync: async () => true,
  isEnrolledAsync: async () => true,
  authenticateAsync: async () => ({ success: true }),
}));

mock.module('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  notificationAsync: async () => undefined,
  selectionAsync: async () => undefined,
}));

mock.module('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///ark-test/',
  FileSystemSessionType: { BACKGROUND: 0 },
  makeDirectoryAsync: async () => undefined,
  deleteAsync: async () => undefined,
  copyAsync: async () => undefined,
  getInfoAsync: async (uri: string) => ({ exists: true, isDirectory: false, uri, size: 2048 }),
  createDownloadResumable: (
    _url: string,
    uri: string,
    _options: unknown,
    callback?: (event: { totalBytesExpectedToWrite: number; totalBytesWritten: number }) => void
  ) => ({
    downloadAsync: async () => {
      callback?.({ totalBytesExpectedToWrite: 2048, totalBytesWritten: 2048 });
      return { uri, status: 200, headers: {}, mimeType: null, md5: 'mock-md5' };
    },
    pauseAsync: async () => ({ url: _url, fileUri: uri, options: {}, resumeData: 'resume-token' }),
    resumeAsync: async () => ({ uri, status: 200, headers: {}, mimeType: null, md5: 'mock-md5' }),
    savable: () => ({ url: _url, fileUri: uri, options: {}, resumeData: 'resume-token' }),
    cancelAsync: async () => undefined,
  }),
}));

mock.module('expo-document-picker', () => ({
  getDocumentAsync: async () => ({ canceled: true, assets: [] }),
}));

mock.module('expo-sharing', () => ({
  isAvailableAsync: async () => false,
  shareAsync: async () => undefined,
}));

mock.module('react-native', () => ({
  Linking: {
    canOpenURL: async () => true,
    openURL: async () => undefined,
  },
}));

mock.module('llama.rn', () => ({
  initLlama: async () => ({
    completion: async () => ({ text: 'Local mocked llama response.' }),
  }),
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
let VaultService: typeof import('@/services/security/vault.service').VaultService;
let ContentPackService: typeof import('@/services/content/content-pack.service').ContentPackService;
let RagService: typeof import('@/services/ai/rag.service').RagService;
let AIService: typeof import('@/services/ai/ai.service').AIService;
let ContentRepository: typeof import('@/services/db/repositories/content.repo').ContentRepository;
let NotesRepository: typeof import('@/services/db/repositories/notes.repo').NotesRepository;
let DownloadsRepository: typeof import('@/services/db/repositories/downloads.repo').DownloadsRepository;

let testDb: TestSQLiteDatabase;

beforeAll(async () => {
  ({ DatabaseClient } = await import('@/services/db/client'));
  ({ migrateDbIfNeeded } = await import('@/services/db/migrations'));
  ({ VaultService } = await import('@/services/security/vault.service'));
  ({ ContentPackService } = await import('@/services/content/content-pack.service'));
  ({ RagService } = await import('@/services/ai/rag.service'));
  ({ AIService } = await import('@/services/ai/ai.service'));
  ({ ContentRepository } = await import('@/services/db/repositories/content.repo'));
  ({ NotesRepository } = await import('@/services/db/repositories/notes.repo'));
  ({ DownloadsRepository } = await import('@/services/db/repositories/downloads.repo'));
});

beforeEach(async () => {
  secureStore.clear();
  testDb?.close();
  testDb = new TestSQLiteDatabase();
  await migrateDbIfNeeded(testDb as never);
  DatabaseClient.setTestDbForTests(testDb as never);
});

describe('service integration', () => {
  test('vault initializes, unlocks, changes passphrase, and rejects the old one', async () => {
    const initialized = await VaultService.initializeVault('correct horse battery', 'horse', true);
    expect(initialized.ok).toBe(true);

    expect((await VaultService.unlockWithPassword('correct horse battery')).ok).toBe(true);
    expect((await VaultService.unlockWithBiometrics()).ok).toBe(true);

    const changed = await VaultService.changePassword({
      currentPassword: 'correct horse battery',
      nextPassword: 'new correct battery',
      passwordHint: 'new hint',
    });
    expect(changed.ok).toBe(true);
    expect((await VaultService.unlockWithPassword('correct horse battery')).ok).toBe(false);
    expect((await VaultService.unlockWithPassword('new correct battery')).ok).toBe(true);
  });

  test('content pack install downloads, completes, and indexes guide sections for RAG', async () => {
    await ContentPackService.installPack('hesperian-first-aid');
    await waitFor(async () => {
      const pack = await ContentPackService.getPack('hesperian-first-aid');
      return pack?.installed === true;
    });

    const pack = await ContentPackService.getPack('hesperian-first-aid');
    expect(pack?.localUri).toContain('hesperian-first-aid.pdf');
    expect(pack?.progress).toBe(1);

    const download = (await DownloadsRepository.list())[0];
    expect(download.status).toBe('completed');
    expect(download.checksumMd5).toBe('mock-md5');

    const citations = await RagService.search('bleeding shock', { limit: 2 });
    expect(citations.some((citation) => citation.sourceRef === 'hesperian-first-aid')).toBe(true);
  });

  test('content pack install rejects mismatched MD5 checksums', async () => {
    await ContentRepository.createPack({
      id: 'custom-model-checksum-test',
      title: 'Checksum model',
      description: 'Checksum verification test model.',
      category: 'AI Models',
      format: 'gguf',
      sourceUrl: 'https://example.test/model.gguf',
      checksumMd5: '00000000000000000000000000000000',
      installed: false,
    });

    await ContentPackService.installPack('custom-model-checksum-test');
    await waitFor(async () => {
      const pack = await ContentPackService.getPack('custom-model-checksum-test');
      return pack?.installStatus === 'failed';
    });

    const pack = await ContentPackService.getPack('custom-model-checksum-test');
    expect(pack?.installed).toBe(false);
    expect(pack?.progress).toBe(0);
    expect((await DownloadsRepository.list())[0]?.status).toBe('failed');
  });

  test('AI chat persists user and assistant messages with RAG citations', async () => {
    const note = await NotesRepository.create({
      title: 'Water note',
      body: 'Boil water before storing it in a clean container.',
      tags: ['water'],
    });
    await RagService.indexNote(note.id);

    const result = await AIService.sendMessage({
      content: 'How should I store water?',
      useRag: true,
    });
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1].citations.length).toBeGreaterThan(0);

    const stored = await AIService.listMessages(result.threadId);
    expect(stored.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(stored[1].citations[0]?.sourceRef).toBe(note.id);
  });

  test('content pack removal clears installed state and RAG source', async () => {
    await ContentRepository.updateInstallStatus({
      id: 'us-army-survival-fm-21-76',
      status: 'installed',
      progress: 1,
      localUri: 'file:///ark/content/survival.pdf',
    });
    await RagService.indexContentPack('us-army-survival-fm-21-76');
    expect((await RagService.search('shelter', { limit: 2 })).length).toBeGreaterThan(0);

    await ContentPackService.removePack('us-army-survival-fm-21-76');
    const pack = await ContentPackService.getPack('us-army-survival-fm-21-76');
    expect(pack?.installed).toBe(false);
    expect(await RagService.search('shelter', { limit: 2 })).toHaveLength(0);
  });
});

async function waitFor(predicate: () => Promise<boolean>) {
  for (let index = 0; index < 10; index += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for service state.');
}
