import { randomUUID } from 'expo-crypto';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { HapticsService } from '@/services/device/haptics.service';
import { parseOrThrow, vaultPasswordSchema } from '@/lib/validation';
import { BiometricsService } from '@/services/security/biometrics.service';
import { KeychainService } from '@/services/security/keychain.service';
import { useAuthStore } from '@/stores/auth-store';
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
    useAuthStore.getState().unlock();
    void HapticsService.success();
    return { ok: true };
  }

  static async unlockWithPassword(password: string): Promise<VaultUnlockResult> {
    const vault = await SettingsRepository.getVaultState();
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
    if (KeychainService.needsVerifierUpgrade(expected)) {
      await KeychainService.savePasswordVerifier(
        await KeychainService.derivePasswordVerifier(password, vault.kdfSalt)
      );
    }
    await SettingsRepository.updateVaultState({
      lastUnlockedAt: now,
      failedAttempts: 0,
      lockedUntil: null,
    });
    useAuthStore.getState().unlock();
    void HapticsService.success();
    return { ok: true };
  }

  static async unlockWithBiometrics(): Promise<VaultUnlockResult> {
    const vault = await SettingsRepository.getVaultState();
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
