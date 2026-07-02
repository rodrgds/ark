import { beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';

const secureStore = new Map<string, string>();
const openCalls: Array<{ databaseName: string; options: unknown }> = [];
const mockFiles = new Set<string>();
const fileMoves: Array<{ from: string; to: string }> = [];
let randomByte = 7;
let mockOpenDatabaseAsync: (
  databaseName: string,
  options?: unknown
) => Promise<unknown> = async () => {
  throw new Error('Database client mutex tests wrap an injected database.');
};

mock.module('expo-sqlite', () => ({
  openDatabaseAsync: (databaseName: string, options?: unknown) =>
    mockOpenDatabaseAsync(databaseName, options),
}));

mock.module('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'when_unlocked_this_device_only',
  getItemAsync: async (key: string) => secureStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    secureStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    secureStore.delete(key);
  },
}));

mock.module('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
  digest: async (algorithm: AlgorithmIdentifier, data: Uint8Array) =>
    crypto.subtle.digest(algorithm, data),
  getRandomBytesAsync: async (length: number) => new Uint8Array(length).fill(randomByte),
  randomUUID: () => crypto.randomUUID(),
}));

mock.module('expo-file-system/legacy', () => ({
  getInfoAsync: async (uri: string) => ({ exists: mockFiles.has(uri), uri }),
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    if (!mockFiles.has(from)) throw new Error(`Missing file ${from}`);
    mockFiles.delete(from);
    mockFiles.add(to);
    fileMoves.push({ from, to });
  },
  deleteAsync: async (uri: string) => {
    mockFiles.delete(uri);
  },
}));

const mockFileSystem = {
  getInfoAsync: async (uri: string) => ({ exists: mockFiles.has(uri), uri }),
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    if (!mockFiles.has(from)) throw new Error(`Missing file ${from}`);
    mockFiles.delete(from);
    mockFiles.add(to);
    fileMoves.push({ from, to });
  },
  deleteAsync: async (uri: string) => {
    mockFiles.delete(uri);
  },
};

let wrapDatabaseForTests: typeof import('@/services/db/client').wrapDatabaseForTests;
let DatabaseClient: typeof import('@/services/db/client').DatabaseClient;
let DatabaseEncryptionService: typeof import('@/services/db/encryption.service').DatabaseEncryptionService;

beforeAll(async () => {
  ({ wrapDatabaseForTests, DatabaseClient } = await import('@/services/db/client'));
  ({ DatabaseEncryptionService } = await import('@/services/db/encryption.service'));
});

beforeEach(() => {
  secureStore.clear();
  openCalls.length = 0;
  mockFiles.clear();
  fileMoves.length = 0;
  randomByte = 7;
  mockOpenDatabaseAsync = async () => {
    throw new Error('Database client mutex tests wrap an injected database.');
  };
  DatabaseClient?.setTestDbForTests(null);
});

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function deferred<T = void>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class FakeSQLiteDatabase {
  keyed = false;
  closed = false;
  execs: string[] = [];
  databasePath = '/tmp/ark.db';

  constructor(
    readonly label: string,
    private readonly options: {
      runtimeActive?: boolean;
      failWhenKeyed?: boolean;
      failWhenUnkeyed?: boolean;
    } = {}
  ) {}

  async execAsync(sql: string) {
    this.execs.push(sql);
    if (sql.includes('PRAGMA key')) this.keyed = true;
    const attachedPath = sql.match(/ATTACH DATABASE '([^']+)'/)?.[1];
    if (attachedPath) mockFiles.add(toFileUri(attachedPath));
  }

  async getFirstAsync<T>(sql: string): Promise<T | null> {
    if (sql.includes('cipher_version')) {
      return (this.options.runtimeActive ? { cipher_version: '4.5.0' } : null) as T | null;
    }
    if (sql.includes('sqlite_master')) {
      if (!this.keyed && this.options.failWhenUnkeyed) {
        throw new Error('file is not a database');
      }
      if (this.keyed && this.options.failWhenKeyed) {
        throw new Error('file is not a database');
      }
      return { count: 1 } as T;
    }
    if (sql.includes('user_version')) {
      return { user_version: 1 } as T;
    }
    if (sql.includes('quick_check')) {
      return { quick_check: 'ok' } as T;
    }
    return null;
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }

  async runAsync() {
    return { changes: 1, lastInsertRowId: 1 };
  }

  async withTransactionAsync(callback: (tx: FakeSQLiteDatabase) => Promise<void>) {
    await callback(this);
  }

  async closeAsync() {
    this.closed = true;
  }
}

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

