import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import { setSqlCipherActive } from '@/services/db/schema';

const DATABASE_KEY_KEY = 'ark.db.sqlcipherKey';
const KEY_STRATEGY = 'SecureStore device key';
const MIGRATION_STATUS = 'Plaintext DB migration and vault-passphrase rekey are not implemented.';
const RAW_KEY_HEX_LENGTH = 64;

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "''");
}

function buildKeyPragma(key: string): string {
  return `PRAGMA key = "x'${escapeSingleQuotes(key)}'"`;
}

export class DatabaseEncryptionService {
  static async applyKey(db: SQLiteDatabase) {
    const key = await this.getOrCreateDatabaseKey();
    await db.execAsync(buildKeyPragma(key));
    const active = await this.detectSqlCipher(db);
    setSqlCipherActive(active);
    return active;
  }

  static async getRuntimeStatus(active: boolean) {
    const keyStored = !!(await SecureStore.getItemAsync(DATABASE_KEY_KEY));
    return {
      active,
      keyStored,
      keyStrategy: KEY_STRATEGY,
      migrationStatus: MIGRATION_STATUS,
      note:
        'A development build with SQLCipher should report active after the database opens. Existing plaintext databases still need an explicit migration plan.',
    };
  }

  private static async getOrCreateDatabaseKey() {
    const existing = await SecureStore.getItemAsync(DATABASE_KEY_KEY);
    if (existing && this.isValidRawKey(existing)) return existing.toLowerCase();
    const key = await this.generateRawKey();
    await SecureStore.setItemAsync(DATABASE_KEY_KEY, key, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    return key;
  }

  private static async generateRawKey() {
    const bytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private static isValidRawKey(value: string) {
    return new RegExp(`^[a-fA-F0-9]{${RAW_KEY_HEX_LENGTH}}$`).test(value);
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
