import { randomUUID } from 'expo-crypto';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { HapticsService } from '@/services/device/haptics.service';
import { parseOrThrow, vaultPasswordSchema } from '@/lib/validation';
import { BiometricsService } from '@/services/security/biometrics.service';
import { KeychainService } from '@/services/security/keychain.service';
import { useAuthStore } from '@/stores/auth-store';
import type { VaultUnlockResult } from '@/types/security';

export class VaultService {
  static async initializeVault(password: string, passwordHint?: string, enableBiometrics = false) {
    let validatedPassword: string;
    try {
      validatedPassword = parseOrThrow(vaultPasswordSchema, password);
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Invalid vault passphrase.',
      };
    }
    const salt = await KeychainService.generateSalt();
    const verifier = await KeychainService.derivePasswordVerifier(validatedPassword, salt);
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
    void HapticsService.success();
    return { ok: true };
  }

  static async unlockWithPassword(password: string): Promise<VaultUnlockResult> {
    const vault = await SettingsRepository.getVaultState();
    const expected = await KeychainService.getPasswordVerifier();
    if (!vault.kdfSalt || !expected) return { ok: false, reason: 'Vault is not initialized.' };
    const matches = await KeychainService.verifyPassword(password, vault.kdfSalt, expected);
    if (!matches) return { ok: false, reason: 'Passphrase did not match.' };
    if (KeychainService.needsVerifierUpgrade(expected)) {
      await KeychainService.savePasswordVerifier(
        await KeychainService.derivePasswordVerifier(password, vault.kdfSalt)
      );
    }
    await SettingsRepository.updateVaultState({ lastUnlockedAt: Date.now() });
    useAuthStore.getState().unlock();
    void HapticsService.success();
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
    void HapticsService.success();
    return { ok: true };
  }

  static lock() {
    useAuthStore.getState().lock();
    void HapticsService.selection();
  }

  static isUnlocked() {
    return useAuthStore.getState().unlocked;
  }

  static async changePassword(input: {
    currentPassword: string;
    nextPassword: string;
    passwordHint?: string;
  }): Promise<VaultUnlockResult> {
    let nextPassword: string;
    try {
      nextPassword = parseOrThrow(vaultPasswordSchema, input.nextPassword);
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Invalid new passphrase.',
      };
    }
    const vault = await SettingsRepository.getVaultState();
    const expected = await KeychainService.getPasswordVerifier();
    if (!vault.kdfSalt || !expected) return { ok: false, reason: 'Vault is not initialized.' };
    const currentMatches = await KeychainService.verifyPassword(
      input.currentPassword,
      vault.kdfSalt,
      expected
    );
    if (!currentMatches) return { ok: false, reason: 'Current passphrase did not match.' };
    const next = await KeychainService.derivePasswordVerifier(nextPassword, vault.kdfSalt);
    await KeychainService.savePasswordVerifier(next);
    await SettingsRepository.updateVaultState({
      passwordHint: input.passwordHint?.trim() || vault.passwordHint,
      updatedAt: Date.now(),
    });
    void HapticsService.success();
    return { ok: true };
  }

  static async getBiometricsEnabled() {
    return !!(await KeychainService.getBiometricToken());
  }

  static async setBiometricsEnabled(enabled: boolean): Promise<VaultUnlockResult> {
    if (!enabled) {
      await KeychainService.deleteBiometricToken();
      await SettingsRepository.updateOnboardingState({ hasConfiguredBiometrics: false });
      return { ok: true };
    }
    const status = await BiometricsService.getStatus();
    if (!status.available || !status.enrolled) {
      return { ok: false, reason: 'Biometrics are not available or enrolled on this device.' };
    }
    const result = await BiometricsService.authenticate();
    if (!result.success)
      return { ok: false, reason: 'Biometric authentication was not completed.' };
    await KeychainService.saveBiometricToken(randomUUID());
    await SettingsRepository.updateOnboardingState({ hasConfiguredBiometrics: true });
    return { ok: true };
  }
}
