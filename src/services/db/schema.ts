export const DB_NAME = 'ark.db';
export const DB_VERSION = 1;

export type DatabaseEncryptionState = 'unknown' | 'encrypted' | 'plaintext' | 'unenforced';

export let SQLCIPHER_ACTIVE = false;
export let DATABASE_ENCRYPTION_STATE: DatabaseEncryptionState = 'unknown';
export const SQLCIPHER_NOTE =
  'Ark can apply a SecureStore-backed SQLCipher key when database encryption is enabled. Fresh installs default to plaintext; Diagnostics reports whether the native runtime exposes cipher_version and what state the DB opened in.';

export function setSqlCipherActive(active: boolean) {
  SQLCIPHER_ACTIVE = active;
}

export function setDatabaseEncryptionState(
  active: boolean,
  state: DatabaseEncryptionState = active ? 'encrypted' : 'unenforced'
) {
  SQLCIPHER_ACTIVE = active;
  DATABASE_ENCRYPTION_STATE = state;
}
