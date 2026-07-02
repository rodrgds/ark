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
  news: 'News',
  'news/[id]': 'News',
  checklist: 'Checklist',
  diagnostics: 'Diagnostics',
};

export default function ToolsLayout() {
  const colors = useThemeStore((state) => state.colors);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}>
      {Object.entries(titles).map(([name, title]) => (
        <Stack.Screen key={name} name={name} options={{ title }} />
      ))}
    </Stack>
  );
}
