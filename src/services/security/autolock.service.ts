import { AppState, type AppStateStatus } from 'react-native';
import {
  getAuthStateForService,
  lockVaultForService,
  markVaultActivityForService,
} from '@/stores/auth-store';

type AppStateListener = (state: AppStateStatus) => void;
type VaultAutoLockState = { autoLockMinutes: number };

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
let vaultStateLoader: () => Promise<VaultAutoLockState> = loadVaultState;

const FIFTEEN_SECONDS = 15_000;
const MAX_RETRY_TIMEOUT_MS = FIFTEEN_SECONDS;

export class AutoLockService {
  static touch() {
    markVaultActivityForService();
  }

  static async enforce() {
    const state = getAuthStateForService();
    if (!state.unlocked) return;
    const vault = await vaultStateLoader();
    const thresholdMs = vault.autoLockMinutes * 60 * 1000;

    if (backgroundedAt != null) {
      const idleMs = Date.now() - backgroundedAt;
      backgroundedAt = null;
      if (idleMs >= thresholdMs) {
        lockVaultForService();
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
    const state = getAuthStateForService();
    if (!state.unlocked) return;
    const elapsed = Date.now() - state.lastActivityAt;
    const remaining = thresholdMs - elapsed;
    if (remaining <= 0) {
      lockVaultForService();
      return;
    }
    timer = setTimeout(
      () => {
        timer = null;
        void AutoLockService.enforce();
      },
      Math.min(remaining, MAX_RETRY_TIMEOUT_MS)
    );
  }

  static onAppStateChange(state: AppStateStatus) {
    const auth = getAuthStateForService();
    if (state === 'active') {
      if (auth.unlocked) {
        void AutoLockService.enforce();
      }
    } else {
      if (auth.unlocked && backgroundedAt == null) {
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

  static resetForTests() {
    backgroundedAt = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    appStateListeners.clear();
    vaultStateLoader = loadVaultState;
  }

  static setVaultStateLoaderForTests(loader: (() => Promise<VaultAutoLockState>) | null) {
    vaultStateLoader = loader ?? loadVaultState;
  }

  static get backgroundedAtForTests() {
    return backgroundedAt;
  }
}

async function loadVaultState() {
  const { SettingsRepository } = await import('@/services/db/repositories/settings.repo');
  return SettingsRepository.getVaultState();
}
