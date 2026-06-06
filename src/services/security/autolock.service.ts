import { AppState, type AppStateStatus } from 'react-native';
import { VaultService } from '@/services/security/vault.service';
import type { VaultState } from '@/types/db';

let backgroundedAt: number | null = null;
let timer: NodeJS.Timeout | null = null;
let activeVault: VaultState | null = null;
const appStateListeners = new Set<(status: AppStateStatus) => void>();

export class AutoLockService {
  /**
   * Initializes the auto-lock service by listening to AppState changes.
   * When the app moves to the background, it starts a timer to lock the vault.
   * When the app returns to the foreground, it checks if the vault should be locked.
   */
  static async start(vault: VaultState) {
    activeVault = vault;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // Notify custom listeners
      for (const listener of appStateListeners) {
        listener(nextAppState);
      }

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (!backgroundedAt) {
          backgroundedAt = Date.now();
        }

        // Set a timer to lock the vault if the app stays in background
        const timeout = vault.autoLockMinutes * 60 * 1000;
        if (timeout > 0) {
          if (timer) clearTimeout(timer);
          timer = setTimeout(async () => {
            await VaultService.lock();
            backgroundedAt = null;
          }, timeout);
        }
      } else if (nextAppState === 'active') {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }

        if (backgroundedAt) {
          const elapsed = Date.now() - backgroundedAt;
          const timeout = vault.autoLockMinutes * 60 * 1000;

          if (timeout > 0 && elapsed >= timeout) {
            await VaultService.lock();
          }
          backgroundedAt = null;
        }
      }
    });

    return () => {
      subscription.remove();
      if (timer) clearTimeout(timer);
    };
  }

  /**
   * Returns a function to subscribe to AppState changes.
   * Useful for components that need to respond to background/foreground events.
   */
  static subscribe(callback: (status: AppStateStatus) => void) {
    appStateListeners.add(callback);
    return () => {
      appStateListeners.delete(callback);
    };
  }

  /**
   * Immediately locks the vault and clears any pending timers.
   */
  static async forceLock() {
    if (timer) clearTimeout(timer);
    timer = null;
    backgroundedAt = null;
    await VaultService.lock();
  }

  /**
   * Updates the current vault configuration for the service.
   */
  static updateVault(vault: VaultState) {
    activeVault = vault;
  }

  static resetForTests() {
    backgroundedAt = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    activeVault = null;
    appStateListeners.clear();
  }

  static get backgroundedAtForTests() {
    return backgroundedAt;
  }
}
