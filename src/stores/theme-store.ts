import { create } from 'zustand';
import { Appearance, type NativeEventSubscription } from 'react-native';
import { Uniwind } from 'uniwind';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import type { ThemePreference } from '@/constants/theme';

type ThemeState = {
  preference: ThemePreference;
  effectiveTheme: 'oled' | 'dark' | 'light';
  ready: boolean;
  init: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

function getEffective(preference: ThemePreference): 'oled' | 'dark' | 'light' {
  if (preference === 'system') return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
  return preference;
}

function applyTheme(preference: ThemePreference) {
  const effectiveTheme = getEffective(preference);
  Uniwind.setTheme(effectiveTheme);
  return effectiveTheme;
}

let appearanceSubscription: NativeEventSubscription | null = null;

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: 'oled',
  effectiveTheme: 'oled',
  ready: false,
  init: async () => {
    appearanceSubscription ??= Appearance.addChangeListener(() => {
      if (get().preference !== 'system') return;
      const effectiveTheme = applyTheme('system');
      set({ effectiveTheme });
    });
    const stored = (await SettingsRepository.get('theme.preference')) as ThemePreference | null;
    const preference = stored ?? 'oled';
    const effectiveTheme = applyTheme(preference);
    set({ preference, effectiveTheme, ready: true });
  },
  setPreference: async (preference) => {
    const effectiveTheme = applyTheme(preference);
    await SettingsRepository.set('theme.preference', preference);
    set({ preference, effectiveTheme });
  },
}));
