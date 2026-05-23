import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { setSqlCipherActive } from '@/services/db/schema';

const DATABASE_KEY_KEY = 'ark.db.sqlcipherKey';

export class DatabaseEncryptionService {
  static async applyKey(db: SQLiteDatabase) {
    const key = await this.getOrCreateDatabaseKey();
    await db.execAsync(`PRAGMA key = '${key}'`);
    const active = await this.detectSqlCipher(db);
    setSqlCipherActive(active);
    return active;
  }

  private static async getOrCreateDatabaseKey() {
    const existing = await SecureStore.getItemAsync(DATABASE_KEY_KEY);
    if (existing) return existing;
    const bytes = await Crypto.getRandomBytesAsync(32);
    const key = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(DATABASE_KEY_KEY, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return key;
  }

  private static async detectSqlCipher(db: SQLiteDatabase) {
    try {
      const row = await db.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version');
      return !!row?.cipher_version;
    } catch {
      return false;
    }
  }
}
