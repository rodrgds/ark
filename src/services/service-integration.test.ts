import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';

const secureStore = new Map<string, string>();
let llamaStopCalls = 0;
let llamaCompletionGate: Promise<void> | null = null;
let llamaCompletionStarted: (() => void) | null = null;
let freeDiskStorageBytes = 10 * 1024 * 1024 * 1024;

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
  digest: async (algorithm: AlgorithmIdentifier, data: Uint8Array) =>
    crypto.subtle.digest(algorithm, data),
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

mock.module('expo-location', () => ({
  getForegroundPermissionsAsync: async () => ({ granted: true, status: 'granted' }),
}));

mock.module('expo-sensors', () => ({
  Accelerometer: { isAvailableAsync: async () => true },
  Barometer: { isAvailableAsync: async () => true },
  LightSensor: { isAvailableAsync: async () => true },
  Magnetometer: { isAvailableAsync: async () => true },
  Pedometer: { isAvailableAsync: async () => true },
}));

mock.module('@react-native-community/netinfo', () => ({
  default: {
    fetch: async () => ({ isConnected: true, isInternetReachable: true }),
    addEventListener: () => () => undefined,
  },
}));

mock.module('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
  notificationAsync: async () => undefined,
  selectionAsync: async () => undefined,
}));

mock.module('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///ark-test/',
  FileSystemSessionType: { BACKGROUND: 0 },
  EncodingType: { UTF8: 'utf8' },
  makeDirectoryAsync: async () => undefined,
  deleteAsync: async () => undefined,
  copyAsync: async () => undefined,
  getFreeDiskStorageAsync: async () => freeDiskStorageBytes,
  getTotalDiskCapacityAsync: async () => 64 * 1024 * 1024 * 1024,
  getInfoAsync: async (uri: string) => ({ exists: true, isDirectory: false, uri, size: 2048 }),
  readAsStringAsync: async () => '%PDF mock content',
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
  Appearance: {
    addChangeListener: () => ({ remove: () => undefined }),
    getColorScheme: () => 'dark',
  },
  Linking: {
    canOpenURL: async () => true,
    openURL: async () => undefined,
  },
  Platform: {
    OS: 'ios',
    select: (values: Record<string, unknown>) => values.ios ?? values.default,
  },
}));

