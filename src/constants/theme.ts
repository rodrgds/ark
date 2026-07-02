export type EffectiveTheme = 'oled' | 'dark' | 'light';
export type ThemePreference = 'system' | EffectiveTheme;
export type StaticAccentPreference = 'moss' | 'amber' | 'clay' | 'blue' | 'violet';
export type AccentPreference = 'system' | StaticAccentPreference;

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system';
export const DEFAULT_ACCENT_PREFERENCE: AccentPreference = 'system';

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; description: string }> =
  [
    {
      value: 'system',
      label: 'System',
      description: 'Follows the phone light or dark setting.',
    },
    {
      value: 'oled',
      label: 'OLED',
      description:
        'True black command-center mode. Better for OLED screens and low-light environments.',
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

export const ACCENT_OPTIONS: Array<{
  value: AccentPreference;
  label: string;
  description: string;
}> = [
  {
    value: 'system',
    label: 'System',
    description: 'Uses Android Material You when available, with Moss as the fallback.',
  },
  {
    value: 'moss',
    label: 'Moss',
    description: 'Default low-glare Ark green.',
  },
  {
    value: 'amber',
    label: 'Amber',
    description: 'Warm command accent for low-light use.',
  },
  {
    value: 'clay',
    label: 'Clay',
    description: 'Earth-tone accent with restrained warning energy.',
  },
  {
    value: 'blue',
    label: 'Blue',
    description: 'Cool accent for map and document-heavy use.',
  },
  {
    value: 'violet',
    label: 'Violet',
    description: 'High-contrast accent for quick scanning.',
  },
];

export type ThemeColors = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  border: string;
  input: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  ring: string;
  destructive: string;
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
};

export type AccentColorsByTheme = Record<
  EffectiveTheme,
  Pick<ThemeColors, 'primary' | 'primaryForeground'>
>;

export const NAV_COLORS: Record<EffectiveTheme, ThemeColors> = {
  oled: {
    background: '#000000',
    foreground: '#EAE9FC',
    card: '#0C0F0B',
    cardForeground: '#EAE9FC',
    popover: '#0C0F0B',
    popoverForeground: '#EAE9FC',
    border: '#313A2C',
    input: '#313A2C',
    primary: '#95A78B',
    primaryForeground: '#0C0F0B',
    secondary: '#495742',
    secondaryForeground: '#F2F4F0',
    muted: '#181D16',
    mutedForeground: '#AFBDA8',
    accent: '#627458',
    accentForeground: '#F2F4F0',
    ring: '#95A78B',
    destructive: '#F87171',
    sidebar: '#000000',
    sidebarForeground: '#EAE9FC',
    sidebarPrimary: '#95A78B',
    sidebarPrimaryForeground: '#0C0F0B',
    sidebarAccent: '#181D16',
    sidebarAccentForeground: '#EAE9FC',
    sidebarBorder: '#313A2C',
    sidebarRing: '#95A78B',
    chart1: '#95A78B',
    chart2: '#F87171',
    chart3: '#CCCCCC',
    chart4: '#97979B',
    chart5: '#CAD3C5',
  },
  dark: {
    background: '#1A1A1A',
    foreground: '#EAE9FC',
    card: '#181D16',
    cardForeground: '#EAE9FC',
    popover: '#181D16',
    popoverForeground: '#EAE9FC',
    border: '#495742',
    input: '#495742',
    primary: '#95A78B',
    primaryForeground: '#0C0F0B',
    secondary: '#495742',
    secondaryForeground: '#F2F4F0',
    muted: '#313A2C',
    mutedForeground: '#AFBDA8',
    accent: '#627458',
    accentForeground: '#F2F4F0',
    ring: '#95A78B',
    destructive: '#F87171',
    sidebar: '#1A1A1A',
    sidebarForeground: '#EAE9FC',
    sidebarPrimary: '#95A78B',
    sidebarPrimaryForeground: '#0C0F0B',
    sidebarAccent: '#313A2C',
    sidebarAccentForeground: '#EAE9FC',
    sidebarBorder: '#495742',
    sidebarRing: '#95A78B',
    chart1: '#95A78B',
    chart2: '#F87171',
    chart3: '#CCCCCC',
    chart4: '#97979B',
    chart5: '#CAD3C5',
  },
  light: {
    background: '#F2F2F2',
    foreground: '#050316',
    card: '#F2F4F0',
    cardForeground: '#050316',
    popover: '#F2F4F0',
    popoverForeground: '#050316',
    border: '#CAD3C5',
    input: '#CAD3C5',
    primary: '#4A5742',
    primaryForeground: '#F2F4F0',
    secondary: '#E5E9E2',
    secondaryForeground: '#0C0F0B',
    muted: '#E5E9E2',
    mutedForeground: '#4A5742',
    accent: '#CAD3C5',
    accentForeground: '#0C0F0B',
    ring: '#627458',
    destructive: '#B42318',
    sidebar: '#E6E6E6',
    sidebarForeground: '#050316',
    sidebarPrimary: '#4A5742',
    sidebarPrimaryForeground: '#F2F4F0',
    sidebarAccent: '#E5E9E2',
    sidebarAccentForeground: '#0C0F0B',
    sidebarBorder: '#CAD3C5',
    sidebarRing: '#627458',
    chart1: '#627458',
    chart2: '#B42318',
    chart3: '#333333',
    chart4: '#7D7D82',
    chart5: '#95A78B',
  },
} as const;

const ACCENT_COLORS: Record<StaticAccentPreference, AccentColorsByTheme> = {
  moss: {
    oled: { primary: '#95A78B', primaryForeground: '#0C0F0B' },
    dark: { primary: '#95A78B', primaryForeground: '#0C0F0B' },
    light: { primary: '#4A5742', primaryForeground: '#F2F4F0' },
  },
  amber: {
    oled: { primary: '#F2B84B', primaryForeground: '#0C0F0B' },
    dark: { primary: '#F2B84B', primaryForeground: '#0C0F0B' },
    light: { primary: '#8A5A11', primaryForeground: '#FFF8E6' },
  },
  clay: {
    oled: { primary: '#D6905E', primaryForeground: '#0F0A07' },
    dark: { primary: '#D6905E', primaryForeground: '#0F0A07' },
    light: { primary: '#8A4A25', primaryForeground: '#FFF6EE' },
  },
  blue: {
    oled: { primary: '#8EB6FF', primaryForeground: '#07111F' },
    dark: { primary: '#8EB6FF', primaryForeground: '#07111F' },
    light: { primary: '#315F9D', primaryForeground: '#F1F6FF' },
  },
  violet: {
    oled: { primary: '#A99CFF', primaryForeground: '#0E0A24' },
    dark: { primary: '#A99CFF', primaryForeground: '#0E0A24' },
    light: { primary: '#5A47BC', primaryForeground: '#F5F2FF' },
  },
};

const DESTRUCTIVE_COLORS: Record<EffectiveTheme, { destructive: string; chart2: string }> = {
  oled: { destructive: '#F87171', chart2: '#F87171' },
  dark: { destructive: '#F87171', chart2: '#F87171' },
  light: { destructive: '#B42318', chart2: '#B42318' },
};

export const DEFAULT_SYSTEM_ACCENT_COLORS: AccentColorsByTheme = ACCENT_COLORS.moss;

type HslColor = {
  h: number;
  s: number;
  l: number;
};

const TONE_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeHue(hue: number) {
  return ((hue % 360) + 360) % 360;
}

function hexToHsl(hex: string): HslColor {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return { h: 120, s: 0, l: lightness * 100 };
  }

  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === red) {
    hue = 60 * (((green - blue) / delta) % 6);
  } else if (max === green) {
    hue = 60 * ((blue - red) / delta + 2);
  } else {
    hue = 60 * ((red - green) / delta + 4);
  }

  return { h: normalizeHue(hue), s: saturation * 100, l: lightness * 100 };
}

