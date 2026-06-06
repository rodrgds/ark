import { create } from 'zustand';
import { Uniwind } from 'uniwind';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import type { ThemePreference } from '@/constants/theme';

type ThemeState = {
  preference: ThemePreference;
  effectiveTheme: 'oled' | 'dark' | 'light';
  init: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

function getEffective(preference: ThemePreference): 'oled' | 'dark' | 'light' {
  return preference;
}

function applyTheme(preference: ThemePreference) {
  const effectiveTheme = getEffective(preference);
  Uniwind.setTheme(effectiveTheme);
  return effectiveTheme;
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'oled' || value === 'dark' || value === 'light';
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'oled',
  effectiveTheme: 'oled',
  init: async () => {
    const stored = await SettingsRepository.get('theme.preference');
    const preference = isThemePreference(stored) ? stored : 'oled';
    const effectiveTheme = applyTheme(preference);
    set({ preference, effectiveTheme });
  },
  setPreference: async (preference) => {
    const effectiveTheme = applyTheme(preference);
    await SettingsRepository.set('theme.preference', preference);
    set({ preference, effectiveTheme });
  },
}));
