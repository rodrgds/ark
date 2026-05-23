import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const PASSWORD_VERIFIER_KEY = 'ark.vault.passwordVerifier';
const BIOMETRIC_TOKEN_KEY = 'ark.vault.biometricToken';
const CURRENT_VERIFIER_PREFIX = 'ark-v2:sha512:5000:';

export class KeychainService {
  static async generateSalt() {
    const bytes = await Crypto.getRandomBytesAsync(16);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  static async derivePasswordVerifier(password: string, salt: string) {
    let digest = `${salt}:${password}`;
    for (let i = 0; i < 5000; i += 1) {
      digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA512,
        `${salt}:${i}:${digest}`
      );
    }
    return `${CURRENT_VERIFIER_PREFIX}${digest}`;
  }

  static async verifyPassword(password: string, salt: string, expectedVerifier: string) {
    const actual = expectedVerifier.startsWith(CURRENT_VERIFIER_PREFIX)
      ? await this.derivePasswordVerifier(password, salt)
      : await this.deriveLegacyPasswordVerifier(password, salt);
    return actual === expectedVerifier;
  }

  static needsVerifierUpgrade(verifier: string) {
    return !verifier.startsWith(CURRENT_VERIFIER_PREFIX);
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
