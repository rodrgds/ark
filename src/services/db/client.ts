import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { DB_NAME } from '@/services/db/schema';
import { migrateDbIfNeeded } from '@/services/db/migrations';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export class DatabaseClient {
  static async getDb() {
    if (!dbPromise) {
      dbPromise = SQLite.openDatabaseAsync(DB_NAME).then(async (db) => {
        await migrateDbIfNeeded(db);
        return db;
      });
    }
    return dbPromise;
  }
}