function hslToHex({ h, s, l }: HslColor) {
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs(((normalizeHue(h) / 60) % 2) - 1));
  const m = lightness - chroma / 2;
  const hue = normalizeHue(h);
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = chroma;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = chroma;
  } else if (hue < 180) {
    green = chroma;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = chroma;
  } else if (hue < 300) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  return [red, green, blue]
    .map((channel) =>
      Math.round((channel + m) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')
    .toUpperCase()
    .replace(/^/, '#');
}

function tone(hsl: HslColor, lightness: number, saturationScale = 1, hueShift = 0) {
  return hslToHex({
    h: hsl.h + hueShift,
    s: clamp(hsl.s * saturationScale, 5, 72),
    l: lightness,
  });
}

function toneScale(hsl: HslColor, theme: EffectiveTheme, saturationScale: number) {
  const lightnessStops =
    theme === 'light'
      ? [97, 94, 88, 78, 66, 55, 44, 34, 24, 14, 8]
      : [5, 9, 15, 23, 34, 45, 58, 70, 80, 89, 95];
  return Object.fromEntries(
    TONE_STOPS.map((stop, index) => [
      `--color-secondary-${stop}`,
      tone(hsl, lightnessStops[index] ?? 50, saturationScale),
    ])
  );
}

function neutralScale(theme: EffectiveTheme) {
  const dark = {
    50: '#050505',
    100: '#121212',
    200: '#242424',
    300: '#3A3A3A',
    400: '#575757',
    500: '#737373',
    600: '#9A9A9A',
    700: '#BDBDBD',
    800: '#D6D6D6',
    900: '#E8E8E8',
    950: '#F4F4F4',
  };
  const light = {
    50: '#F6F6F6',
    100: '#EDEDED',
    200: '#D9D9D9',
    300: '#BFBFBF',
    400: '#A0A0A0',
    500: '#7D7D7D',
    600: '#5F5F5F',
    700: '#454545',
    800: '#2E2E2E',
    900: '#181818',
    950: '#0D0D0D',
  };
  const source = theme === 'light' ? light : dark;
  return Object.fromEntries(TONE_STOPS.map((stop) => [`--color-primary-${stop}`, source[stop]]));
}

function getAccent(
  theme: EffectiveTheme,
  accentPreference: AccentPreference,
  systemAccentColors: AccentColorsByTheme
) {
  return accentPreference === 'system'
    ? systemAccentColors[theme]
    : ACCENT_COLORS[accentPreference][theme];
}

function buildSemanticPalette(
  theme: EffectiveTheme,
  accentPreference: AccentPreference,
  systemAccentColors: AccentColorsByTheme
): ThemeColors {
  const accent = getAccent(theme, accentPreference, systemAccentColors);
  const hsl = hexToHsl(accent.primary);
  const secondarySaturation = theme === 'light' ? 0.48 : theme === 'oled' ? 0.42 : 0.5;
  const companionHue = theme === 'light' ? -12 : -8;
  const companionSaturation = theme === 'light' ? 0.32 : 0.28;
  const base = NAV_COLORS[theme];

  if (theme === 'light') {
    return {
      ...base,
      background: tone(hsl, 97, 0.12),
      foreground: tone(hsl, 8, 0.38),
      card: tone(hsl, 95, 0.2),
      cardForeground: tone(hsl, 8, 0.38),
      popover: tone(hsl, 96, 0.22),
      popoverForeground: tone(hsl, 8, 0.38),
      border: tone(hsl, 82, 0.3),
      input: tone(hsl, 82, 0.3),
      primary: accent.primary,
      primaryForeground: accent.primaryForeground,
      secondary: tone(hsl, 90, secondarySaturation),
      secondaryForeground: tone(hsl, 16, 0.46),
      muted: tone(hsl, 92, 0.2),
      mutedForeground: tone(hsl, 33, 0.4),
      accent: tone(hsl, 87, 0.36),
      accentForeground: tone(hsl, 14, 0.46),
      ring: tone(hsl, 43, 0.7),
      sidebar: tone(hsl, 94, 0.16),
      sidebarForeground: tone(hsl, 8, 0.38),
      sidebarPrimary: accent.primary,
      sidebarPrimaryForeground: accent.primaryForeground,
      sidebarAccent: tone(hsl, 90, 0.24),
      sidebarAccentForeground: tone(hsl, 14, 0.46),
      sidebarBorder: tone(hsl, 82, 0.3),
      sidebarRing: tone(hsl, 43, 0.7),
      chart1: accent.primary,
      chart2: DESTRUCTIVE_COLORS.light.chart2,
      chart3: tone(hsl, 26, 0.42),
      chart4: tone(hsl, 56, 0.3, companionHue),
      chart5: tone(hsl, 66, companionSaturation, companionHue),
      destructive: DESTRUCTIVE_COLORS.light.destructive,
    };
  }

  if (theme === 'oled') {
    return {
      ...base,
      background: '#000000',
      foreground: tone(hsl, 93, 0.14),
      card: tone(hsl, 5, 0.18),
      cardForeground: tone(hsl, 93, 0.14),
      popover: tone(hsl, 6, 0.22),
      popoverForeground: tone(hsl, 93, 0.14),
      border: tone(hsl, 18, 0.34),
      input: tone(hsl, 18, 0.34),
      primary: accent.primary,
      primaryForeground: accent.primaryForeground,
      secondary: tone(hsl, 21, secondarySaturation),
      secondaryForeground: tone(hsl, 94, 0.22),
      muted: tone(hsl, 9, 0.24),
      mutedForeground: tone(hsl, 73, 0.25),
      accent: tone(hsl, 26, 0.42),
      accentForeground: tone(hsl, 94, 0.22),
      ring: accent.primary,
      sidebar: '#000000',
      sidebarForeground: tone(hsl, 93, 0.14),
      sidebarPrimary: accent.primary,
      sidebarPrimaryForeground: accent.primaryForeground,
      sidebarAccent: tone(hsl, 9, 0.24),
      sidebarAccentForeground: tone(hsl, 93, 0.14),
      sidebarBorder: tone(hsl, 18, 0.34),
      sidebarRing: accent.primary,
      chart1: accent.primary,
      chart2: DESTRUCTIVE_COLORS.oled.chart2,
      chart3: tone(hsl, 78, 0.2),
      chart4: tone(hsl, 58, 0.3, companionHue),
      chart5: tone(hsl, 80, companionSaturation, companionHue),
      destructive: DESTRUCTIVE_COLORS.oled.destructive,
    };
  }

  return {
    ...base,
    background: tone(hsl, 8, 0.12),
    foreground: tone(hsl, 93, 0.14),
    card: tone(hsl, 11, 0.2),
    cardForeground: tone(hsl, 93, 0.14),
    popover: tone(hsl, 12, 0.22),
    popoverForeground: tone(hsl, 93, 0.14),
    border: tone(hsl, 24, 0.34),
    input: tone(hsl, 24, 0.34),
    primary: accent.primary,
    primaryForeground: accent.primaryForeground,
    secondary: tone(hsl, 25, secondarySaturation),
    secondaryForeground: tone(hsl, 94, 0.22),
    muted: tone(hsl, 17, 0.24),
    mutedForeground: tone(hsl, 74, 0.25),
    accent: tone(hsl, 31, 0.42),
    accentForeground: tone(hsl, 94, 0.22),
    ring: accent.primary,
    sidebar: tone(hsl, 9, 0.14),
    sidebarForeground: tone(hsl, 93, 0.14),
    sidebarPrimary: accent.primary,
    sidebarPrimaryForeground: accent.primaryForeground,
    sidebarAccent: tone(hsl, 17, 0.24),
    sidebarAccentForeground: tone(hsl, 93, 0.14),
    sidebarBorder: tone(hsl, 24, 0.34),
    sidebarRing: accent.primary,
    chart1: accent.primary,
    chart2: DESTRUCTIVE_COLORS.dark.chart2,
    chart3: tone(hsl, 78, 0.2),
    chart4: tone(hsl, 58, 0.3, companionHue),
    chart5: tone(hsl, 80, companionSaturation, companionHue),
    destructive: DESTRUCTIVE_COLORS.dark.destructive,
  };
}

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'oled' || value === 'dark' || value === 'light';
}

