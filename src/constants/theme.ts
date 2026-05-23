export type ThemePreference = 'oled' | 'dark' | 'light' | 'system';

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> =
  [
    {
      value: 'oled',
      label: 'OLED (Recommended - saves battery)',
      description: 'True black command-center mode. Default for first launch.',
    },
    {
      value: 'dark',
      label: 'Dark',
      description: 'Dark neutral theme with high contrast.',
    },
    {
      value: 'light',
      label: 'Light',
      description: 'Bright mode for daylight readability.',
    },
    {
      value: 'system',
      label: 'System',
      description: 'Follow the device appearance setting.',
    },
  ];

export const NAV_COLORS = {
  oled: {
    background: '#020403',
    foreground: '#F5E6C8',
    card: '#0B0F0C',
    border: '#2A332D',
    primary: '#D6A84F',
    destructive: '#E05A47',
  },
  dark: {
    background: '#0B0F0C',
    foreground: '#F4E8D0',
    card: '#151B17',
    border: '#354038',
    primary: '#D6A84F',
    destructive: '#E05A47',
  },
  light: {
    background: '#F7F8F2',
    foreground: '#18211B',
    card: '#FFFFFF',
    border: '#D0D8CA',
    primary: '#7A5A17',
    destructive: '#B33A2E',
  },
} as const;
