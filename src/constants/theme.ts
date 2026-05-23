export type ThemePreference = 'oled' | 'dark' | 'light' | 'system';

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> =
  [
    {
      value: 'oled',
      label: 'OLED',
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
    background: '#0D0D0D',
    foreground: '#EAE9FC',
    card: '#0C0C0D',
    border: '#323234',
    primary: '#F2F2F2',
    mutedForeground: '#B1B1B4',
    destructive: '#5B4BE7',
  },
  dark: {
    background: '#1A1A1A',
    foreground: '#EAE9FC',
    card: '#19191A',
    border: '#4B4B4E',
    primary: '#F2F2F2',
    mutedForeground: '#B1B1B4',
    destructive: '#5B4BE7',
  },
  light: {
    background: '#F2F2F2',
    foreground: '#050316',
    card: '#E6E6E6',
    border: '#CBCBCD',
    primary: '#0D0D0D',
    mutedForeground: '#646468',
    destructive: '#321FE0',
  },
} as const;
