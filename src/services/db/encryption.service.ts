import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  DATABASE_ENCRYPTION_STATE,
  type DatabaseEncryptionState,
  setDatabaseEncryptionState,
} from '@/services/db/schema';

const DATABASE_ROOT_KEY_KEY = 'ark.security.rootKey.v1';
const DATABASE_ENCRYPTION_PREFERENCE_KEY = 'ark.db.encryptionPreference.v1';
const KEY_STRATEGY_PURPOSED = 'SecureStore device root key with SQLCipher purpose derivation';
const KEY_STRATEGY_DISABLED = 'Encryption disabled by user preference';
const MIGRATION_STATUS = 'Database encryption is available as an opt-in SQLCipher export.';
const DISABLED_MIGRATION_STATUS =
  'Database encryption is off. Enable it in Security when battery budget allows.';
const EXISTING_DATA_STATUS =
  'Ark uses a fresh pre-release database baseline. Clear app data before testing new builds.';
const PASSPHRASE_REKEY_STATUS =
  'SQLCipher is optional. When enabled, it uses a purpose-derived device root key and rotates that root during vault passphrase changes.';
const RAW_KEY_HEX_LENGTH = 64;
const ENCRYPTED_EXPORT_SCHEMA = 'ark_encrypted';
const PLAINTEXT_EXPORT_SCHEMA = 'ark_plaintext';
const SQLCIPHER_PURPOSE = 'sqlcipher';

type DatabaseFileInfo = { exists: boolean };

export type DatabaseFileSystem = {
  getInfoAsync(uri: string): Promise<DatabaseFileInfo>;
  moveAsync(options: { from: string; to: string }): Promise<void>;
  deleteAsync(uri: string, options?: { idempotent?: boolean }): Promise<void>;
};

export type DatabaseEncryptionApplyResult = {
  runtimeActive: boolean;
  databaseState: DatabaseEncryptionState;
  keyApplied: boolean;
};

export type PlaintextDatabaseMigrationResult = {
  databasePath: string;
  encryptedCopyPath: string;
  backupPath: string;
  userVersion: number;
};

export class DatabaseKeyReadError extends Error {
  constructor(readonly cause?: unknown) {
    super('Unable to read the database after applying the SQLCipher key.');
    this.name = 'DatabaseKeyReadError';
  }
}

export class PlaintextDatabaseMigrationError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PlaintextDatabaseMigrationError';
  }
}

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "''");
}

function buildKeyPragma(key: string): string {
  return `PRAGMA key = "x'${escapeSingleQuotes(key)}'"`;
}

function buildRekeyPragma(key: string): string {
  return `PRAGMA rekey = "x'${escapeSingleQuotes(key)}'"`;
}

