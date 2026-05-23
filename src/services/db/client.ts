import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DB_NAME } from '@/services/db/schema';
import { migrateDbIfNeeded } from '@/services/db/migrations';
import { DatabaseEncryptionService } from '@/services/db/encryption.service';

class SQLiteMutex {
  private queue: Promise<any> = Promise.resolve();

  async run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn);
    this.queue = next.catch(() => {});
    return next;
  }
}

const dbMutex = new SQLiteMutex();

function wrapDatabase(db: SQLiteDatabase): SQLiteDatabase {
  return {
    ...db,
    execAsync: (...args: Parameters<SQLiteDatabase['execAsync']>) =>
      dbMutex.run(() => db.execAsync(...args)),
    runAsync: (...args: Parameters<SQLiteDatabase['runAsync']>) =>
      dbMutex.run(() => db.runAsync(...args)),
    getFirstAsync: <T>(...args: Parameters<SQLiteDatabase['getFirstAsync']>) =>
      dbMutex.run(() => db.getFirstAsync<T>(...args)),
    getAllAsync: <T>(...args: Parameters<SQLiteDatabase['getAllAsync']>) =>
      dbMutex.run(() => db.getAllAsync<T>(...args)),
    withTransactionAsync: (callback: () => Promise<void>) => db.withTransactionAsync(callback),
  } as SQLiteDatabase;
}

let dbPromise: Promise<SQLiteDatabase> | null = null;

export class DatabaseClient {
  static async getDb() {
    if (!dbPromise) {
      dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
        const wrappedDb = wrapDatabase(db);
        await DatabaseEncryptionService.applyKey(wrappedDb);
        await migrateDbIfNeeded(wrappedDb);
        return wrappedDb;
      });
    }
    return dbPromise;
  }

  static setTestDbForTests(db: SQLiteDatabase | null) {
    dbPromise = db ? Promise.resolve(db) : null;
  }
}
