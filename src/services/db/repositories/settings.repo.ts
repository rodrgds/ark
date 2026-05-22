import { DatabaseClient } from '@/services/db/client';
import type { OnboardingState, VaultState } from '@/types/db';

export class SettingsRepository {
  static async get(key: string) {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    return row?.value ?? null;
  }

  static async set(key: string, value: string) {
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `INSERT INTO app_settings (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, Date.now()]
    );
  }

  static async getOnboardingState(): Promise<OnboardingState> {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{
      id: 'main';
      has_seen_intro: number;
      has_created_vault: number;
      has_configured_biometrics: number;
      has_selected_packs: number;
      completed_at: number | null;
    }>('SELECT * FROM onboarding_state WHERE id = ?', ['main']);
    return {
      id: 'main',
      hasSeenIntro: !!row?.has_seen_intro,
      hasCreatedVault: !!row?.has_created_vault,
      hasConfiguredBiometrics: !!row?.has_configured_biometrics,
      hasSelectedPacks: !!row?.has_selected_packs,
      completedAt: row?.completed_at ?? null,
    };
  }

  static async updateOnboardingState(patch: Partial<Omit<OnboardingState, 'id'>>) {
    const current = await this.getOnboardingState();
    const next = { ...current, ...patch };
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE onboarding_state SET
        has_seen_intro = ?,
        has_created_vault = ?,
        has_configured_biometrics = ?,
        has_selected_packs = ?,
        completed_at = ?
       WHERE id = 'main'`,
      [
        next.hasSeenIntro ? 1 : 0,
        next.hasCreatedVault ? 1 : 0,
        next.hasConfiguredBiometrics ? 1 : 0,
        next.hasSelectedPacks ? 1 : 0,
        next.completedAt,
      ]
    );
    return next;
  }

  static async getVaultState(): Promise<VaultState> {
    const db = await DatabaseClient.getDb();
    const row = await db.getFirstAsync<{
      id: 'main';
      is_initialized: number;
      password_hint: string | null;
      kdf_salt: string | null;
      created_at: number;
      updated_at: number;
      last_unlocked_at: number | null;
      auto_lock_minutes: number;
    }>('SELECT * FROM vault_state WHERE id = ?', ['main']);
    const now = Date.now();
    return {
      id: 'main',
      isInitialized: !!row?.is_initialized,
      passwordHint: row?.password_hint ?? null,
      kdfSalt: row?.kdf_salt ?? null,
      createdAt: row?.created_at ?? now,
      updatedAt: row?.updated_at ?? now,
      lastUnlockedAt: row?.last_unlocked_at ?? null,
      autoLockMinutes: row?.auto_lock_minutes ?? 5,
    };
  }

  static async updateVaultState(patch: Partial<Omit<VaultState, 'id'>>) {
    const current = await this.getVaultState();
    const next = { ...current, ...patch };
    const db = await DatabaseClient.getDb();
    await db.runAsync(
      `UPDATE vault_state SET
        is_initialized = ?,
        password_hint = ?,
        kdf_salt = ?,
        created_at = ?,
        updated_at = ?,
        last_unlocked_at = ?,
        auto_lock_minutes = ?
       WHERE id = 'main'`,
      [
        next.isInitialized ? 1 : 0,
        next.passwordHint,
        next.kdfSalt,
        next.createdAt,
        Date.now(),
        next.lastUnlockedAt,
        next.autoLockMinutes,
      ]
    );
    return next;
  }
}
