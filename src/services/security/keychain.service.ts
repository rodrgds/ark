import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { argon2idAsync } from '@noble/hashes/argon2.js';

const PASSWORD_VERIFIER_KEY = 'ark.vault.passwordVerifier';
const BIOMETRIC_TOKEN_KEY = 'ark.vault.biometricToken';
const ARGON2ID_PARAMS = {
  t: 2,
  m: 19_456,
  p: 1,
  dkLen: 32,
  asyncTick: 10,
};
const CURRENT_VERIFIER = {
  prefix: `ark-v4:argon2id:${ARGON2ID_PARAMS.t}:${ARGON2ID_PARAMS.m}:${ARGON2ID_PARAMS.p}:${ARGON2ID_PARAMS.dkLen}:`,
};

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value: string) {
  if (!/^[a-fA-F0-9]+$/.test(value) || value.length % 2 !== 0) {
    return Uint8Array.from(value, (char) => char.charCodeAt(0) & 0xff);
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: string, right: string) {
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

export class KeychainService {
  static async generateSalt() {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  static async derivePasswordVerifier(password: string, salt: string) {
    const derived = await argon2idAsync(password, hexToBytes(salt), ARGON2ID_PARAMS);
    return `${CURRENT_VERIFIER.prefix}${bytesToHex(derived)}`;
  }

  static async verifyPassword(password: string, salt: string, expectedVerifier: string) {
    if (!expectedVerifier.startsWith(CURRENT_VERIFIER.prefix)) return false;
    const actual = await this.derivePasswordVerifier(password, salt);
    return constantTimeEqual(actual, expectedVerifier);
  }

  static async savePasswordVerifier(verifier: string) {
    await SecureStore.setItemAsync(PASSWORD_VERIFIER_KEY, verifier, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  static async getPasswordVerifier() {
    return SecureStore.getItemAsync(PASSWORD_VERIFIER_KEY);
  }

  static async deletePasswordVerifier() {
    await SecureStore.deleteItemAsync(PASSWORD_VERIFIER_KEY);
  }

  static async saveBiometricToken(token: string) {
    await SecureStore.setItemAsync(BIOMETRIC_TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  static async getBiometricToken() {
    return SecureStore.getItemAsync(BIOMETRIC_TOKEN_KEY);
  }

  static async deleteBiometricToken() {
    await SecureStore.deleteItemAsync(BIOMETRIC_TOKEN_KEY);
  }
}