mock.module('llama.rn', () => ({
  initLlama: async () => ({
    completion: async (
      _params: unknown,
      callback?: (data: { token?: string; accumulated_text?: string }) => void
    ) => {
      callback?.({ token: 'Local ', accumulated_text: 'Local ' });
      llamaCompletionStarted?.();
      if (llamaCompletionGate) await llamaCompletionGate;
      return { text: 'Local mocked llama response.' };
    },
    stopCompletion: async () => {
      llamaStopCalls += 1;
    },
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
let DatabaseEncryptionService: typeof import('@/services/db/encryption.service').DatabaseEncryptionService;
let VaultService: typeof import('@/services/security/vault.service').VaultService;
let ContentPackService: typeof import('@/services/content/content-pack.service').ContentPackService;
let OfflineMapService: typeof import('@/services/maps/offline-map.service').OfflineMapService;
let DiagnosticsService: typeof import('@/services/sensors/diagnostics.service').DiagnosticsService;
let RagService: typeof import('@/services/ai/rag.service').RagService;
let AIService: typeof import('@/services/ai/ai.service').AIService;
let ModelManagerService: typeof import('@/services/ai/model-manager.service').ModelManagerService;
let resetLlamaAdapterForTests: typeof import('@/services/ai/llama-adapter').resetLlamaAdapterForTests;
let RAG_HASH_EMBEDDING_MODEL_ID: typeof import('@/services/ai/rag-embedding').RAG_HASH_EMBEDDING_MODEL_ID;
let useAppStore: typeof import('@/stores/app-store').useAppStore;
let ContentRepository: typeof import('@/services/db/repositories/content.repo').ContentRepository;
let SettingsRepository: typeof import('@/services/db/repositories/settings.repo').SettingsRepository;
let NotesRepository: typeof import('@/services/db/repositories/notes.repo').NotesRepository;
let DownloadsRepository: typeof import('@/services/db/repositories/downloads.repo').DownloadsRepository;

let testDb: TestSQLiteDatabase;

beforeAll(async () => {
  ({ DatabaseClient } = await import('@/services/db/client'));
  ({ migrateDbIfNeeded } = await import('@/services/db/migrations'));
  ({ DatabaseEncryptionService } = await import('@/services/db/encryption.service'));
  ({ VaultService } = await import('@/services/security/vault.service'));
  ({ ContentPackService } = await import('@/services/content/content-pack.service'));
  ({ OfflineMapService } = await import('@/services/maps/offline-map.service'));
  ({ DiagnosticsService } = await import('@/services/sensors/diagnostics.service'));
  ({ RagService } = await import('@/services/ai/rag.service'));
  ({ AIService } = await import('@/services/ai/ai.service'));
  ({ ModelManagerService } = await import('@/services/ai/model-manager.service'));
  ({ resetLlamaAdapterForTests } = await import('@/services/ai/llama-adapter'));
  ({ RAG_HASH_EMBEDDING_MODEL_ID } = await import('@/services/ai/rag-embedding'));
  ({ useAppStore } = await import('@/stores/app-store'));
  ({ ContentRepository } = await import('@/services/db/repositories/content.repo'));
  ({ SettingsRepository } = await import('@/services/db/repositories/settings.repo'));
  ({ NotesRepository } = await import('@/services/db/repositories/notes.repo'));
  ({ DownloadsRepository } = await import('@/services/db/repositories/downloads.repo'));
});

beforeEach(async () => {
  secureStore.clear();
  llamaStopCalls = 0;
  llamaCompletionGate = null;
  llamaCompletionStarted = null;
  freeDiskStorageBytes = 10 * 1024 * 1024 * 1024;
  resetLlamaAdapterForTests?.();
  testDb?.close();
  testDb = new TestSQLiteDatabase();
  await migrateDbIfNeeded(testDb as never);
  DatabaseClient.setTestDbForTests(testDb as never);
  useAppStore?.setState({ booted: false, onboarding: null, vault: null, error: null });
});

describe('service integration', () => {
  test('app store completion persists onboarding handoff state', async () => {
    await useAppStore.getState().completeOnboarding();

    const persisted = await SettingsRepository.getOnboardingState();
    expect(persisted.completedAt).toBeNumber();
    expect(persisted.hasSeenIntro).toBe(true);
    expect(persisted.hasCreatedVault).toBe(true);
    expect(useAppStore.getState().onboarding?.completedAt).toBe(persisted.completedAt);
  });

  test('database encryption reports key storage and unresolved migration limits', async () => {
    const active = await DatabaseEncryptionService.applyKey(testDb as never);
    const status = await DatabaseEncryptionService.getRuntimeStatus(active);
    const storedKey = secureStore.get('ark.db.sqlcipherKey');

    expect(active).toBe(false);
    expect(status.keyStored).toBe(true);
    expect(status.keyStrategy).toBe('SecureStore device key');
    expect(status.migrationStatus).toContain('vault-passphrase rekey');
    expect(storedKey).toMatch(/^[a-f0-9]{64}$/);
  });

  test('database encryption replaces invalid stored keys before applying SQLCipher', async () => {
    secureStore.set('ark.db.sqlcipherKey', "bad-key'; DROP TABLE notes; --");

    const active = await DatabaseEncryptionService.applyKey(testDb as never);
    const storedKey = secureStore.get('ark.db.sqlcipherKey');

    expect(active).toBe(false);
    expect(storedKey).toMatch(/^[a-f0-9]{64}$/);
    expect(storedKey).not.toContain('DROP TABLE');
  });

  test(
    'vault initializes, unlocks, changes passphrase, and rejects the old one',
    async () => {
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
    },
    10_000
  );

  test(
    'vault upgrades v2 stretched verifiers after successful unlock',
    async () => {
      const salt = '0123456789abcdef0123456789abcdef';
      secureStore.set(
        'ark.vault.passwordVerifier',
        await deriveV2VerifierForTest('correct horse battery', salt)
      );
      await SettingsRepository.updateVaultState({
        isInitialized: true,
        kdfSalt: salt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect((await VaultService.unlockWithPassword('correct horse battery')).ok).toBe(true);
      expect(secureStore.get('ark.vault.passwordVerifier')).toStartWith('ark-v3:sha512:12000:');
    },
    10_000
  );

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
    expect(
      citations.some(
        (citation) =>
          citation.sourceRef === 'hesperian-first-aid' &&
          citation.sectionTitle === 'Bleeding and shock' &&
          citation.page === 9 &&
          citation.snippet === 'Direct pressure, danger signs, and shock response.' &&
          citation.targetHref ===
            '/content/hesperian-first-aid?section=Bleeding%20and%20shock'
      )
    ).toBe(true);

    const embeddedChunk = await testDb.getFirstAsync<{
      embedding_model_id: string | null;
      embedding_blob: Uint8Array | null;
    }>(
      `SELECT c.embedding_model_id, c.embedding_blob
       FROM rag_chunks c
       JOIN rag_sources s ON s.id = c.source_id
       WHERE s.source_ref = ? AND c.chunk_index = 2`,
      ['hesperian-first-aid']
    );
    expect(embeddedChunk?.embedding_model_id).toBe(RAG_HASH_EMBEDDING_MODEL_ID);
    expect(embeddedChunk?.embedding_blob?.byteLength).toBe(64 * 4);
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

  test('content pack install checks free storage before large downloads', async () => {
    freeDiskStorageBytes = 100 * 1024 * 1024;

    await expect(ContentPackService.installPack('wikipedia-simple-en-mini')).rejects.toThrow(
      'Not enough free storage'
    );
    expect(await DownloadsRepository.list()).toHaveLength(0);
  });

  test('offline map regions can be planned from saved spots', async () => {
    await OfflineMapService.createMarker({
      title: 'Water',
      latitude: 38.7,
      longitude: -9.2,
    });
    await OfflineMapService.createMarker({
      title: 'Shelter',
      latitude: 38.8,
      longitude: -9.1,
    });
    const markers = await OfflineMapService.listMarkers();

    const regionId = await OfflineMapService.createRegionFromMarkers({
      name: 'Saved spot coverage',
      markers,
      paddingKm: 5,
    });
    const region = (await OfflineMapService.listRegions()).find((item) => item.id === regionId);

    expect(region?.north ?? 0).toBeGreaterThan(38.8);
    expect(region?.south ?? 0).toBeLessThan(38.7);
    expect(region?.east ?? -180).toBeGreaterThan(-9.1);
    expect(region?.west ?? 180).toBeLessThan(-9.2);
    expect(region?.status).toBe('queued');
  });

  test('offline map regions validate manual bounds before saving', async () => {
    const regionId = await OfflineMapService.createRegionFromBounds({
      name: 'Manual field area',
      north: 39,
      south: 38,
      east: -8,
      west: -10,
      minZoom: 6.2,
      maxZoom: 12.8,
    });
    const region = (await OfflineMapService.listRegions()).find((item) => item.id === regionId);

    expect(region?.name).toBe('Manual field area');
    expect(region?.north).toBe(39);
    expect(region?.south).toBe(38);
    expect(region?.east).toBe(-8);
    expect(region?.west).toBe(-10);
    expect(region?.minZoom).toBe(6);
    expect(region?.maxZoom).toBe(13);

    await expect(
      OfflineMapService.createRegionFromBounds({
        name: 'Broken',
        north: 37,
        south: 38,
        east: -8,
        west: -10,
      })
    ).rejects.toThrow('North must be greater than south.');
  });

  test('offline map search covers saved spots, regions, and routes', async () => {
    await OfflineMapService.createMarker({
      title: 'Ridge water cache',
      description: 'Spring near the old wall.',
      latitude: 38.7,
      longitude: -9.2,
    });
    const markers = await OfflineMapService.listMarkers();
    await OfflineMapService.createRouteFromMarkers('Ridge route', markers);
    await OfflineMapService.createRegionFromBounds({
      name: 'Ridge coverage',
      north: 39,
      south: 38,
      east: -8,
      west: -10,
    });

    const results = await OfflineMapService.searchOffline('ridge');

    expect(results.map((result) => result.kind)).toEqual(['spot', 'region', 'route']);
    expect(results[0]?.title).toBe('Ridge water cache');
    expect(results[1]?.subtitle).toContain('queued');
    expect(results[2]?.subtitle).toContain('1 points');
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

  test('AI chat can cancel an active llama completion', async () => {
    await ContentRepository.createPack({
      id: 'custom-model-llama-cancel-test',
      title: 'Llama cancel test',
      description: 'Installed local model for cancellation coverage.',
      category: 'AI Models',
      format: 'gguf',
      localUri: 'file:///ark/models/qwen.gguf',
      installed: true,
      installStatus: 'installed',
      progress: 1,
    });

    let releaseCompletion!: () => void;
    const completionStarted = new Promise<void>((resolve) => {
      llamaCompletionStarted = resolve;
    });
    llamaCompletionGate = new Promise<void>((resolve) => {
      releaseCompletion = resolve;
    });
    const streamed: string[] = [];

    const pending = AIService.sendMessage(
      {
        content: 'Give me a short offline plan.',
        useRag: false,
      },
      { onToken: (content) => streamed.push(content) }
    );
    await completionStarted;
    expect(streamed).toEqual(['Local ']);
    await AIService.cancelActiveResponse();
    expect(llamaStopCalls).toBe(1);

    releaseCompletion();
    const result = await pending;
    expect(result.messages[1].content).toBe('Local mocked llama response.');
  });

  test('model manager reports runtime readiness for installed local models', async () => {
    let status = await ModelManagerService.getStatus();
    expect(status.adapter).toBe('mock');
    expect(status.installedModels).toBe(0);

    await ContentRepository.createPack({
      id: 'custom-model-status-test',
      title: 'Status model',
      description: 'Installed local model for status coverage.',
      category: 'AI Models',
      format: 'gguf',
      localUri: 'file:///ark/models/status.gguf',
      installed: true,
      installStatus: 'installed',
      progress: 1,
      sizeBytes: 900 * 1024 * 1024,
    });
    resetLlamaAdapterForTests();

    status = await ModelManagerService.getStatus();
    expect(status.adapter).toBe('llama');
    expect(status.installedModels).toBe(1);
    expect(status.activeModelTitle).toBe('Status model');
    expect(status.contextTokens).toBe(2048);
  });

  test('diagnostics reports the actual AI runtime status', async () => {
    let report = await DiagnosticsService.getReport();
    expect(report.aiAdapter).toBe('mock');
    expect(report.aiStatusMessage).toContain('No local model');

    await ContentRepository.createPack({
      id: 'custom-model-diagnostics-test',
      title: 'Diagnostics model',
      description: 'Installed local model for diagnostics coverage.',
      category: 'AI Models',
      format: 'gguf',
      localUri: 'file:///ark/models/diagnostics.gguf',
      installed: true,
      installStatus: 'installed',
      progress: 1,
    });
    resetLlamaAdapterForTests();

    report = await DiagnosticsService.getReport();
    expect(report.aiAdapter).toBe('llama');
    expect(report.aiStatusMessage).toContain('Diagnostics model');
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
  for (let index = 0; index < 200; index += 1) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for service state.');
}

async function deriveV2VerifierForTest(password: string, salt: string) {
  let digest = `${salt}:${password}`;
  for (let i = 0; i < 5000; i += 1) {
    const buffer = await crypto.subtle.digest(
      'SHA-512',
      new TextEncoder().encode(`${salt}:${i}:${digest}`)
    );
    digest = Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  }
  return `ark-v2:sha512:5000:${digest}`;
}
