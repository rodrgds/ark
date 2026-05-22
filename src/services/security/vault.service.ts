import { randomUUID } from 'expo-crypto';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { BiometricsService } from '@/services/security/biometrics.service';
import { KeychainService } from '@/services/security/keychain.service';
import { useAuthStore } from '@/stores/auth-store';
import type { VaultUnlockResult } from '@/types/security';

export class VaultService {
  static async initializeVault(password: string, passwordHint?: string, enableBiometrics = false) {
    if (password.trim().length < 8) {
      return { ok: false, reason: 'Use at least 8 characters for the vault passphrase.' };
    }
    const salt = await KeychainService.generateSalt();
    const verifier = await KeychainService.derivePasswordVerifier(password, salt);
    await KeychainService.savePasswordVerifier(verifier);
    if (enableBiometrics) {
      await KeychainService.saveBiometricToken(randomUUID());
    }
    const now = Date.now();
    await SettingsRepository.updateVaultState({
      isInitialized: true,
      passwordHint: passwordHint?.trim() || null,
      kdfSalt: salt,
      createdAt: now,
      updatedAt: now,
      lastUnlockedAt: now,
    });
    useAuthStore.getState().unlock();
    return { ok: true };
  }

  static async unlockWithPassword(password: string): Promise<VaultUnlockResult> {
    const vault = await SettingsRepository.getVaultState();
    const expected = await KeychainService.getPasswordVerifier();
    if (!vault.kdfSalt || !expected) return { ok: false, reason: 'Vault is not initialized.' };
    const actual = await KeychainService.derivePasswordVerifier(password, vault.kdfSalt);
    if (actual !== expected) return { ok: false, reason: 'Passphrase did not match.' };
    await SettingsRepository.updateVaultState({ lastUnlockedAt: Date.now() });
    useAuthStore.getState().unlock();
    return { ok: true };
  }

  static async unlockWithBiometrics(): Promise<VaultUnlockResult> {
    const token = await KeychainService.getBiometricToken();
    if (!token) return { ok: false, reason: 'Biometric unlock has not been enabled.' };
    const status = await BiometricsService.getStatus();
    if (!status.available || !status.enrolled)
      return { ok: false, reason: 'Biometrics are not available on this device.' };
    const result = await BiometricsService.authenticate();
    if (!result.success)
      return { ok: false, reason: 'Biometric authentication was not completed.' };
    await SettingsRepository.updateVaultState({ lastUnlockedAt: Date.now() });
    useAuthStore.getState().unlock();
    return { ok: true };
  }

  static lock() {
    useAuthStore.getState().lock();
  }

  static isUnlocked() {
    return useAuthStore.getState().unlocked;
  }

  static async changePassword() {
    return {
      ok: false,
      reason: 'Password rotation UI is wired as a placeholder for the next iteration.',
    };
  }
}
