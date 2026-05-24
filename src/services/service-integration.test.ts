import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { Database } from 'bun:sqlite';

const secureStore = new Map<string, string>();
let llamaStopCalls = 0;
let llamaCompletionGate: Promise<void> | null = null;
let llamaCompletionStarted: (() => void) | null = null;
let lastLlamaInitModel: string | null = null;
let freeDiskStorageBytes = 10 * 1024 * 1024 * 1024;
const mockFiles = new Map<string, { isDirectory: boolean; size?: number; text?: string }>();
let mockDownloadStatus = 200;
let mockDownloadMd5 = 'mock-md5';
let mockDownloadText = '%PDF-1.4 mock header';
let mockDownloadSize = 2048;
let mockPickedDocument: {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
  text?: string;
} | null = null;
let mockFetchText =
  '<html><body><main><h1>Guide</h1><p>Offline snapshot page.</p></main></body></html>';
let mockFetchStatus = 200;

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
  EncodingType: { UTF8: 'utf8' },
  FileSystemSessionType: { BACKGROUND: 0 },
  makeDirectoryAsync: async (uri: string) => {
    mockFiles.set(uri, { isDirectory: true });
  },
  deleteAsync: async (uri: string) => {
    mockFiles.delete(uri);
  },
  copyAsync: async ({ to }: { to: string }) => {
    mockFiles.set(to, {
      isDirectory: false,
      size: mockPickedDocument?.size ?? 2048,
      text: mockPickedDocument?.text ?? 'mock file',
    });
  },
  writeAsStringAsync: async (uri: string, text: string) => {
    mockFiles.set(uri, { isDirectory: false, size: text.length, text });
  },
  readDirectoryAsync: async (uri: string) =>
    Array.from(mockFiles.keys())
      .filter((key) => key.startsWith(uri) && key !== uri)
      .map((key) => key.slice(uri.length).split('/')[0])
      .filter((name, index, names) => name.length > 0 && names.indexOf(name) === index),
  readAsStringAsync: async (uri: string) => mockFiles.get(uri)?.text ?? '',
  getFreeDiskStorageAsync: async () => freeDiskStorageBytes,
  getTotalDiskCapacityAsync: async () => 64 * 1024 * 1024 * 1024,
  getInfoAsync: async (uri: string) => {
    const file = mockFiles.get(uri);
    if (!file) return { exists: false, isDirectory: false, uri };
    return { exists: true, isDirectory: file.isDirectory, uri, size: file.size ?? 0 };
  },
  createDownloadResumable: (
    _url: string,
    uri: string,
    _options: unknown,
    callback?: (event: { totalBytesExpectedToWrite: number; totalBytesWritten: number }) => void
  ) => ({
    downloadAsync: async () => {
      callback?.({
        totalBytesExpectedToWrite: mockDownloadSize,
        totalBytesWritten: mockDownloadSize,
      });
      mockFiles.set(uri, { isDirectory: false, size: mockDownloadSize, text: mockDownloadText });
      return { uri, status: mockDownloadStatus, headers: {}, mimeType: null, md5: mockDownloadMd5 };
    },
    pauseAsync: async () => ({ url: _url, fileUri: uri, options: {}, resumeData: 'resume-token' }),
    resumeAsync: async () => ({ uri, status: 200, headers: {}, mimeType: null, md5: 'mock-md5' }),
    savable: () => ({ url: _url, fileUri: uri, options: {}, resumeData: 'resume-token' }),
    cancelAsync: async () => undefined,
  }),
}));

