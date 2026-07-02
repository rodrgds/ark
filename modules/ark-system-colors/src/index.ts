import { NativeModule, requireOptionalNativeModule } from 'expo-modules-core';

export type ArkSystemThemeAccent = {
  primary: string;
  primaryForeground: string;
};

export type ArkSystemAccentColors = {
  oled: ArkSystemThemeAccent;
  dark: ArkSystemThemeAccent;
  light: ArkSystemThemeAccent;
};

export type ArkSystemAccentResult = {
  available: boolean;
  source: 'android-material-you' | 'unsupported' | 'fallback';
  colors?: ArkSystemAccentColors;
  reason?: string;
};

declare class ArkSystemColorsModule extends NativeModule {
  getAccentColors(): Promise<ArkSystemAccentResult>;
}

const ArkSystemColors = requireOptionalNativeModule<ArkSystemColorsModule>('ArkSystemColors');

export async function getSystemAccentColors(): Promise<ArkSystemAccentResult> {
  if (!ArkSystemColors) {
    return {
      available: false,
      source: 'fallback',
      reason: 'Native system color module is not available in this runtime.',
    };
  }
  return ArkSystemColors.getAccentColors();
}

export default ArkSystemColors;
