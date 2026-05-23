import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PASSWORD_VERIFIER_KEY = 'ark.vault.passwordVerifier';
const BIOMETRIC_TOKEN_KEY = 'ark.vault.biometricToken';
const VERIFIER_V2_PREFIX = 'ark-v2:sha512:5000:';
const CURRENT_VERIFIER = {
  prefix: 'ark-v3:sha512:12000:',
  iterations: 12000,
};

export class KeychainService {
  static async generateSalt() {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  static async derivePasswordVerifier(password: string, salt: string) {
    return this.deriveSha512Verifier(
      password,
      salt,
      CURRENT_VERIFIER.iterations,
      CURRENT_VERIFIER.prefix
    );
  }

  private static async deriveSha512Verifier(
    password: string,
    salt: string,
    iterations: number,
    prefix: string
  ) {
    let digest = `${salt}:${password}`;
    for (let i = 0; i < iterations; i += 1) {
      digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA512,
        `${salt}:${i}:${digest}`
      );
    }
    return `${prefix}${digest}`;
  }

  static async verifyPassword(password: string, salt: string, expectedVerifier: string) {
    const actual = expectedVerifier.startsWith(CURRENT_VERIFIER.prefix)
      ? await this.derivePasswordVerifier(password, salt)
      : expectedVerifier.startsWith(VERIFIER_V2_PREFIX)
        ? await this.deriveSha512Verifier(password, salt, 5000, VERIFIER_V2_PREFIX)
        : await this.deriveLegacyPasswordVerifier(password, salt);
    return actual === expectedVerifier;
  }

  static needsVerifierUpgrade(verifier: string) {
    return !verifier.startsWith(CURRENT_VERIFIER.prefix);
  }

  private static async deriveLegacyPasswordVerifier(password: string, salt: string) {
    let digest = `${salt}:${password}`;
    for (let i = 0; i < 750; i += 1) {
      digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${salt}:${digest}`
      );
    }
    return digest;
  }

  static async savePasswordVerifier(verifier: string) {
    await SecureStore.setItemAsync(PASSWORD_VERIFIER_KEY, verifier);
  }

  static async getPasswordVerifier() {
    return SecureStore.getItemAsync(PASSWORD_VERIFIER_KEY);
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
