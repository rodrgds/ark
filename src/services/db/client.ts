import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DATABASE_ENCRYPTION_STATE, DB_NAME } from '@/services/db/schema';
import { migrateDbIfNeeded } from '@/services/db/migrations';
import { SHOULD_USE_SYNCHRONOUS_SQLITE } from '@/services/db/sqlite-runtime';
import {
  DatabaseEncryptionService,
  type DatabaseFileSystem,
} from '@/services/db/encryption.service';

export type ArkTransactionTask = (tx: SQLiteDatabase) => Promise<void>;

export type ArkSQLiteDatabase = Omit<SQLiteDatabase, 'withTransactionAsync'> & {
  withTransactionAsync(callback: ArkTransactionTask): Promise<void>;
};

type SQLiteDatabaseWithExclusive = SQLiteDatabase & {
  withExclusiveTransactionAsync?: (
    callback: (tx: SQLiteDatabase) => Promise<void>
  ) => Promise<void>;
};

type SQLiteSyncDatabase = SQLiteDatabase & {
  closeSync?: () => void;
  execSync?: (source: string) => void;
  runSync?: (
    ...args: Parameters<SQLiteDatabase['runAsync']>
  ) => Awaited<ReturnType<SQLiteDatabase['runAsync']>>;
  getFirstSync?: <T>(...args: Parameters<SQLiteDatabase['getFirstAsync']>) => T | null;
  getAllSync?: <T>(...args: Parameters<SQLiteDatabase['getAllAsync']>) => T[];
};

class SQLiteMutex {
  private queue: Promise<any> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
}

const dbMutex = new SQLiteMutex();

function isExclusiveTransactionUnsupported<T>(error: T) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('withexclusivetransactionasync is not supported')
  );
}

async function runRawTransaction(db: SQLiteDatabase, callback: ArkTransactionTask) {
  // SAFETY: the exclusive-transaction extension only exists on some
  // expo-sqlite builds; absence falls back to the plain transaction below.
  const exclusiveTransaction = (db as SQLiteDatabaseWithExclusive).withExclusiveTransactionAsync;
  if (exclusiveTransaction) {
    try {
      await exclusiveTransaction.call(db, callback);
      return;
    } catch (error) {
      if (!isExclusiveTransactionUnsupported(error)) throw error;
    }
  }

  await db.withTransactionAsync(() => callback(db));
}

function hasSyncQueryApi(db: SQLiteDatabase): db is SQLiteSyncDatabase {
  // SAFETY: the sync API surface only exists on expo-sqlite builds that ship
  // it; each probe checks a member the sync wrapper will actually call.
  const syncDb = db as SQLiteSyncDatabase;
  return Boolean(
    syncDb.execSync !== undefined &&
    syncDb.runSync !== undefined &&
    syncDb.getFirstSync !== undefined &&
    syncDb.getAllSync !== undefined
  );
}

async function runRawSyncTransaction(db: SQLiteSyncDatabase, callback: ArkTransactionTask) {
  const tx = wrapDatabaseWithoutMutex(db);
  db.execSync?.('BEGIN');
  try {
    await callback(tx);
    db.execSync?.('COMMIT');
  } catch (error) {
    db.execSync?.('ROLLBACK');
    throw error;
  }
}

function wrapSyncDatabase(
  db: SQLiteSyncDatabase,
  options?: { useMutex?: boolean }
): ArkSQLiteDatabase {
  const useMutex = options?.useMutex ?? true;
  const run = <T>(fn: () => T | Promise<T>) =>
    useMutex ? dbMutex.run(async () => fn()) : Promise.resolve(fn());

  // SAFETY: the wrapper implements the full ArkSQLiteDatabase surface; the
  // spread carries the remaining members from the underlying handle.
  return {
    ...db,
    closeAsync: () => run(() => closeRawDatabase(db)),
    execAsync: (source: string) => run(() => db.execSync?.(source)),
    runAsync: (...args: Parameters<SQLiteDatabase['runAsync']>) =>
      run(() => {
        // SAFETY: the optional-call result matches the async signature this
        // wrapper implements; undefined only occurs on a missing sync API.
        return db.runSync?.(...args) as Awaited<ReturnType<SQLiteDatabase['runAsync']>>;
      }),
    getFirstAsync: <T>(...args: Parameters<SQLiteDatabase['getFirstAsync']>) =>
      run(() => db.getFirstSync?.<T>(...args) ?? null),
    getAllAsync: <T>(...args: Parameters<SQLiteDatabase['getAllAsync']>) =>
      run(() => db.getAllSync?.<T>(...args) ?? []),
    withTransactionAsync: (callback: ArkTransactionTask) =>
      run(() => runRawSyncTransaction(db, callback)),
  } as ArkSQLiteDatabase;
}

function wrapAsyncDatabase(db: SQLiteDatabase): ArkSQLiteDatabase {
  // SAFETY: a plain async handle already satisfies ArkSQLiteDatabase; the
  // wrapper only adds the mutex.
  return {
    ...db,
    closeAsync: () => dbMutex.run(() => closeRawDatabase(db)),
    execAsync: (...args: Parameters<SQLiteDatabase['execAsync']>) =>
      dbMutex.run(() => db.execAsync(...args)),
    runAsync: (...args: Parameters<SQLiteDatabase['runAsync']>) =>
      dbMutex.run(() => db.runAsync(...args)),
    getFirstAsync: <T>(...args: Parameters<SQLiteDatabase['getFirstAsync']>) =>
      dbMutex.run(() => db.getFirstAsync<T>(...args)),
    getAllAsync: <T>(...args: Parameters<SQLiteDatabase['getAllAsync']>) =>
      dbMutex.run(() => db.getAllAsync<T>(...args)),
    withTransactionAsync: (callback: ArkTransactionTask) =>
      dbMutex.run(() => runRawTransaction(db, callback)),
  } as ArkSQLiteDatabase;
}

