import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { TabPreferencesCard } from '@/components/settings/tab-preferences-card';
import {
  ACCENT_OPTIONS,
  THEME_OPTIONS,
  getThemeColors,
  type AccentColorsByTheme,
  type AccentPreference,
  type EffectiveTheme,
  type ThemeColors,
  type ThemePreference,
} from '@/constants/theme';
import { BatteryCharging, PanelTop } from 'lucide-react-native';
import { View } from 'react-native';

type AppearanceSectionProps = {
  preference: ThemePreference;
  effectiveTheme: EffectiveTheme;
  accentPreference: AccentPreference;
  colors: ThemeColors;
  systemAccentAvailable: boolean;
  systemAccentColors: AccentColorsByTheme;
  setPreference: (next: ThemePreference) => void | Promise<void>;
  setAccentPreference: (next: AccentPreference) => void | Promise<void>;
  batteryReduceModeEnabled: boolean;
  toggleBatteryReduceMode: () => void | Promise<void>;
  topHeaderEnabled: boolean;
  toggleTopHeader: () => void | Promise<void>;
};

export function AppearanceSection({
  preference,
  effectiveTheme,
  accentPreference,
  colors: currentColors,
  systemAccentAvailable,
  systemAccentColors,
  setPreference,
  setAccentPreference,
  batteryReduceModeEnabled,
  toggleBatteryReduceMode,
  topHeaderEnabled,
  toggleTopHeader,
}: AppearanceSectionProps) {
  const currentTheme = THEME_OPTIONS.find((option) => option.value === preference);
  const currentAccent = ACCENT_OPTIONS.find((option) => option.value === accentPreference);
  return (
    <>
      <Card className="gap-3">
        <View className="gap-1">
          <Text variant="large">Theme</Text>
          <Text variant="muted">{currentTheme?.description}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {THEME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              className="min-w-20 flex-1"
              size="sm"
              variant={preference === option.value ? 'default' : 'outline'}
              onPress={() => setPreference(option.value)}>
              <Text>{option.label.replace(' (Recommended - saves battery)', '')}</Text>
            </Button>
          ))}
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Icon as={PanelTop} className="text-primary size-5" />
              <Text variant="large">Top header bar</Text>
            </View>
            <Text variant="muted">
              Show the lock, search, and online status strip above the tabs.
            </Text>
          </View>
          <Button
            size="sm"
            variant={topHeaderEnabled ? 'default' : 'outline'}
            onPress={() => void toggleTopHeader()}>
            <Text>{topHeaderEnabled ? 'On' : 'Off'}</Text>
          </Button>
        </View>
      </Card>

      <Card className="gap-3">
        <View className="gap-1">
          <Text variant="large">Accent</Text>
          <Text variant="muted">
            {accentPreference === 'system' && systemAccentAvailable
              ? 'Following Android Material You from the current wallpaper.'
              : currentAccent?.description}
          </Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {ACCENT_OPTIONS.map((option) => {
            const selected = accentPreference === option.value;
            const colors =
              option.value === 'system'
                ? selected
                  ? currentColors
                  : getThemeColors(effectiveTheme, option.value, systemAccentColors)
                : getThemeColors(effectiveTheme, option.value, systemAccentColors);
            return (
              <Button
                key={option.value}
                className="h-auto min-w-28 flex-1 justify-start py-3"
                variant={selected ? 'default' : 'outline'}
                onPress={() => setAccentPreference(option.value)}>
                <View
                  className="border-background h-5 w-5 overflow-hidden rounded-full border"
                  style={{ backgroundColor: colors.card }}>
                  <View className="h-1/2 w-full" style={{ backgroundColor: colors.primary }} />
                  <View
                    className="h-1/2 w-full"
                    style={{
                      backgroundColor: colors.secondary,
                      borderTopColor: colors.border,
                      borderTopWidth: 1,
                    }}
                  />
                </View>
                <Text>{option.label}</Text>
              </Button>
            );
          })}
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row items-center gap-2">
              <Icon as={BatteryCharging} className="text-primary size-5" />
              <Text variant="large">Battery Reduce Mode</Text>
            </View>
            <Text variant="muted">
              Limits motion and haptics, slows live polling, pauses automatic OCR/index catch-up,
              and prefers OLED.
            </Text>
          </View>
          <Button
            size="sm"
            variant={batteryReduceModeEnabled ? 'default' : 'outline'}
            onPress={() => void toggleBatteryReduceMode()}>
            <Text>{batteryReduceModeEnabled ? 'On' : 'Off'}</Text>
          </Button>
        </View>
      </Card>

      <TabPreferencesCard />
    </>
  );
}