function toFileUri(path: string) {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

function sidecarPaths(databasePath: string) {
  return [`${databasePath}-wal`, `${databasePath}-shm`, `${databasePath}-journal`];
}

export class DatabaseEncryptionService {
  static async applyKey(db: SQLiteDatabase): Promise<DatabaseEncryptionApplyResult> {
    if (!(await this.isEncryptionEnabled())) {
      setDatabaseEncryptionState(false, 'plaintext');
      return { runtimeActive: false, databaseState: 'plaintext', keyApplied: false };
    }
    const runtimeActive = await this.detectSqlCipher(db);
    const key = await this.getOrCreateDatabaseKey();
    await db.execAsync(buildKeyPragma(key));
    if (!runtimeActive) {
      setDatabaseEncryptionState(false, 'unenforced');
      return { runtimeActive: false, databaseState: 'unenforced', keyApplied: true };
    }
    try {
      await this.assertReadable(db);
    } catch (error) {
      setDatabaseEncryptionState(true, 'unknown');
      throw new DatabaseKeyReadError(error);
    }
    setDatabaseEncryptionState(true, 'encrypted');
    return { runtimeActive: true, databaseState: 'encrypted', keyApplied: true };
  }

  static async isEncryptionEnabled() {
    const preference = await SecureStore.getItemAsync(DATABASE_ENCRYPTION_PREFERENCE_KEY);
    if (preference === 'enabled') return true;
    if (preference === 'disabled') return false;
    return false;
  }

  static async setEncryptionEnabled(enabled: boolean) {
    await SecureStore.setItemAsync(
      DATABASE_ENCRYPTION_PREFERENCE_KEY,
      enabled ? 'enabled' : 'disabled',
      {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }
    );
  }

  static async exportPlaintextToEncryptedCopy(
    db: SQLiteDatabase,
    encryptedDatabasePath: string
  ): Promise<PlaintextDatabaseMigrationResult> {
    if (!this.isUsableDatabasePath(encryptedDatabasePath)) {
      throw new PlaintextDatabaseMigrationError('Unable to create an encrypted database copy.');
    }
    const runtimeActive = await this.detectSqlCipher(db);
    if (!runtimeActive) {
      throw new PlaintextDatabaseMigrationError(
        'SQLCipher is not active in this build, so Ark cannot encrypt the existing database.'
      );
    }

    const key = await this.getOrCreateDatabaseKey();
    const userVersion = await this.getUserVersion(db);
    const sourcePath = this.databasePath(db);
    let attached = false;

    try {
      await db.execAsync('PRAGMA wal_checkpoint(FULL)');
      await db.execAsync(
        `ATTACH DATABASE '${escapeSingleQuotes(encryptedDatabasePath)}' AS ${ENCRYPTED_EXPORT_SCHEMA} KEY "x'${key}'"`
      );
      attached = true;
      await db.execAsync(`
        PRAGMA ${ENCRYPTED_EXPORT_SCHEMA}.journal_mode = DELETE;
        SELECT sqlcipher_export('${ENCRYPTED_EXPORT_SCHEMA}');
        PRAGMA ${ENCRYPTED_EXPORT_SCHEMA}.user_version = ${userVersion};
      `);
      await this.assertAttachedDatabaseHealthy(db);
    } catch (error) {
      throw new PlaintextDatabaseMigrationError(
        'Unable to export the existing database into an encrypted SQLCipher copy.',
        error
      );
    } finally {
      if (attached) {
        await db.execAsync(`DETACH DATABASE ${ENCRYPTED_EXPORT_SCHEMA}`).catch(() => undefined);
      }
    }

    return {
      databasePath: sourcePath,
      encryptedCopyPath: encryptedDatabasePath,
      backupPath: this.backupPathFor(sourcePath),
      userVersion,
    };
  }

  static async replacePlaintextDatabaseWithEncryptedCopy(input: {
    databasePath: string;
    encryptedCopyPath: string;
    backupPath: string;
    fileSystem?: DatabaseFileSystem;
  }) {
    const fileSystem = input.fileSystem ?? (await this.loadFileSystem());
    const movedBackups: Array<{ original: string; backup: string }> = [];

    async function exists(path: string) {
      return (await fileSystem.getInfoAsync(toFileUri(path)).catch(() => ({ exists: false })))
        .exists;
    }

    async function moveIfExists(original: string, backup: string) {
      if (!(await exists(original))) return;
      await fileSystem.moveAsync({ from: toFileUri(original), to: toFileUri(backup) });
      movedBackups.push({ original, backup });
    }

    async function deleteIfExists(path: string) {
      await fileSystem.deleteAsync(toFileUri(path), { idempotent: true }).catch(() => undefined);
    }

    try {
      for (const sidecar of sidecarPaths(input.databasePath)) {
        await moveIfExists(sidecar, sidecar.replace(input.databasePath, input.backupPath));
      }
      await moveIfExists(input.databasePath, input.backupPath);
      await fileSystem.moveAsync({
        from: toFileUri(input.encryptedCopyPath),
        to: toFileUri(input.databasePath),
      });
      for (const sidecar of sidecarPaths(input.encryptedCopyPath)) {
        await deleteIfExists(sidecar);
      }
    } catch (error) {
      await deleteIfExists(input.databasePath);
      for (const moved of [...movedBackups].reverse()) {
        if (await exists(moved.backup)) {
          await fileSystem
            .moveAsync({ from: toFileUri(moved.backup), to: toFileUri(moved.original) })
            .catch(() => undefined);
        }
      }
      throw new PlaintextDatabaseMigrationError(
        'Unable to replace the plaintext database with the encrypted copy. The plaintext backup was restored when possible.',
        error
      );
    }
  }

  static async exportEncryptedToPlaintextCopy(
    db: SQLiteDatabase,
    plaintextDatabasePath: string
  ): Promise<PlaintextDatabaseMigrationResult> {
    if (!this.isUsableDatabasePath(plaintextDatabasePath)) {
      throw new PlaintextDatabaseMigrationError('Unable to create a plaintext database copy.');
    }
    const runtimeActive = await this.detectSqlCipher(db);
    if (!runtimeActive) {
      throw new PlaintextDatabaseMigrationError(
        'SQLCipher is not active in this build, so Ark cannot export the encrypted database.'
      );
    }

    const userVersion = await this.getUserVersion(db);
    const sourcePath = this.databasePath(db);
    let attached = false;

    try {
      await db.execAsync('PRAGMA wal_checkpoint(FULL)');
      await db.execAsync(
        `ATTACH DATABASE '${escapeSingleQuotes(plaintextDatabasePath)}' AS ${PLAINTEXT_EXPORT_SCHEMA} KEY ''`
      );
      attached = true;
      await db.execAsync(`
        PRAGMA ${PLAINTEXT_EXPORT_SCHEMA}.journal_mode = DELETE;
        SELECT sqlcipher_export('${PLAINTEXT_EXPORT_SCHEMA}');
        PRAGMA ${PLAINTEXT_EXPORT_SCHEMA}.user_version = ${userVersion};
      `);
      await this.assertAttachedDatabaseHealthy(db, PLAINTEXT_EXPORT_SCHEMA);
    } catch (error) {
      throw new PlaintextDatabaseMigrationError(
        'Unable to export the encrypted database into a plaintext copy.',
        error
      );
    } finally {
      if (attached) {
        await db.execAsync(`DETACH DATABASE ${PLAINTEXT_EXPORT_SCHEMA}`).catch(() => undefined);
      }
    }

    return {
      databasePath: sourcePath,
      encryptedCopyPath: plaintextDatabasePath,
      backupPath: this.encryptedBackupPathFor(sourcePath),
      userVersion,
    };
  }

  static async replaceEncryptedDatabaseWithPlaintextCopy(input: {
    databasePath: string;
    plaintextCopyPath: string;
    backupPath: string;
    fileSystem?: DatabaseFileSystem;
  }) {
    const fileSystem = input.fileSystem ?? (await this.loadFileSystem());
    const movedBackups: Array<{ original: string; backup: string }> = [];

    async function exists(path: string) {
      return (await fileSystem.getInfoAsync(toFileUri(path)).catch(() => ({ exists: false })))
        .exists;
    }

    async function moveIfExists(original: string, backup: string) {
      if (!(await exists(original))) return;
      await fileSystem.moveAsync({ from: toFileUri(original), to: toFileUri(backup) });
      movedBackups.push({ original, backup });
    }

    async function deleteIfExists(path: string) {
      await fileSystem.deleteAsync(toFileUri(path), { idempotent: true }).catch(() => undefined);
    }

    try {
      for (const sidecar of sidecarPaths(input.databasePath)) {
        await moveIfExists(sidecar, sidecar.replace(input.databasePath, input.backupPath));
      }
      await moveIfExists(input.databasePath, input.backupPath);
      await fileSystem.moveAsync({
        from: toFileUri(input.plaintextCopyPath),
        to: toFileUri(input.databasePath),
      });
      for (const sidecar of sidecarPaths(input.plaintextCopyPath)) {
        await deleteIfExists(sidecar);
      }
    } catch (error) {
      await deleteIfExists(input.databasePath);
      for (const moved of [...movedBackups].reverse()) {
        if (await exists(moved.backup)) {
          await fileSystem
            .moveAsync({ from: toFileUri(moved.backup), to: toFileUri(moved.original) })
            .catch(() => undefined);
        }
      }
      throw new PlaintextDatabaseMigrationError(
        'Unable to replace the encrypted database with the plaintext copy. The encrypted backup was restored when possible.',
        error
      );
    }
  }

  static async rotateDatabaseKey(db: SQLiteDatabase): Promise<{
    rotated: boolean;
    reason?: string;
  }> {
    if (DATABASE_ENCRYPTION_STATE !== 'encrypted') {
      return {
        rotated: false,
        reason: 'Database is not currently opened as an encrypted SQLCipher database.',
      };
    }
    const runtimeActive = await this.detectSqlCipher(db);
    if (!runtimeActive) {
      return {
        rotated: false,
        reason: 'SQLCipher runtime is not active in this build.',
      };
    }
    const previousKey = await this.getExistingDatabaseKey();
    const nextRootKey = await this.generateRawKey();
    const nextKey = await this.derivePurposeKey(nextRootKey, SQLCIPHER_PURPOSE);

    try {
      await db.execAsync(buildRekeyPragma(nextKey));
      await this.assertReadable(db);
      try {
        await this.saveRootKey(nextRootKey);
      } catch (error) {
        await db.execAsync(buildRekeyPragma(previousKey)).catch(() => undefined);
        await this.assertReadable(db).catch(() => undefined);
        throw error;
      }
      return { rotated: true };
    } catch (error) {
      throw new DatabaseKeyReadError(error);
    }
  }

  static isKeyReadError(error: unknown): error is DatabaseKeyReadError {
    return error instanceof DatabaseKeyReadError;
  }

  static async getRuntimeStatus(
    runtimeActive: boolean,
    databaseState: DatabaseEncryptionState = DATABASE_ENCRYPTION_STATE
  ) {
    const keyState = await this.getStoredKeyState();
    const enabled = await this.isEncryptionEnabled();
    const stateCopy = this.copyForState(runtimeActive, databaseState);
    return {
      active: databaseState === 'encrypted',
      runtimeActive,
      databaseState,
      stateLabel: stateCopy.label,
      encryptionEnabled: enabled,
      keyStored: keyState.stored,
      keyStrategy: enabled ? keyState.strategy : KEY_STRATEGY_DISABLED,
      migrationStatus: stateCopy.migrationStatus,
      existingDataStatus: EXISTING_DATA_STATUS,
      passphraseRekeyStatus: PASSPHRASE_REKEY_STATUS,
      plaintextMigrationImplemented: true,
      vaultPassphraseRekeyImplemented: true,
      note: stateCopy.note,
    };
  }

  static encryptedCopyPathFor(databasePath: string, now = Date.now()) {
    return `${databasePath}.encrypted-${now}`;
  }

  static plaintextCopyPathFor(databasePath: string, now = Date.now()) {
    return `${databasePath}.plaintext-${now}`;
  }

  static backupPathFor(databasePath: string, now = Date.now()) {
    return `${databasePath}.plaintext-backup-${now}`;
  }

  static encryptedBackupPathFor(databasePath: string, now = Date.now()) {
    return `${databasePath}.encrypted-backup-${now}`;
  }

  private static async getOrCreateDatabaseKey() {
    const rootKey = await SecureStore.getItemAsync(DATABASE_ROOT_KEY_KEY);
    if (rootKey && this.isValidRawKey(rootKey)) {
      return this.derivePurposeKey(rootKey, SQLCIPHER_PURPOSE);
    }

    const nextRootKey = await this.generateRawKey();
    await this.saveRootKey(nextRootKey);
    return this.derivePurposeKey(nextRootKey, SQLCIPHER_PURPOSE);
  }

  private static async getExistingDatabaseKey() {
    const rootKey = await SecureStore.getItemAsync(DATABASE_ROOT_KEY_KEY);
    if (rootKey && this.isValidRawKey(rootKey)) {
      return this.derivePurposeKey(rootKey, SQLCIPHER_PURPOSE);
    }

    throw new DatabaseKeyReadError(new Error('Stored SQLCipher key is missing or invalid.'));
  }

  private static async saveRootKey(key: string) {
    if (!this.isValidRawKey(key)) {
      throw new DatabaseKeyReadError(new Error('Refusing to store invalid root key material.'));
    }
    await SecureStore.setItemAsync(DATABASE_ROOT_KEY_KEY, key.toLowerCase(), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  private static async generateRawKey() {
    const bytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private static async derivePurposeKey(rootKey: string, purpose: string) {
    if (!this.isValidRawKey(rootKey)) {
      throw new DatabaseKeyReadError(new Error('Stored root key is missing or invalid.'));
    }
    const material = new TextEncoder().encode(`ark:${purpose}:v1:${rootKey.toLowerCase()}`);
    const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, material);
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
      ''
    );
  }

  private static isValidRawKey(value: string) {
    return new RegExp(`^[a-fA-F0-9]{${RAW_KEY_HEX_LENGTH}}$`).test(value);
  }

  private static async getStoredKeyState() {
    const rootKey = await SecureStore.getItemAsync(DATABASE_ROOT_KEY_KEY);
    if (rootKey && this.isValidRawKey(rootKey)) {
      return { stored: true, strategy: KEY_STRATEGY_PURPOSED };
    }
    return { stored: false, strategy: KEY_STRATEGY_PURPOSED };
  }

  private static async detectSqlCipher(db: SQLiteDatabase) {
    try {
      const row = await db.getFirstAsync<{ cipher_version?: string }>('PRAGMA cipher_version');
      return !!row?.cipher_version;
    } catch {
      return false;
    }
  }

  private static async assertReadable(db: SQLiteDatabase) {
    await db.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM sqlite_master');
  }

  private static async assertAttachedDatabaseHealthy(
    db: SQLiteDatabase,
    schema = ENCRYPTED_EXPORT_SCHEMA
  ) {
    const row = await db.getFirstAsync<Record<string, string>>(`PRAGMA ${schema}.quick_check`);
    const result = row ? Object.values(row)[0] : null;
    if (result !== 'ok') {
      throw new Error('Encrypted database quick_check failed.');
    }
  }

  private static async getUserVersion(db: SQLiteDatabase) {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const version = row?.user_version;
    if (typeof version === 'number' && Number.isInteger(version) && version >= 0) return version;
    return 0;
  }

  private static async loadFileSystem(): Promise<DatabaseFileSystem> {
    const fileSystemModule = await import('expo-file-system/legacy');
    const candidates = [
      fileSystemModule,
      (fileSystemModule as typeof fileSystemModule & { default?: unknown }).default,
      (
        (fileSystemModule as typeof fileSystemModule & { default?: { default?: unknown } })
          .default ?? {}
      ).default,
    ];
    const fileSystem = candidates.find(this.isDatabaseFileSystem);
    if (!fileSystem) {
      throw new PlaintextDatabaseMigrationError('File-system database replacement is unavailable.');
    }
    return fileSystem;
  }

  private static isDatabaseFileSystem(candidate: unknown): candidate is DatabaseFileSystem {
    return (
      typeof candidate === 'object' &&
      candidate !== null &&
      typeof (candidate as DatabaseFileSystem).getInfoAsync === 'function' &&
      typeof (candidate as DatabaseFileSystem).moveAsync === 'function' &&
      typeof (candidate as DatabaseFileSystem).deleteAsync === 'function'
    );
  }

  private static databasePath(db: SQLiteDatabase) {
    const path = (db as SQLiteDatabase & { databasePath?: string }).databasePath;
    if (!path || !this.isUsableDatabasePath(path)) {
      throw new PlaintextDatabaseMigrationError(
        'Unable to locate the active database file for migration.'
      );
    }
    return path;
  }

  private static isUsableDatabasePath(path: string) {
    return path.length > 0 && path !== ':memory:' && !path.includes('\0');
  }

  private static copyForState(runtimeActive: boolean, databaseState: DatabaseEncryptionState) {
    if (databaseState === 'encrypted') {
      return {
        label: 'Encrypted database',
        migrationStatus: MIGRATION_STATUS,
        note: 'SQLCipher accepted the stored key and the database opened successfully.',
      };
    }
    if (databaseState === 'plaintext') {
      return {
        label: 'Plaintext database',
        migrationStatus: DISABLED_MIGRATION_STATUS,
        note: 'Database encryption is disabled, so Ark opens this database without SQLCipher work. Enable encryption from Security when protection matters more than battery and immediate access.',
      };
    }
    if (!runtimeActive || databaseState === 'unenforced') {
      return {
        label: 'Not enforced in this build',
        migrationStatus:
          'Database encryption requires a SQLCipher runtime; this build cannot enforce it.',
        note: 'SQLCipher is not active in this runtime, so the database is readable but not encrypted by SQLCipher.',
      };
    }
    return {
      label: 'Needs inspection',
      migrationStatus: MIGRATION_STATUS,
      note: 'SQLCipher is available, but Ark could not prove whether this database is encrypted or plaintext.',
    };
  }
}
