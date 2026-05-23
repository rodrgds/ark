import { NAV_THEME } from '@/lib/theme';
import { useThemeStore } from '@/stores/theme-store';
import { Stack } from 'expo-router';

const titles: Record<string, string> = {
  compass: 'Compass',
  barometer: 'Barometer',
  level: 'Level',
  pedometer: 'Pedometer',
  chronometer: 'Chronometer',
  light: 'Light Meter',
  coordinates: 'Coordinates',
  weather: 'Meteorology',
  checklist: 'Checklist',
  diagnostics: 'Diagnostics',
};

export default function ToolsLayout() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_THEME[theme].colors;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}>
      {Object.entries(titles).map(([name, title]) => (
        <Stack.Screen key={name} name={name} options={{ title }} />
      ))}
    </Stack>
  );
}
