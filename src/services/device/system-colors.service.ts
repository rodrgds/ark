import type { ArkSystemAccentResult } from 'ark-system-colors';
import {
  DEFAULT_SYSTEM_ACCENT_COLORS,
  type AccentColorsByTheme,
  type EffectiveTheme,
} from '@/constants/theme';

export type ResolvedSystemAccentColors = {
  available: boolean;
  source: 'android-material-you' | 'unsupported' | 'fallback';
  colors: AccentColorsByTheme;
  reason?: string;
};

const HEX_COLOR_RE = /^#[0-9A-F]{6}$/i;
const THEME_KEYS: EffectiveTheme[] = ['oled', 'dark', 'light'];

function isAccentColorsByTheme(value: unknown): value is AccentColorsByTheme {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AccentColorsByTheme>;
  return THEME_KEYS.every((theme) => {
    const entry = candidate[theme];
    return (
      !!entry && HEX_COLOR_RE.test(entry.primary) && HEX_COLOR_RE.test(entry.primaryForeground)
    );
  });
}

export class SystemColorsService {
  static async getAccentColors(): Promise<ResolvedSystemAccentColors> {
    try {
      const result = await this.getNativeAccentColors();
      return this.normalizeResult(result);
    } catch (error) {
      return {
        available: false,
        source: 'fallback',
        colors: DEFAULT_SYSTEM_ACCENT_COLORS,
        reason: error instanceof Error ? error.message : 'System accent colors failed to load.',
      };
    }
  }

  private static async getNativeAccentColors(): Promise<ArkSystemAccentResult> {
    const { getSystemAccentColors } = await import('ark-system-colors');
    return getSystemAccentColors();
  }

  private static normalizeResult(result: ArkSystemAccentResult): ResolvedSystemAccentColors {
    if (result.available && isAccentColorsByTheme(result.colors)) {
      return {
        available: true,
        source: result.source,
        colors: result.colors,
        reason: result.reason,
      };
    }
    return {
      available: false,
      source: result.source ?? 'fallback',
      colors: DEFAULT_SYSTEM_ACCENT_COLORS,
      reason: result.reason ?? 'System accent colors are not available in this runtime.',
    };
  }
}
