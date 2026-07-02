import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import {
  NAV_COLORS,
  getThemeColors,
  type AccentPreference,
  type EffectiveTheme,
} from '@/constants/theme';

function buildNavigationTheme(theme: EffectiveTheme, accentPreference: AccentPreference): Theme {
  const baseTheme = theme === 'light' ? DefaultTheme : DarkTheme;
  const colors = getThemeColors(theme, accentPreference);
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
  accentPreference: AccentPreference = 'moss'
): Theme {
  return buildNavigationTheme(theme, accentPreference);
}

export const NAV_THEME: Record<EffectiveTheme, Theme> = {
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
