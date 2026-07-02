import {
  DEFAULT_ACCENT_PREFERENCE,
  NAV_COLORS,
  DEFAULT_SYSTEM_ACCENT_COLORS,
  getThemeColors,
  type AccentColorsByTheme,
  type AccentPreference,
  type EffectiveTheme,
} from '@/constants/theme';
import { DarkTheme, DefaultTheme } from 'expo-router';

type NavigationTheme = typeof DefaultTheme;

function buildNavigationTheme(
  theme: EffectiveTheme,
  accentPreference: AccentPreference,
  systemAccentColors: AccentColorsByTheme
): NavigationTheme {
  const baseTheme = theme === 'light' ? DefaultTheme : DarkTheme;
  const colors = getThemeColors(theme, accentPreference, systemAccentColors);
  return {
    ...baseTheme,
    colors: {
      background: colors.background,
      border: colors.border,
      card: colors.card,
      notification: colors.destructive,
      primary: colors.primary,
      text: colors.foreground,
    },
  };
}

export function getNavigationTheme(
  theme: EffectiveTheme,
  accentPreference: AccentPreference = DEFAULT_ACCENT_PREFERENCE,
  systemAccentColors: AccentColorsByTheme = DEFAULT_SYSTEM_ACCENT_COLORS
): NavigationTheme {
  return buildNavigationTheme(theme, accentPreference, systemAccentColors);
}

export const NAV_THEME: Record<EffectiveTheme, NavigationTheme> = {
  oled: {
    ...DarkTheme,
    colors: {
      background: NAV_COLORS.oled.background,
      border: NAV_COLORS.oled.border,
      card: NAV_COLORS.oled.card,
      notification: NAV_COLORS.oled.destructive,
      primary: NAV_COLORS.oled.primary,
      text: NAV_COLORS.oled.foreground,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      background: NAV_COLORS.dark.background,
      border: NAV_COLORS.dark.border,
      card: NAV_COLORS.dark.card,
      notification: NAV_COLORS.dark.destructive,
      primary: NAV_COLORS.dark.primary,
      text: NAV_COLORS.dark.foreground,
    },
  },
  light: {
    ...DefaultTheme,
    colors: {
      background: NAV_COLORS.light.background,
      border: NAV_COLORS.light.border,
      card: NAV_COLORS.light.card,
      notification: NAV_COLORS.light.destructive,
      primary: NAV_COLORS.light.primary,
      text: NAV_COLORS.light.foreground,
    },
  },
};
