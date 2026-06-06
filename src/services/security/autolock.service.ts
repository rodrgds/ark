import { AppState, type AppStateStatus } from 'react-native';
import { useAuthStore } from '@/stores/auth-store';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';

type AppStateListener = (state: AppStateStatus) => void;

export type AppStateAdapter = {
  addEventListener: (event: string, listener: AppStateListener) => { remove: () => void };
  get currentState(): AppStateStatus;
};

const defaultAppState: AppStateAdapter = {
  addEventListener: (event, listener) =>
    AppState.addEventListener(event as 'change', listener as never),
  get currentState() {
    return AppState.currentState as 'active' | 'background' | 'inactive';
  },
};

const appStateListeners = new Set<AppStateListener>();

let backgroundedAt: number | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let activeVault: { autoLockMinutes: number } | null = null;

const FIFTEEN_SECONDS = 15_000;
const MAX_RETRY_TIMEOUT_MS = FIFTEEN_SECONDS;

export class AutoLockService {
  static async touch() {
    useAuthStore.getState().markActivity();
  }

  static async enforce() {
    const state = useAuthStore.getState();
    if (!state.unlocked) return;
    const vault = activeVault ?? (await SettingsRepository.getVaultState());
    activeVault = { autoLockMinutes: vault.autoLockMinutes };
    const thresholdMs = vault.autoLockMinutes * 60 * 1000;

    if (backgroundedAt != null) {
      const idleMs = Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (idleMs >= thresholdMs) {
        useAuthStore.getState().lock();
        return;
      }
    }

    AutoLockService.scheduleCheck(thresholdMs);
  }

  static scheduleCheck(thresholdMs: number) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    const state = useAuthStore.getState();
    if (!state.unlocked) return;
    const elapsed = Date.now() - state.lastActivityAt;
    const remaining = thresholdMs - elapsed;
    if (remaining <= 0) {
      useAuthStore.getState().lock();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      void AutoLockService.enforce();
    }, Math.min(remaining, MAX_RETRY_TIMEOUT_MS));
  }

  static onAppStateChange(state: AppStateStatus) {
    const auth = useAuthStore.getState();
    if (state === 'active') {
      backgroundedAt = null;
      if (auth.unlocked) {
        void AutoLockService.enforce();
      }
    } else {
      if (auth.unlocked) {
        backgroundedAt = Date.now();
      }
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }
    for (const listener of appStateListeners) {
      try {
        listener(state);
      } catch {
        // listener errors must not break the chain
      }
    }
  }

  static registerAppStateListener(listener: AppStateListener) {
    appStateListeners.add(listener);
    return () => {
      appStateListeners.delete(listener);
    };
  }

  static bindAppState(adapter: AppStateAdapter = defaultAppState) {
    const subscription = adapter.addEventListener('change', AutoLockService.onAppStateChange);
    return () => {
      subscription.remove();
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }
}
