import { create } from 'zustand';

type AuthState = {
  unlocked: boolean;
  lastActivityAt: number;
  unlock: () => void;
  lock: () => void;
  markActivity: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  unlocked: false,
  lastActivityAt: Date.now(),
  unlock: () => set({ unlocked: true, lastActivityAt: Date.now() }),
  lock: () => set({ unlocked: false }),
  markActivity: () => set({ lastActivityAt: Date.now() }),
}));
