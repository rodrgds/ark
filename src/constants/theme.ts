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
    background: '#000000',
    foreground: '#F5F5F4',
    card: '#0A0A0A',
    border: '#27272A',
    primary: '#F2B84B',
    destructive: '#EF4444',
  },
  dark: {
    background: '#09090B',
    foreground: '#FAFAFA',
    card: '#18181B',
    border: '#3F3F46',
    primary: '#F2B84B',
    destructive: '#EF4444',
  },
  light: {
    background: '#FAFAF9',
    foreground: '#18181B',
    card: '#FFFFFF',
    border: '#D6D3D1',
    primary: '#996515',
    destructive: '#DC2626',
  },
} as const;
