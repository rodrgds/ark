import { create } from 'zustand';
import { Uniwind } from 'uniwind';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import {
  DEFAULT_ACCENT_PREFERENCE,
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_SYSTEM_ACCENT_COLORS,
  type AccentColorsByTheme,
  getAccentCssVariables,
  getThemeColors,
  isAccentPreference,
  isThemePreference,
  type AccentPreference,
  type EffectiveTheme,
  type ThemeColors,
  type ThemePreference,
} from '@/constants/theme';
import { Appearance } from 'react-native';
import { SystemColorsService } from '@/services/device/system-colors.service';

type ThemeState = {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  accentPreference: AccentPreference;
  systemAccentAvailable: boolean;
  systemAccentColors: AccentColorsByTheme;
  systemAccentSource: 'android-material-you' | 'unsupported' | 'fallback';
  systemAccentReason?: string;
  colors: ThemeColors;
  init: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
  setAccentPreference: (preference: AccentPreference) => Promise<void>;
  refreshSystemAccent: () => Promise<void>;
};

const EFFECTIVE_THEMES: EffectiveTheme[] = ['oled', 'dark', 'light'];

function getSystemTheme(): EffectiveTheme {
  return Appearance.getColorScheme() === 'light' ? 'light' : 'dark';
}

function getEffective(preference: ThemePreference): EffectiveTheme {
  return preference === 'system' ? getSystemTheme() : preference;
}

function applyAccentPreference(
  preference: AccentPreference,
  systemAccentColors: AccentColorsByTheme
) {
  for (const theme of EFFECTIVE_THEMES) {
    Uniwind.updateCSSVariables(theme, getAccentCssVariables(theme, preference, systemAccentColors));
  }
}

function applyTheme(
  preference: ThemePreference,
  accentPreference: AccentPreference,
  systemAccentColors: AccentColorsByTheme
) {
  applyAccentPreference(accentPreference, systemAccentColors);
  if (preference === 'system') {
    Uniwind.setTheme('system');
  } else {
    Uniwind.setTheme(preference);
  }
  const effectiveTheme = getEffective(preference);
  return {
    effectiveTheme,
    colors: getThemeColors(effectiveTheme, accentPreference, systemAccentColors),
  };
}

let appearanceSubscription: { remove: () => void } | null = null;
const initialEffectiveTheme = getEffective(DEFAULT_THEME_PREFERENCE);

export const useThemeStore = create<ThemeState>((set) => ({
  preference: DEFAULT_THEME_PREFERENCE,
  effectiveTheme: initialEffectiveTheme,
  accentPreference: DEFAULT_ACCENT_PREFERENCE,
  systemAccentAvailable: false,
  systemAccentColors: DEFAULT_SYSTEM_ACCENT_COLORS,
  systemAccentSource: 'fallback',
  colors: getThemeColors(initialEffectiveTheme, DEFAULT_ACCENT_PREFERENCE),
  init: async () => {
    const [storedTheme, storedAccent, systemAccent] = await Promise.all([
      SettingsRepository.get('theme.preference'),
      SettingsRepository.get('theme.accentPreference'),
      SystemColorsService.getAccentColors(),
    ]);
    const preference = isThemePreference(storedTheme) ? storedTheme : DEFAULT_THEME_PREFERENCE;
    const accentPreference = isAccentPreference(storedAccent)
      ? storedAccent
      : DEFAULT_ACCENT_PREFERENCE;
    const next = applyTheme(preference, accentPreference, systemAccent.colors);
    set({
      preference,
      accentPreference,
      systemAccentAvailable: systemAccent.available,
      systemAccentColors: systemAccent.colors,
      systemAccentSource: systemAccent.source,
      systemAccentReason: systemAccent.reason,
      ...next,
    });
    appearanceSubscription ??= Appearance.addChangeListener(() => {
      const current = useThemeStore.getState();
      if (current.preference !== 'system') return;
      const effectiveTheme = getSystemTheme();
      set({
        effectiveTheme,
        colors: getThemeColors(
          effectiveTheme,
          current.accentPreference,
          current.systemAccentColors
        ),
      });
    });
  },
  setPreference: async (preference) => {
    const current = useThemeStore.getState();
    const next = applyTheme(preference, current.accentPreference, current.systemAccentColors);
    await SettingsRepository.set('theme.preference', preference);
    set({ preference, ...next });
  },
  setAccentPreference: async (preference) => {
    let current = useThemeStore.getState();
    if (preference === 'system') {
      const systemAccent = await SystemColorsService.getAccentColors();
      set({
        systemAccentAvailable: systemAccent.available,
        systemAccentColors: systemAccent.colors,
        systemAccentSource: systemAccent.source,
        systemAccentReason: systemAccent.reason,
      });
      current = useThemeStore.getState();
    }
    const next = applyTheme(current.preference, preference, current.systemAccentColors);
    await SettingsRepository.set('theme.accentPreference', preference);
    set({ accentPreference: preference, ...next });
  },
  refreshSystemAccent: async () => {
    const current = useThemeStore.getState();
    const systemAccent = await SystemColorsService.getAccentColors();
    const next = applyTheme(current.preference, current.accentPreference, systemAccent.colors);
    set({
      systemAccentAvailable: systemAccent.available,
      systemAccentColors: systemAccent.colors,
      systemAccentSource: systemAccent.source,
      systemAccentReason: systemAccent.reason,
      ...next,
    });
  },
}));