mock.module('expo-document-picker', () => ({
  getDocumentAsync: async () =>
    mockPickedDocument
      ? {
          canceled: false,
          assets: [
            {
              name: mockPickedDocument.name,
              uri: mockPickedDocument.uri,
              mimeType: mockPickedDocument.mimeType,
              size: mockPickedDocument.size,
            },
          ],
        }
      : { canceled: true, assets: [] },
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
  initLlama: async (params: { model?: string }) => {
    lastLlamaInitModel = params.model ?? null;
    return {
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
      embedding: async (text: string) => ({
        embedding: Array.from({ length: 768 }, (_, index) =>
          text.toLowerCase().includes('water') && index === 0 ? 1 : index === 1 ? 0.5 : 0
        ),
      }),
    };
  },
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
let ZimService: typeof import('@/services/content/zim.service').ZimService;
let OfflineMapService: typeof import('@/services/maps/offline-map.service').OfflineMapService;
let DiagnosticsService: typeof import('@/services/sensors/diagnostics.service').DiagnosticsService;
let RagService: typeof import('@/services/ai/rag.service').RagService;
let AIService: typeof import('@/services/ai/ai.service').AIService;
let ModelManagerService: typeof import('@/services/ai/model-manager.service').ModelManagerService;
let ImportService: typeof import('@/services/files/import.service').ImportService;
let OcrService: typeof import('@/services/ocr/ocr.service').OcrService;
let resetLlamaAdapterForTests: typeof import('@/services/ai/llama-adapter').resetLlamaAdapterForTests;
let resetEmbeddingServiceForTests: typeof import('@/services/ai/embedding.service').resetEmbeddingServiceForTests;
let RAG_HASH_EMBEDDING_MODEL_ID: typeof import('@/services/ai/rag-embedding').RAG_HASH_EMBEDDING_MODEL_ID;
let RAG_HASH_EMBEDDING_DIMENSIONS: typeof import('@/services/ai/rag-embedding').RAG_HASH_EMBEDDING_DIMENSIONS;
let useAppStore: typeof import('@/stores/app-store').useAppStore;
let ContentRepository: typeof import('@/services/db/repositories/content.repo').ContentRepository;
let SettingsRepository: typeof import('@/services/db/repositories/settings.repo').SettingsRepository;
let NotesRepository: typeof import('@/services/db/repositories/notes.repo').NotesRepository;
let DownloadsRepository: typeof import('@/services/db/repositories/downloads.repo').DownloadsRepository;
let RssRepository: typeof import('@/services/db/repositories/rss.repo').RssRepository;
let WeatherRepository: typeof import('@/services/db/repositories/weather.repo').WeatherRepository;

let testDb: TestSQLiteDatabase;

beforeAll(async () => {
  ({ DatabaseClient } = await import('@/services/db/client'));
  ({ migrateDbIfNeeded } = await import('@/services/db/migrations'));
  ({ DatabaseEncryptionService } = await import('@/services/db/encryption.service'));
  ({ VaultService } = await import('@/services/security/vault.service'));
  ({ ContentPackService } = await import('@/services/content/content-pack.service'));
  ({ ZimService } = await import('@/services/content/zim.service'));
  ({ OfflineMapService } = await import('@/services/maps/offline-map.service'));
  ({ DiagnosticsService } = await import('@/services/sensors/diagnostics.service'));
  ({ RagService } = await import('@/services/ai/rag.service'));
  ({ AIService } = await import('@/services/ai/ai.service'));
  ({ ModelManagerService } = await import('@/services/ai/model-manager.service'));
  ({ ImportService } = await import('@/services/files/import.service'));
  ({ OcrService } = await import('@/services/ocr/ocr.service'));
  ({ resetLlamaAdapterForTests } = await import('@/services/ai/llama-adapter'));
  ({ resetEmbeddingServiceForTests } = await import('@/services/ai/embedding.service'));
  ({ RAG_HASH_EMBEDDING_MODEL_ID, RAG_HASH_EMBEDDING_DIMENSIONS } =
    await import('@/services/ai/rag-embedding'));
  ({ useAppStore } = await import('@/stores/app-store'));
  ({ ContentRepository } = await import('@/services/db/repositories/content.repo'));
  ({ SettingsRepository } = await import('@/services/db/repositories/settings.repo'));
  ({ NotesRepository } = await import('@/services/db/repositories/notes.repo'));
  ({ DownloadsRepository } = await import('@/services/db/repositories/downloads.repo'));
  ({ RssRepository } = await import('@/services/db/repositories/rss.repo'));
  ({ WeatherRepository } = await import('@/services/db/repositories/weather.repo'));
});

beforeEach(async () => {
  secureStore.clear();
  llamaStopCalls = 0;
  llamaCompletionGate = null;
  llamaCompletionStarted = null;
  lastLlamaInitModel = null;
  freeDiskStorageBytes = 10 * 1024 * 1024 * 1024;
  mockFiles.clear();
  mockDownloadStatus = 200;
  mockDownloadMd5 = 'mock-md5';
  mockDownloadText = '%PDF-1.4 mock header';
  mockDownloadSize = 2048;
  mockPickedDocument = null;
  mockFetchText =
    '<html><body><main><h1>Guide</h1><p>Offline snapshot page.</p></main></body></html>';
  mockFetchStatus = 200;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('.sha256')) {
      return {
        ok: true,
        status: 200,
        text: async () => '',
        headers: { get: () => 'text/plain' },
      } as Response;
    }
    return {
      ok: mockFetchStatus >= 200 && mockFetchStatus < 300,
      status: mockFetchStatus,
      text: async () => mockFetchText,
      headers: {
        get: (name: string) => (name.toLowerCase() === 'content-type' ? 'text/html' : null),
      },
    } as Response;
  }) as typeof fetch;
  resetLlamaAdapterForTests?.();
  resetEmbeddingServiceForTests?.();
  ZimService?.setNativeModuleForTests(undefined);
  OcrService?.setNativeModuleForTests(undefined);
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
  }, 10_000);

  test('vault upgrades v2 stretched verifiers after successful unlock', async () => {
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
  }, 10_000);

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
            '/content/reader?packId=hesperian-first-aid&section=Bleeding%20and%20shock&page=9'
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
    expect(embeddedChunk?.embedding_blob?.byteLength).toBe(RAG_HASH_EMBEDDING_DIMENSIONS * 4);
  });

  test('installed HTML snapshot packs are indexed from their downloaded body text', async () => {
    mockFetchText = `<html><body><main><h1>Power outage field notes</h1><p>Store a battery-powered weather radio and backup phone chargers in the same grab bin.</p><p>Test lantern batteries every month.</p></main></body></html>`;

    await ContentPackService.installPack('disaster-power-outage');
    await waitFor(async () => {
      const pack = await ContentPackService.getPack('disaster-power-outage');
      return pack?.installed === true;
    });

    const citations = await RagService.search(
      'battery-powered weather radio backup phone chargers',
      {
        limit: 3,
      }
    );
    expect(citations.some((citation) => citation.sourceRef === 'disaster-power-outage')).toBe(true);
  });

  test('installed PDF guide packs are indexed from extracted page text when available', async () => {
    OcrService.setNativeModuleForTests({
      recognizeText: async () => ({ text: '', blocks: [] }),
      extractPdfText: async () => ({
        pageCount: 2,
        pages: [
          {
            pageNumber: 1,
            text: 'Use triangular bandages to improvise an arm sling and secure it across the chest.',
            extractionMethod: 'text_layer',
          },
          {
            pageNumber: 2,
            text: 'Immobilize the elbow before transport and recheck circulation in the fingers.',
            extractionMethod: 'text_layer',
          },
        ],
      }),
      recognizePdf: async () => ({ pageCount: 0, pages: [] }),
    });

    await ContentPackService.installPack('hesperian-first-aid');
    await waitFor(async () => {
      const pack = await ContentPackService.getPack('hesperian-first-aid');
      return pack?.installed === true;
    });

    const citations = await RagService.search('triangular bandages improvise an arm sling', {
      limit: 3,
    });
    expect(citations.some((citation) => citation.sourceRef === 'hesperian-first-aid')).toBe(true);
  });

  test('RAG adds installed ZIM article search results when the native reader is available', async () => {
    await ContentRepository.createPack({
      id: 'custom-zim-rag-test',
      title: 'Field encyclopedia',
      description: 'Installed offline encyclopedia for ZIM search coverage.',
      category: 'Wiki',
      format: 'zim',
      localUri: 'file:///ark/content/field.zim',
      installed: true,
      installStatus: 'installed',
      progress: 1,
    });
    ZimService.setNativeModuleForTests({
      openArchive: async () => ({
        id: 'field',
        title: 'Field encyclopedia',
        articleCount: 1,
      }),
      search: async () => [
        {
          path: 'A/Water_storage',
          title: 'Water storage',
          snippet: 'Offline encyclopedia note for clean water storage.',
        },
      ],
      suggest: async () => [],
      getArticle: async () => ({
        finalPath: 'A/Water_storage',
        title: 'Water storage',
        mimeType: 'text/html',
        html: '<h2>Storage</h2><p>Clean water storage uses sealed containers, shade, and rotation so emergency supplies remain drinkable when the network is offline.</p>',
      }),
    });

    const citations = await RagService.search('water storage', { limit: 2 });
    const zimCitation = citations.find((citation) =>
      citation.sourceId.startsWith('zim:custom-zim-rag-test:')
    );

    expect(zimCitation?.title).toBe('Field encyclopedia: Water storage');
    expect(zimCitation?.snippet).toContain('Clean water storage uses sealed containers');
    expect(zimCitation?.sourceRef).toBe('custom-zim-rag-test');
    expect(zimCitation?.sectionTitle).toBe('Water storage');
    expect(zimCitation?.targetHref).toBe('/content/custom-zim-rag-test?article=A%2FWater_storage');
    expect(
      await testDb.getFirstAsync<{ id: string }>('SELECT id FROM rag_sources WHERE id = ?', [
        'zim:custom-zim-rag-test:A/Water_storage',
      ])
    ).not.toBeNull();
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

  test('content pack install rejects HTTP error pages instead of installing them', async () => {
    mockDownloadStatus = 403;
    mockDownloadText = '<html>The request is blocked.</html>';
    await ContentRepository.createPack({
      id: 'custom-guide-http-error-test',
      title: 'Blocked guide',
      description: 'Guide endpoint returns an HTML error page.',
      category: 'Survival',
      format: 'pdf',
      sourceUrl: 'https://example.test/blocked.pdf',
      installed: false,
    });

    await ContentPackService.installPack('custom-guide-http-error-test');
    await waitFor(async () => {
      const pack = await ContentPackService.getPack('custom-guide-http-error-test');
      return pack?.installStatus === 'failed';
    });

    const download = (await DownloadsRepository.list())[0];
    expect(download.status).toBe('failed');
    expect(download.error).toContain('HTTP 403');
    expect(mockFiles.has('file:///ark-test/ark/content/blocked.pdf')).toBe(false);
  });

  test('html guide installs as an offline snapshot with local image assets', async () => {
    mockFetchText = `
      <html>
        <body>
          <main>
            <h1>Power outage</h1>
            <p>Keep flashlights and batteries ready.</p>
            <img src="/images/kit.jpg" alt="Emergency kit" />
          </main>
        </body>
      </html>
    `;

    await ContentPackService.installPack('disaster-power-outage');
    await waitFor(async () => {
      const pack = await ContentPackService.getPack('disaster-power-outage');
      return pack?.installed === true;
    });

    const pack = await ContentPackService.getPack('disaster-power-outage');
    expect(pack?.localUri).toBe('file:///ark-test/ark/content/ready-power-outage/index.html');
    expect(mockFiles.has('file:///ark-test/ark/content/ready-power-outage/index.html')).toBe(true);
    expect(mockFiles.has('file:///ark-test/ark/content/ready-power-outage/assets/01-kit.jpg')).toBe(
      true
    );
    expect(
      mockFiles
        .get('file:///ark-test/ark/content/ready-power-outage/index.html')
        ?.text?.includes('assets/01-kit.jpg')
    ).toBe(true);
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

  test('AI chat persists tool use and assistant messages with RAG citations', async () => {
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
    expect(result.messages).toHaveLength(3);
    expect(result.messages[1].role).toBe('tool');
    expect(result.messages[1].content).toContain('Found');
    expect(result.messages[2].citations.length).toBeGreaterThan(0);

    const stored = await AIService.listMessages(result.threadId);
    expect(stored.map((message) => message.role)).toEqual(['user', 'tool', 'assistant']);
    expect(stored[2].citations[0]?.sourceRef).toBe(note.id);
  });

  test('imported text documents are indexed for RAG', async () => {
    mockPickedDocument = {
      name: 'water-plan.txt',
      uri: 'file:///picker/water-plan.txt',
      mimeType: 'text/plain',
      size: 96,
      text: 'Cache water in clean sealed containers and rotate the supply.',
    };

    const document = await ImportService.importDocument();
    expect(document?.extractedText).toContain('Cache water');

    const citations = await RagService.search('rotate water supply', { limit: 3 });
    expect(citations.some((citation) => citation.sourceRef === document?.id)).toBe(true);
    expect(citations.find((citation) => citation.sourceRef === document?.id)?.targetHref).toBe(
      `/documents/${document?.id}?page=1`
    );
  });

  test('imported images run OCR and become RAG sources', async () => {
    OcrService.setNativeModuleForTests({
      recognizeText: async () => ({
        text: 'Trailhead sign: north spring water cache',
        blocks: [{ text: 'Trailhead sign: north spring water cache' }],
      }),
      extractPdfText: async () => ({ pageCount: 0, pages: [] }),
      recognizePdf: async () => ({ pageCount: 0, pages: [] }),
    });
    mockPickedDocument = {
      name: 'trail-sign.jpg',
      uri: 'file:///picker/trail-sign.jpg',
      mimeType: 'image/jpeg',
      size: 4096,
      text: '',
    };

    const document = await ImportService.importDocument();
    expect(document?.ocrStatus).toBe('ready');
    expect(document?.ocrText).toContain('north spring');

    const citations = await RagService.search('north spring water', { limit: 3 });
    expect(citations.some((citation) => citation.sourceRef === document?.id)).toBe(true);
  });

  test('imported PDFs use text-layer extraction before OCR', async () => {
    OcrService.setNativeModuleForTests({
      recognizeText: async () => ({ text: '', blocks: [] }),
      extractPdfText: async () => ({
        pageCount: 2,
        pages: [
          {
            pageNumber: 1,
            text: 'Flood checklist: disinfect water with the correct bleach concentration before storage.',
            extractionMethod: 'text_layer',
          },
          {
            pageNumber: 2,
            text: 'Keep containers sealed, labeled, shaded, and rotated on a schedule so household emergency water remains safe to use during an outage.',
            extractionMethod: 'text_layer',
          },
        ],
      }),
      recognizePdf: async () => {
        throw new Error('OCR should not run for searchable PDFs.');
      },
    });
    mockPickedDocument = {
      name: 'flood-checklist.pdf',
      uri: 'file:///picker/flood-checklist.pdf',
      mimeType: 'application/pdf',
      size: 8192,
      text: '',
    };

    const document = await ImportService.importDocument();
    expect(document?.ocrStatus).toBe('searchable');
    expect(document?.extractedText).toContain('Page 1');

    const citations = await RagService.search('bleach concentration water', { limit: 3 });
    expect(citations.some((citation) => citation.sourceRef === document?.id)).toBe(true);
  });

  test('cached RSS items become Ask Arky sources', async () => {
    await RssRepository.seedFeeds([
      { title: 'Emergency Feed', url: 'https://example.test/rss.xml' },
    ]);
    const feed = (await RssRepository.listFeeds()).find((item) => item.title === 'Emergency Feed');
    expect(feed).toBeTruthy();
    await RssRepository.upsertItems([
      {
        id: 'rss-alert-water',
        feedId: feed!.id,
        title: 'Water advisory',
        summary: 'Boil tap water before drinking until crews clear the line.',
        content: 'Residents near the north bridge should boil water for one minute.',
        publishedAt: Date.now(),
      },
    ]);

    const citations = await RagService.search('north bridge water advisory', { limit: 2 });

    expect(citations.some((citation) => citation.sourceId === 'rss:rss-alert-water')).toBe(true);
    expect(
      citations.some((citation) => citation.targetHref === '/tools/news/rss-alert-water')
    ).toBe(true);
  });

  test('saved maps and cached weather become Ask Arky sources', async () => {
    await OfflineMapService.createMarker({
      title: 'North bridge water cache',
      description: 'Spare filter and sealed canteen stored under the east stair.',
      latitude: 38.711,
      longitude: -9.139,
    });
    const markers = await OfflineMapService.listMarkers();
    await OfflineMapService.createRouteFromMarkers('Bridge supply route', markers);
    await OfflineMapService.createRegionFromBounds({
      name: 'North bridge offline map',
      north: 39,
      south: 38,
      east: -8,
      west: -10,
    });
    await WeatherRepository.saveForecast({
      latitude: 38.711,
      longitude: -9.139,
      locationLabel: 'North bridge',
      provider: 'open-meteo',
      forecast: {
        summary: 'High wind after sunset with rain near the bridge.',
        pressureTrend: 'falling',
      },
    });

    const mapCitations = await RagService.search('where is the spare filter cache', { limit: 4 });
    const weatherCitations = await RagService.search('north bridge high wind rain pressure', {
      limit: 4,
    });

    expect(mapCitations.some((citation) => citation.sourceId.startsWith('map-marker:'))).toBe(true);
    expect(mapCitations.some((citation) => citation.targetHref === '/(tabs)/map')).toBe(true);
    expect(weatherCitations.some((citation) => citation.sourceId === 'weather:latest')).toBe(true);
    expect(weatherCitations.some((citation) => citation.targetHref === '/tools/weather')).toBe(
      true
    );
  });

  test('image imports do not fake OCR when the native module is missing', async () => {
    OcrService.setNativeModuleForTests(null);
    mockPickedDocument = {
      name: 'label.jpg',
      uri: 'file:///picker/label.jpg',
      mimeType: 'image/jpeg',
      size: 4096,
      text: '',
    };

    const document = await ImportService.importDocument();
    expect(document?.ocrStatus).toBe('unavailable');
    expect(document?.ocrText).toBe('');
    expect(document?.ocrError).toContain('Android development build');
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

  test('model manager only selects chat models and llama loads the selected one', async () => {
    await ContentRepository.createPack({
      id: 'embedding-nomic-v15-q4-k-m',
      title: 'Nomic Embed Text v1.5 Q4_K_M',
      description: 'Installed embedding model for retrieval.',
      category: 'AI Models',
      format: 'gguf',
      localUri: 'file:///ark/models/nomic.gguf',
      installed: true,
      installStatus: 'installed',
      progress: 1,
    });
    await ContentRepository.createPack({
      id: 'custom-model-alpha-test',
      title: 'Alpha chat model',
      description: 'First chat model.',
      category: 'AI Models',
      format: 'gguf',
      localUri: 'file:///ark/models/alpha.gguf',
      installed: true,
      installStatus: 'installed',
      progress: 1,
      sizeBytes: 900 * 1024 * 1024,
    });
    await ContentRepository.createPack({
      id: 'custom-model-bravo-test',
      title: 'Bravo chat model',
      description: 'Second chat model.',
      category: 'AI Models',
      format: 'gguf',
      localUri: 'file:///ark/models/bravo.gguf',
      installed: true,
      installStatus: 'installed',
      progress: 1,
      sizeBytes: 900 * 1024 * 1024,
    });

    await expect(
      ModelManagerService.setSelectedModel('embedding-nomic-v15-q4-k-m')
    ).rejects.toThrow('Choose a chat model');
    await ModelManagerService.setSelectedModel('custom-model-bravo-test');
    resetLlamaAdapterForTests();

    await AIService.sendMessage({ content: 'hello', useRag: false });

    expect(lastLlamaInitModel).toBe('file:///ark/models/bravo.gguf');
  });

  test('custom model URLs can be registered as search models without entering chat selection', async () => {
    const customSearchModel = await ContentPackService.addModelUrl({
      title: 'Custom Nomic Search',
      sourceUrl: 'https://example.test/custom-nomic.gguf',
      modelRole: 'embedding',
      checksum: '1111111111111111111111111111111111111111111111111111111111111111',
    });
    const customChatModel = await ContentPackService.addModelUrl({
      title: 'Custom Field Chat',
      sourceUrl: 'https://example.test/custom-chat.gguf',
      modelRole: 'chat',
    });

    expect(customSearchModel?.modelRole).toBe('embedding');
    expect(customChatModel?.modelRole).toBe('chat');
    expect(
      (await ModelManagerService.listAvailableEmbeddingModels()).map((model) => model.id)
    ).toContain(customSearchModel?.id);
    expect(
      (await ModelManagerService.listAvailableChatModels()).map((model) => model.id)
    ).toContain(customChatModel?.id);
    expect(
      (await ModelManagerService.listAvailableChatModels()).map((model) => model.id)
    ).not.toContain(customSearchModel?.id);
    await expect(ModelManagerService.setSelectedModel(customSearchModel!.id)).rejects.toThrow(
      'Choose a chat model'
    );
  });

  test('imported local search models stay out of chat selection', async () => {
    mockPickedDocument = {
      name: 'local-nomic.gguf',
      uri: 'file:///picker/local-nomic.gguf',
      size: 1024,
    };

    const imported = await ContentPackService.importLocalModel('embedding');

    expect(imported?.modelRole).toBe('embedding');
    expect(
      (await ModelManagerService.listAvailableEmbeddingModels()).map((model) => model.id)
    ).toContain(imported?.id);
    expect(
      (await ModelManagerService.listAvailableChatModels()).map((model) => model.id)
    ).not.toContain(imported?.id);
  });

  test('RAG uses installed embedding packs without selecting them for chat', async () => {
    await ContentRepository.createPack({
      id: 'embedding-nomic-v15-q4-k-m',
      title: 'Nomic Embed Text v1.5 Q4_K_M',
      description: 'Installed embedding model for retrieval.',
      category: 'AI Models',
      format: 'gguf',
      localUri: 'file:///ark/models/nomic.gguf',
      installed: true,
      installStatus: 'installed',
      progress: 1,
    });
    resetEmbeddingServiceForTests();
    resetLlamaAdapterForTests();

    const note = await NotesRepository.create({
      title: 'Water embedding note',
      body: 'Use clean containers for water storage.',
      tags: ['water'],
    });
    await RagService.indexNote(note.id);

    const embeddedChunk = await testDb.getFirstAsync<{
      embedding_model_id: string | null;
      embedding_blob: Uint8Array | null;
    }>(
      `SELECT c.embedding_model_id, c.embedding_blob
       FROM rag_chunks c
       JOIN rag_sources s ON s.id = c.source_id
       WHERE s.source_ref = ?`,
      [note.id]
    );
    expect(embeddedChunk?.embedding_model_id).toBe('embedding-nomic-v15-q4-k-m');
    expect(embeddedChunk?.embedding_blob?.byteLength).toBe(256 * 4);

    const status = await ModelManagerService.getStatus();
    expect(status.adapter).toBe('mock');
  });

  test('diagnostics reports the actual AI runtime status', async () => {
    let report = await DiagnosticsService.getReport();
    expect(report.aiAdapter).toBe('mock');
    expect(report.aiStatusMessage).toContain('No chat model');

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