export function isAccentPreference(value: string | null): value is AccentPreference {
  return (
    value === 'system' ||
    value === 'moss' ||
    value === 'amber' ||
    value === 'clay' ||
    value === 'blue' ||
    value === 'violet'
  );
}

export function getThemeColors(
  theme: EffectiveTheme,
  accentPreference: AccentPreference = DEFAULT_ACCENT_PREFERENCE,
  systemAccentColors: AccentColorsByTheme = DEFAULT_SYSTEM_ACCENT_COLORS
): ThemeColors {
  return buildSemanticPalette(theme, accentPreference, systemAccentColors);
}

export function getAccentCssVariables(
  theme: EffectiveTheme,
  accentPreference: AccentPreference,
  systemAccentColors: AccentColorsByTheme = DEFAULT_SYSTEM_ACCENT_COLORS
) {
  const colors = getThemeColors(theme, accentPreference, systemAccentColors);
  const hsl = hexToHsl(colors.primary);
  const secondaryScale = toneScale(hsl, theme, theme === 'light' ? 0.48 : 0.42);
  const accentScale = Object.fromEntries(
    TONE_STOPS.map((stop, index) => {
      const lightnessStops =
        theme === 'light'
          ? [97, 94, 88, 78, 66, 55, 44, 34, 24, 14, 8]
          : [5, 9, 15, 23, 34, 45, 58, 70, 80, 89, 95];
      return [`--color-accent-${stop}`, tone(hsl, lightnessStops[index] ?? 50, 0.22, -10)];
    })
  );
  return {
    ...neutralScale(theme),
    ...secondaryScale,
    ...accentScale,
    '--color-background': colors.background,
    '--color-foreground': colors.foreground,
    '--color-card': colors.card,
    '--color-card-foreground': colors.cardForeground,
    '--color-popover': colors.popover,
    '--color-popover-foreground': colors.popoverForeground,
    '--color-primary': colors.primary,
    '--color-primary-foreground': colors.primaryForeground,
    '--color-secondary': colors.secondary,
    '--color-secondary-foreground': colors.secondaryForeground,
    '--color-muted': colors.muted,
    '--color-muted-foreground': colors.mutedForeground,
    '--color-accent': colors.accent,
    '--color-accent-foreground': colors.accentForeground,
    '--color-border': colors.border,
    '--color-input': colors.input,
    '--color-ring': colors.ring,
    '--color-chart-1': colors.chart1,
    '--color-chart-2': colors.chart2,
    '--color-chart-3': colors.chart3,
    '--color-chart-4': colors.chart4,
    '--color-chart-5': colors.chart5,
    '--color-sidebar': colors.sidebar,
    '--color-sidebar-foreground': colors.sidebarForeground,
    '--color-sidebar-primary': colors.sidebarPrimary,
    '--color-sidebar-primary-foreground': colors.sidebarPrimaryForeground,
    '--color-sidebar-accent': colors.sidebarAccent,
    '--color-sidebar-accent-foreground': colors.sidebarAccentForeground,
    '--color-sidebar-border': colors.sidebarBorder,
    '--color-sidebar-ring': colors.sidebarRing,
  };
}
