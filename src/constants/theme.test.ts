import { describe, expect, test } from 'bun:test';
import {
  ACCENT_OPTIONS,
  DEFAULT_ACCENT_PREFERENCE,
  DEFAULT_THEME_PREFERENCE,
  DEFAULT_SYSTEM_ACCENT_COLORS,
  THEME_OPTIONS,
  getAccentCssVariables,
  getThemeColors,
  isAccentPreference,
  type AccentColorsByTheme,
} from '@/constants/theme';

const dynamicAccent: AccentColorsByTheme = {
  oled: { primary: '#77CCAA', primaryForeground: '#0C0F0B' },
  dark: { primary: '#77CCAA', primaryForeground: '#0C0F0B' },
  light: { primary: '#276A54', primaryForeground: '#FFFFFF' },
};

describe('theme accents', () => {
  test('defaults fresh installs to system theme and system accent', () => {
    expect(DEFAULT_THEME_PREFERENCE).toBe('system');
    expect(DEFAULT_ACCENT_PREFERENCE).toBe('system');
    expect(THEME_OPTIONS[0]?.value).toBe(DEFAULT_THEME_PREFERENCE);
    expect(ACCENT_OPTIONS[0]?.value).toBe(DEFAULT_ACCENT_PREFERENCE);
  });

  test('includes System as a first-class accent preference', () => {
    expect(ACCENT_OPTIONS[0]?.value).toBe('system');
    expect(isAccentPreference('system')).toBe(true);
    expect(isAccentPreference('raw-hex')).toBe(false);
  });

  test('falls back to the Ark moss accent when system colors are unavailable', () => {
    expect(getThemeColors('oled', 'system')).toMatchObject(DEFAULT_SYSTEM_ACCENT_COLORS.oled);
    expect(getThemeColors('light', 'system')).toMatchObject(DEFAULT_SYSTEM_ACCENT_COLORS.light);
  });

  test('uses resolved native colors for System accent CSS variables', () => {
    const colors = getThemeColors('light', 'system', dynamicAccent);
    const cssVariables = getAccentCssVariables('light', 'system', dynamicAccent);

    expect(colors.primary).toBe('#276A54');
    expect(colors.primaryForeground).toBe('#FFFFFF');
    expect(cssVariables['--color-primary']).toBe('#276A54');
    expect(cssVariables['--color-primary-foreground']).toBe('#FFFFFF');
  });

  test('selected accents produce a full semantic palette, not only a primary color swap', () => {
    const moss = getThemeColors('dark', 'moss');
    const amber = getThemeColors('dark', 'amber');
    const cssVariables = getAccentCssVariables('dark', 'amber');

    expect(amber.primary).toBe('#F2B84B');
    expect(amber.card).not.toBe(moss.card);
    expect(amber.border).not.toBe(moss.border);
    expect(amber.muted).not.toBe(moss.muted);
    expect(cssVariables['--color-card']).toBe(amber.card);
    expect(cssVariables['--color-muted']).toBe(amber.muted);
    expect(cssVariables['--color-border']).toBe(amber.border);
    expect(cssVariables['--color-secondary-300']).not.toBeUndefined();
  });

  test('OLED keeps a true black background while tinting containers from the accent', () => {
    const oledBlue = getThemeColors('oled', 'blue');
    const oledViolet = getThemeColors('oled', 'violet');

    expect(oledBlue.background).toBe('#000000');
    expect(oledBlue.card).not.toBe('#000000');
    expect(oledBlue.card).not.toBe(oledViolet.card);
    expect(oledBlue.border).not.toBe(oledViolet.border);
  });
});
