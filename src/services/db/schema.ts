export const DB_NAME = 'ark.db';
export const DB_VERSION = 17;

export let SQLCIPHER_ACTIVE = false;
export const SQLCIPHER_NOTE =
  'Ark applies a SecureStore-backed SQLCipher key before migrations. Expo Go may ignore SQLCipher pragmas; Diagnostics reports whether the native runtime exposes cipher_version.';

export function setSqlCipherActive(active: boolean) {
  SQLCIPHER_ACTIVE = active;
}
