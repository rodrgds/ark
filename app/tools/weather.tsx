import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { WeatherCacheService } from '@/services/weather/weather-cache.service';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

type CachedWeather = Awaited<ReturnType<typeof WeatherCacheService.getLatest>>;

export default function WeatherTool() {
  const [weather, setWeather] = React.useState<CachedWeather>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    WeatherCacheService.getLatest().then(setWeather);
  }, []);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      setWeather(await WeatherCacheService.refresh());
    } catch {
      setMessage('Refresh needs internet. Last cached forecast stays available offline.');
      setWeather(await WeatherCacheService.getLatest());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Card className="gap-3">
        <Text variant="large">Offline Weather</Text>
        <Text variant="muted">
          Ark stores the last Open-Meteo forecast locally. Refresh before going offline.
        </Text>
        <Button onPress={refresh} disabled={busy}>
          {busy ? <ActivityIndicator /> : null}
          <Text>Refresh Forecast</Text>
        </Button>
      </Card>

      {weather ? (
        <Card className="gap-3">
          <View className="gap-1">
            <Text variant="muted">{weather.location}</Text>
            <Text variant="h4">{weather.forecast.summary}</Text>
            <Text variant="muted">
              Cached {weather.freshness}
              {weather.stale ? '. Stale, but still available offline.' : ''}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-x-4 gap-y-2">
            <Text>Temperature: {formatNumber(weather.forecast.temperatureC, 'C')}</Text>
            <Text>Wind: {formatNumber(weather.forecast.windKph, 'km/h')}</Text>
            <Text>Pressure: {formatNumber(weather.forecast.pressureHpa, 'hPa')}</Text>
          </View>
          {weather.forecast.daily.map((day) => (
            <View
              key={day.date}
              className="border-border flex-row items-center justify-between border-t pt-3">
              <Text>{day.date}</Text>
              <Text variant="muted">
                {formatNumber(day.lowC, 'C')} / {formatNumber(day.highC, 'C')} · Rain{' '}
                {formatNumber(day.precipitationMm, 'mm')}
              </Text>
            </View>
          ))}
        </Card>
      ) : (
        <Card className="gap-2">
          <Text variant="large">No cached forecast yet</Text>
          <Text variant="muted">Refresh once while online so this tool works with no service.</Text>
        </Card>
      )}

      {message ? <Text className="text-destructive">{message}</Text> : null}
    </Screen>
  );
}

function formatNumber(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  return `${Math.round(value)} ${unit}`;
}
