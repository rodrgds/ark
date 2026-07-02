import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

type AuthState = {
  unlocked: boolean;
  lastActivityAt: number;
};

const authStore = createStore<AuthState>(() => ({
  unlocked: false,
  lastActivityAt: Date.now(),
}));

export function useAuthStore<T>(selector: (state: AuthState) => T) {
  return useStore(authStore, selector);
}

export function getAuthStateForService() {
  return authStore.getState();
}

export function unlockVaultForService() {
  authStore.setState({ unlocked: true, lastActivityAt: Date.now() });
}

export function lockVaultForService() {
  authStore.setState({ unlocked: false });
}

export function markVaultActivityForService() {
  if (!authStore.getState().unlocked) return;
  authStore.setState({ lastActivityAt: Date.now() });
}

export function setAuthStateForTests(patch: Partial<AuthState>) {
  authStore.setState(patch);
}
