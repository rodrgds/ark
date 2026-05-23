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
  return new Proxy(db, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        if (
          prop === 'runAsync' ||
          prop === 'getFirstAsync' ||
          prop === 'getAllAsync' ||
          prop === 'execAsync'
        ) {
          return function(this: any, ...args: any[]) {
            return dbMutex.run(() => value.apply(target, args));
          };
        }
        return value.bind(target);
      }
      return value;
    },
  }) as SQLiteDatabase;
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