async function deriveSqlcipherKeyForTest(rootKey: string) {
  const material = new TextEncoder().encode(`ark:sqlcipher:v1:${rootKey.toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', material);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('DatabaseClient transaction mutex', () => {
  test('serializes outside queries until a transaction callback finishes', async () => {
    const events: string[] = [];
    const txDb = {
      execAsync: async (sql: string) => {
        events.push(`tx-exec:${sql}`);
      },
      getAllAsync: async () => [],
      getFirstAsync: async () => null,
      runAsync: async (sql: string) => {
        events.push(`tx-run:${sql}`);
        return { changes: 1, lastInsertRowId: 1 };
      },
    };
    const rawDb = {
      execAsync: async (sql: string) => {
        events.push(`raw-exec:${sql}`);
      },
      getAllAsync: async () => [],
      getFirstAsync: async () => null,
      runAsync: async (sql: string) => {
        events.push(`raw-run:${sql}`);
        return { changes: 1, lastInsertRowId: 1 };
      },
      withExclusiveTransactionAsync: async (callback: (tx: typeof txDb) => Promise<void>) => {
        events.push('tx-begin');
        await callback(txDb);
        events.push('tx-commit');
      },
      withTransactionAsync: async (callback: () => Promise<void>) => {
        events.push('raw-begin');
        await callback();
        events.push('raw-commit');
      },
    };
    const db = wrapDatabaseForTests(rawDb as never);
    const transactionStarted = deferred();
    const releaseTransaction = deferred();

    const transaction = db.withTransactionAsync(async (tx) => {
      events.push('transaction-start');
      await tx.runAsync('inside-transaction');
      transactionStarted.resolve();
      await releaseTransaction.promise;
      events.push('transaction-end');
    });

    await transactionStarted.promise;

    const outsideQuery = db.runAsync('outside-query');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).not.toContain('raw-run:outside-query');

    releaseTransaction.resolve();
    await Promise.all([transaction, outsideQuery]);

    expect(events.indexOf('tx-run:inside-transaction')).toBeGreaterThan(-1);
    expect(events.indexOf('raw-run:outside-query')).toBeGreaterThan(events.indexOf('tx-commit'));
  });

  test('opens SQLCipher-capable fresh installs as plaintext until encryption is enabled', async () => {
    const plaintextDb = new FakeSQLiteDatabase('plaintext', { runtimeActive: true });
    mockOpenDatabaseAsync = async (databaseName, options) => {
      openCalls.push({ databaseName, options });
      return plaintextDb;
    };

    await DatabaseClient.getDb();
    const status = await DatabaseEncryptionService.getRuntimeStatus(true, 'plaintext');

    expect(openCalls).toEqual([{ databaseName: 'ark.db', options: undefined }]);
    expect(plaintextDb.keyed).toBe(false);
    expect(secureStore.get('ark.security.rootKey.v1')).toBeUndefined();
    expect(status.active).toBe(false);
    expect(status.encryptionEnabled).toBe(false);
    expect(status.databaseState).toBe('plaintext');
  });

  test('exports and swaps an existing plaintext SQLCipher database into an encrypted copy', async () => {
    const plaintextDb = new FakeSQLiteDatabase('plaintext', { runtimeActive: true });
    const encryptedDb = new FakeSQLiteDatabase('encrypted', { runtimeActive: true });
    const dbs = [plaintextDb, encryptedDb];
    mockFiles.add('file:///tmp/ark.db');
    mockFiles.add('file:///tmp/ark.db-wal');

    mockOpenDatabaseAsync = async (databaseName, options) => {
      openCalls.push({ databaseName, options });
      const db = dbs.shift();
      if (!db) throw new Error('Unexpected extra database open.');
      return db;
    };

    await DatabaseClient.getDb();
    const result = await DatabaseClient.migratePlaintextDatabaseToEncrypted({
      fileSystem: mockFileSystem,
    });

    expect(result.reopenedEncrypted).toBe(true);
    expect(result.databasePath).toBe('/tmp/ark.db');
    expect(result.encryptedCopyPath).toMatch(/\/tmp\/ark\.db\.encrypted-\d+$/);
    expect(result.backupPath).toMatch(/\/tmp\/ark\.db\.plaintext-backup-\d+$/);
    expect(openCalls).toEqual([
      { databaseName: 'ark.db', options: undefined },
      { databaseName: 'ark.db', options: undefined },
    ]);
    expect(plaintextDb.closed).toBe(true);
    expect(encryptedDb.keyed).toBe(true);
    expect(plaintextDb.execs.some((sql) => sql.includes('sqlcipher_export'))).toBe(true);
    expect(
      plaintextDb.execs.some((sql) => sql.includes('PRAGMA ark_encrypted.user_version = 1'))
    ).toBe(true);
    expect(fileMoves).toEqual(
      expect.arrayContaining([
        {
          from: 'file:///tmp/ark.db',
          to: toFileUri(result.backupPath),
        },
        {
          from: toFileUri(result.encryptedCopyPath),
          to: 'file:///tmp/ark.db',
        },
      ])
    );
    expect(fileMoves).toContainEqual({
      from: 'file:///tmp/ark.db-wal',
      to: `${toFileUri(result.backupPath)}-wal`,
    });
  });

  test('exports and swaps an encrypted SQLCipher database back to plaintext', async () => {
    await DatabaseEncryptionService.setEncryptionEnabled(true);
    const encryptedDb = new FakeSQLiteDatabase('encrypted', { runtimeActive: true });
    const plaintextDb = new FakeSQLiteDatabase('plaintext', { runtimeActive: true });
    const dbs = [encryptedDb, plaintextDb];
    mockFiles.add('file:///tmp/ark.db');

    mockOpenDatabaseAsync = async (databaseName, options) => {
      openCalls.push({ databaseName, options });
      const db = dbs.shift();
      if (!db) throw new Error('Unexpected extra database open.');
      return db;
    };

    await DatabaseClient.getDb();
    const result = await DatabaseClient.migrateEncryptedDatabaseToPlaintext({
      fileSystem: mockFileSystem,
    });

    expect(result.reopenedPlaintext).toBe(true);
    expect(result.plaintextCopyPath).toMatch(/\/tmp\/ark\.db\.plaintext-\d+$/);
    expect(result.backupPath).toMatch(/\/tmp\/ark\.db\.encrypted-backup-\d+$/);
    expect(openCalls).toEqual([
      { databaseName: 'ark.db', options: undefined },
      { databaseName: 'ark.db', options: undefined },
    ]);
    expect(encryptedDb.closed).toBe(true);
    expect(encryptedDb.execs.some((sql) => sql.includes("AS ark_plaintext KEY ''"))).toBe(true);
    expect(encryptedDb.execs.some((sql) => sql.includes('sqlcipher_export'))).toBe(true);
    expect(plaintextDb.keyed).toBe(false);
    expect(secureStore.get('ark.db.encryptionPreference.v1')).toBe('disabled');
    expect(fileMoves).toEqual(
      expect.arrayContaining([
        {
          from: 'file:///tmp/ark.db',
          to: toFileUri(result.backupPath),
        },
        {
          from: toFileUri(result.plaintextCopyPath),
          to: 'file:///tmp/ark.db',
        },
      ])
    );
  });

  test('rotates the SQLCipher key for an encrypted database', async () => {
    await DatabaseEncryptionService.setEncryptionEnabled(true);
    const encryptedDb = new FakeSQLiteDatabase('encrypted', { runtimeActive: true });

    await DatabaseEncryptionService.applyKey(encryptedDb as never);
    randomByte = 8;
    const result = await DatabaseEncryptionService.rotateDatabaseKey(encryptedDb as never);
    const nextRootKey = '08'.repeat(32);
    const nextSqlcipherKey = await deriveSqlcipherKeyForTest(nextRootKey);

    expect(result.rotated).toBe(true);
    expect(secureStore.get('ark.security.rootKey.v1')).toBe(nextRootKey);
    expect(encryptedDb.execs).toContain(`PRAGMA rekey = "x'${nextSqlcipherKey}'"`);
  });
});
