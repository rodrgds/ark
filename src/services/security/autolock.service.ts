import { useAuthStore } from '@/stores/auth-store';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

export class AutoLockService {
  static async touch() {
    useAuthStore.getState().markActivity();
  }

  static async enforce() {
    const state = useAuthStore.getState();
    if (!state.unlocked) return;
    const vault = await SettingsRepository.getVaultState();
    const idleMs = Date.now() - state.lastActivityAt;
    if (idleMs > vault.autoLockMinutes * 60 * 1000) {
      state.lock();
    }
  }
}
