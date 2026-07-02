import { randomUUID } from 'expo-crypto';
import { DatabaseClient } from '@/services/db/client';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { DatabaseEncryptionService } from '@/services/db/encryption.service';
import { HapticsService } from '@/services/device/haptics.service';
import { parseOrThrow, vaultPasswordSchema } from '@/lib/validation';
import { BiometricsService } from '@/services/security/biometrics.service';
import { KeychainService } from '@/services/security/keychain.service';
import {
  getAuthStateForService,
  lockVaultForService,
  unlockVaultForService,
} from '@/stores/auth-store';
import type { VaultUnlockResult } from '@/types/security';

const RATE_LIMIT_TIERS = [
  { threshold: 15, lockMs: 60 * 60 * 1000 },
  { threshold: 10, lockMs: 5 * 60 * 1000 },
  { threshold: 5, lockMs: 30 * 1000 },
];

function lockDurationFor(failedAttempts: number): number {
  for (const tier of RATE_LIMIT_TIERS) {
    if (failedAttempts >= tier.threshold) return tier.lockMs;
  }
  return 0;
}

function formatLockoutDuration(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.ceil(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.ceil(totalMinutes / 60);
  return `${totalHours} hr`;
}

export class VaultService {
  static async initializeVault(password: string, passwordHint?: string, enableBiometrics = false) {
    const existing = await SettingsRepository.getVaultState();
    if (existing.isInitialized) {
      return { ok: false, reason: 'Vault is already initialized.' };
    }
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
    await SettingsRepository.updateOnboardingState({ hasCreatedVault: true });
    unlockVaultForService();
    void HapticsService.success();
    return { ok: true };
  }

  static async disableVaultProtection(currentPassword?: string): Promise<VaultUnlockResult> {
    const vault = await SettingsRepository.getVaultState();
    if (vault.isInitialized) {
      const expected = await KeychainService.getPasswordVerifier();
      if (!vault.kdfSalt || !expected) {
        return { ok: false, reason: 'Vault verifier is missing.' };
      }
      if (!currentPassword) {
        return { ok: false, reason: 'Current passphrase is required to disable protection.' };
      }
      const matches = await KeychainService.verifyPassword(
        currentPassword,
        vault.kdfSalt,
        expected
      );
      if (!matches) return { ok: false, reason: 'Current passphrase did not match.' };
    }

    const now = Date.now();
    await KeychainService.deletePasswordVerifier();
    await KeychainService.deleteBiometricToken();
    await SettingsRepository.updateVaultState({
      isInitialized: false,
      passwordHint: null,
      kdfSalt: null,
      updatedAt: now,
      lastUnlockedAt: now,
      failedAttempts: 0,
      lockedUntil: null,
    });
    await SettingsRepository.updateOnboardingState({
      hasCreatedVault: false,
      hasConfiguredBiometrics: false,
    });
    unlockVaultForService();
    void HapticsService.success();
    return { ok: true };
  }

  static async unlockWithPassword(password: string): Promise<VaultUnlockResult> {
    const vault = await SettingsRepository.getVaultState();
    if (!vault.isInitialized) {
      unlockVaultForService();
      return { ok: true };
    }
    const now = Date.now();
    if (vault.lockedUntil && vault.lockedUntil > now) {
      return {
        ok: false,
        reason: `Vault is locked. Try again in ${formatLockoutDuration(vault.lockedUntil - now)}.`,
        lockedUntil: vault.lockedUntil,
      };
    }
    const expected = await KeychainService.getPasswordVerifier();
    if (!vault.kdfSalt || !expected) return { ok: false, reason: 'Vault is not initialized.' };
    const matches = await KeychainService.verifyPassword(password, vault.kdfSalt, expected);
    if (!matches) {
      const nextFailed = vault.failedAttempts + 1;
      const lockMs = lockDurationFor(nextFailed);
      const lockedUntil = lockMs > 0 ? now + lockMs : null;
      await SettingsRepository.updateVaultState({
        failedAttempts: nextFailed,
        lockedUntil,
      });
      if (lockedUntil) {
        return {
          ok: false,
          reason: `Passphrase did not match. Vault locked for ${formatLockoutDuration(lockMs)}.`,
          lockedUntil,
        };
      }
      return { ok: false, reason: 'Passphrase did not match.' };
    }
    await SettingsRepository.updateVaultState({
      lastUnlockedAt: now,
      failedAttempts: 0,
      lockedUntil: null,
    });
    unlockVaultForService();
    void HapticsService.success();
    return { ok: true };
  }

  static async unlockWithBiometrics(): Promise<VaultUnlockResult> {
    const vault = await SettingsRepository.getVaultState();
    if (!vault.isInitialized) {
      unlockVaultForService();
      return { ok: true };
    }
    const now = Date.now();
    if (vault.lockedUntil && vault.lockedUntil > now) {
      return {
        ok: false,
        reason: `Vault is locked. Try again in ${formatLockoutDuration(vault.lockedUntil - now)}.`,
        lockedUntil: vault.lockedUntil,
      };
    }
    const token = await KeychainService.getBiometricToken();
    if (!token) return { ok: false, reason: 'Biometric unlock has not been enabled.' };
    const status = await BiometricsService.getStatus();
    if (!status.available || !status.enrolled)
      return { ok: false, reason: 'Biometrics are not available on this device.' };
    const result = await BiometricsService.authenticate();
    if (!result.success)
      return { ok: false, reason: 'Biometric authentication was not completed.' };
    await SettingsRepository.updateVaultState({
      lastUnlockedAt: now,
      failedAttempts: 0,
      lockedUntil: null,
    });
    unlockVaultForService();
    void HapticsService.success();
    return { ok: true };
  }

  static lock() {
    lockVaultForService();
    void HapticsService.selection();
  }

  static isUnlocked() {
    return getAuthStateForService().unlocked;
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
    if (!vault.isInitialized || !vault.kdfSalt || !expected) {
      return { ok: false, reason: 'Passphrase protection is off.' };
    }
    const currentMatches = await KeychainService.verifyPassword(
      input.currentPassword,
      vault.kdfSalt,
      expected
    );
    if (!currentMatches) return { ok: false, reason: 'Current passphrase did not match.' };
    const nextSalt = await KeychainService.generateSalt();
    const next = await KeychainService.derivePasswordVerifier(nextPassword, nextSalt);
    try {
      await DatabaseEncryptionService.rotateDatabaseKey(await DatabaseClient.getDb());
    } catch {
      return {
        ok: false,
        reason: 'Unable to rotate the encrypted database key. Passphrase was not changed.',
      };
    }
    await KeychainService.savePasswordVerifier(next);
    try {
      await SettingsRepository.updateVaultState({
        passwordHint: input.passwordHint?.trim() || vault.passwordHint,
        kdfSalt: nextSalt,
        updatedAt: Date.now(),
      });
    } catch (error) {
      await KeychainService.savePasswordVerifier(expected);
      throw error;
    }
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
    const vault = await SettingsRepository.getVaultState();
    if (!vault.isInitialized) {
      return { ok: false, reason: 'Turn on passphrase protection before enabling biometrics.' };
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
