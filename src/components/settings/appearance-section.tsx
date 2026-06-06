import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { THEME_OPTIONS, type ThemePreference } from '@/constants/theme';
import { BatteryCharging } from 'lucide-react-native';
import { View } from 'react-native';

type AppearanceSectionProps = {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void | Promise<void>;
  batteryReduceModeEnabled: boolean;
  toggleBatteryReduceMode: () => void | Promise<void>;
};

export function AppearanceSection({
  preference,
  setPreference,
  batteryReduceModeEnabled,
  toggleBatteryReduceMode,
}: AppearanceSectionProps) {
  const currentTheme = THEME_OPTIONS.find((option) => option.value === preference);
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
    </>
  );
}