function wrapDatabaseWithoutMutex(db: SQLiteDatabase): ArkSQLiteDatabase {
  if (hasSyncQueryApi(db)) {
    return wrapSyncDatabase(db, { useMutex: false });
  }
  // SAFETY: hasSyncQueryApi proved the handle already exposes the sync API,
  // which is the only difference between SQLiteDatabase and the Ark alias.
  return db as ArkSQLiteDatabase;
}

function wrapDatabase(db: SQLiteDatabase): ArkSQLiteDatabase {
  if (!SHOULD_USE_SYNCHRONOUS_SQLITE) return wrapAsyncDatabase(db);
  return hasSyncQueryApi(db) ? wrapSyncDatabase(db) : wrapAsyncDatabase(db);
}

export function wrapDatabaseForTests(db: SQLiteDatabase): ArkSQLiteDatabase {
  return wrapDatabase(db);
}

let dbPromise: Promise<ArkSQLiteDatabase> | null = null;

function currentEncryptionState() {
  return DATABASE_ENCRYPTION_STATE;
}

async function closeRawDatabase(db: SQLiteDatabase) {
  // SAFETY: the sync handle only exists on expo-sqlite builds that ship the
  // synchronous API; both closes target the same underlying database.
  const syncDb = db as SQLiteSyncDatabase;
  if (syncDb.closeSync) {
    syncDb.closeSync();
    return;
  }
  await db.closeAsync();
}

export class DatabaseClient {
  static async getDb() {
    if (!dbPromise) {
      dbPromise = Promise.resolve().then(async () => {
        // SAFETY: openDatabaseSync ships with the synchronous expo-sqlite
        // build; its absence selects the async open path below.
        const rawOpenDatabaseSync = SHOULD_USE_SYNCHRONOUS_SQLITE
          ? (
              SQLite as typeof SQLite & {
                openDatabaseSync?: (databaseName: string) => SQLiteDatabase;
              }
            ).openDatabaseSync
          : undefined;
        const db = rawOpenDatabaseSync
          ? rawOpenDatabaseSync(DB_NAME)
          : await SQLite.openDatabaseAsync(DB_NAME);
        const wrappedDb = wrapDatabase(db);
        try {
          await DatabaseEncryptionService.applyKey(wrappedDb);
        } catch (error) {
          await closeRawDatabase(db).catch(() => undefined);
          throw error;
        }
        await migrateDbIfNeeded(wrappedDb);
        return wrappedDb;
      });
      dbPromise = dbPromise.catch((error) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  }

  static async migratePlaintextDatabaseToEncrypted(options?: { fileSystem?: DatabaseFileSystem }) {
    const db = await this.getDb();
    if (currentEncryptionState() !== 'plaintext') {
      throw new Error('This install is not using the plaintext SQLCipher fallback.');
    }
    // SAFETY: expo-sqlite exposes databasePath on the wrapped handle even
    // though the Ark alias omits it.
    const databasePath = (db as ArkSQLiteDatabase & { databasePath?: string }).databasePath;
    if (!databasePath) {
      throw new Error('Unable to locate the active database file.');
    }

    const encryptedCopyPath = DatabaseEncryptionService.encryptedCopyPathFor(databasePath);
    const migration = await DatabaseEncryptionService.exportPlaintextToEncryptedCopy(
      db,
      encryptedCopyPath
    );
    await db.closeAsync();
    dbPromise = null;
    await DatabaseEncryptionService.replacePlaintextDatabaseWithEncryptedCopy({
      ...migration,
      fileSystem: options?.fileSystem,
    });
    await DatabaseEncryptionService.setEncryptionEnabled(true);
    await this.getDb();

    return {
      ...migration,
      reopenedEncrypted: currentEncryptionState() === 'encrypted',
    };
  }

  static async migrateEncryptedDatabaseToPlaintext(options?: { fileSystem?: DatabaseFileSystem }) {
    const db = await this.getDb();
    if (currentEncryptionState() !== 'encrypted') {
      throw new Error('This install is not using an encrypted SQLCipher database.');
    }
    // SAFETY: expo-sqlite exposes databasePath on the wrapped handle even
    // though the Ark alias omits it.
    const databasePath = (db as ArkSQLiteDatabase & { databasePath?: string }).databasePath;
    if (!databasePath) {
      throw new Error('Unable to locate the active database file.');
    }

    const plaintextCopyPath = DatabaseEncryptionService.plaintextCopyPathFor(databasePath);
    const migration = await DatabaseEncryptionService.exportEncryptedToPlaintextCopy(
      db,
      plaintextCopyPath
    );
    await db.closeAsync();
    dbPromise = null;
    await DatabaseEncryptionService.replaceEncryptedDatabaseWithPlaintextCopy({
      databasePath: migration.databasePath,
      plaintextCopyPath: migration.encryptedCopyPath,
      backupPath: migration.backupPath,
      fileSystem: options?.fileSystem,
    });
    await DatabaseEncryptionService.setEncryptionEnabled(false);
    await this.getDb();

    return {
      ...migration,
      plaintextCopyPath,
      reopenedPlaintext: currentEncryptionState() === 'plaintext',
    };
  }

  static setTestDbForTests(db: ArkSQLiteDatabase | null) {
    dbPromise = db ? Promise.resolve(db) : null;
  }
}
