export type ThemePreference = 'oled' | 'dark' | 'light';

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> =
  [
    {
      value: 'oled',
      label: 'OLED (Recommended)',
      description: 'True black command-center mode.',
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
  ];

export const NAV_COLORS = {
  oled: {
    background: '#0D0D0D',
    foreground: '#EAE9FC',
    card: '#0C0F0B',
    border: '#313A2C',
    primary: '#95A78B',
    mutedForeground: '#AFBDA8',
    destructive: '#5B4BE7',
  },
  dark: {
    background: '#1A1A1A',
    foreground: '#EAE9FC',
    card: '#181D16',
    border: '#495742',
    primary: '#95A78B',
    mutedForeground: '#AFBDA8',
    destructive: '#5B4BE7',
  },
  light: {
    background: '#F2F2F2',
    foreground: '#050316',
    card: '#F2F4F0',
    border: '#CAD3C5',
    primary: '#4A5742',
    mutedForeground: '#4A5742',
    destructive: '#321FE0',
  },
} as const;
