import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { BATTERY_POLL_INTERVALS_MS } from '@/constants/battery';
import type { ThemeColors } from '@/constants/theme';
import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';
import {
  type CachedForecastDay,
  type CachedForecastHour,
  type WeatherSymbol,
  WeatherCacheService,
} from '@/services/weather/weather-cache.service';
import { useThemeStore } from '@/stores/theme-store';
import { format } from 'date-fns';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Gauge,
  SunMedium,
  Umbrella,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Rect } from 'react-native-svg';

type CachedWeather = Awaited<ReturnType<typeof WeatherCacheService.getLatest>>;
type WeatherPalette = ThemeColors;

const FORECAST_DAYS = 14;

const SYMBOL_ICONS: Record<WeatherSymbol, LucideIcon> = {
  clear: SunMedium,
  'partly-cloudy': CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: Zap,
  unknown: Cloud,
};

export default function WeatherTool() {
  const [weather, setWeather] = React.useState<CachedWeather>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const theme = useThemeStore((state) => state.effectiveTheme);
  const reduceModeEnabled = useBatteryReduceMode();
  const palette = useThemeStore((state) => state.colors);

  React.useEffect(() => {
    let active = true;
    void WeatherCacheService.getLatestOrRefresh().then((next) => {
      if (active) setWeather(next);
    });
    const interval = setInterval(
      () => {
        void WeatherCacheService.refreshIfStale().then((result) => {
          if (active && result.forecast) setWeather(result.forecast);
        });
      },
      BATTERY_POLL_INTERVALS_MS.weatherRefresh[reduceModeEnabled ? 'reduced' : 'normal']
    );
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [reduceModeEnabled]);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      setWeather(await WeatherCacheService.refresh());
    } catch {
      setMessage('Refresh needs internet. The last cached forecast remains available offline.');
      setWeather(await WeatherCacheService.getLatest());
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={busy}
          onRefresh={refresh}
          tintColor={palette.primary}
          colors={[palette.primary]}
        />
      }>
      {message ? (
        <Card className="border-destructive/40 bg-destructive/10">
          <Text className="text-destructive">{message}</Text>
        </Card>
      ) : null}

      {weather ? (
        <>
          <CurrentConditionsCard weather={weather} palette={palette} />
          <NearTermStrip hours={weather.forecast.hourly} ageHours={weather.ageHours} />
          <ForecastChart days={weather.forecast.daily.slice(0, FORECAST_DAYS)} palette={palette} />
          <DailyForecastList
            days={weather.forecast.daily.slice(0, FORECAST_DAYS)}
            ageHours={weather.ageHours}
          />
          <Text variant="muted">
            Confidence is Ark&apos;s field estimate from lead time and cache age, not a provider
            guarantee. Refresh before leaving service.
          </Text>
        </>
      ) : (
        <Card className="gap-2">
          <Text variant="large">No cached forecast yet</Text>
          <Text variant="muted">Pull down while online to cache a forecast for offline use.</Text>
          {busy ? <ActivityIndicator /> : null}
        </Card>
      )}
    </Screen>
  );
}

function CurrentConditionsCard({
  weather,
  palette,
}: {
  weather: NonNullable<CachedWeather>;
  palette: WeatherPalette;
}) {
  const forecast = weather.forecast;
  const IconComponent = SYMBOL_ICONS[forecast.conditionSymbol];
  const confidence = adjustedConfidence(forecast.confidencePct, weather.ageHours);

  return (
    <Card className="gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-1">
          <Text variant="muted">{weather.location}</Text>
          <Text variant="large">{forecast.conditionLabel}</Text>
          <Text variant="muted">
            Cached {weather.freshness}
            {weather.stale ? ', stale but offline-ready' : ''}
          </Text>
        </View>
        <ConfidencePill value={confidence} />
      </View>

      <View className="flex-row items-center gap-4">
        <View className="border-border bg-muted h-20 w-20 items-center justify-center rounded-lg border">
          <Icon as={IconComponent} className="text-primary size-10" strokeWidth={1.7} />
        </View>
        <View className="flex-1">
          <Text variant="h1">{formatNumber(forecast.temperatureC, 'C')}</Text>
          <Text variant="muted">
            Feels {formatNumber(forecast.apparentTemperatureC, 'C')} ·{' '}
            {formatNumber(forecast.cloudCoverPct, '%')} cloud
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <MetricChip
          icon={Droplets}
          label="Humidity"
          value={formatNumber(forecast.humidityPct, '%')}
        />
        <MetricChip icon={Wind} label="Wind" value={formatNumber(forecast.windKph, 'km/h')} />
        <MetricChip
          icon={Gauge}
          label="Pressure"
          value={formatNumber(forecast.pressureHpa, 'hPa')}
        />
        <MetricChip
          icon={Umbrella}
          label="Rain now"
          value={formatNumber(forecast.precipitationMm, 'mm')}
        />
      </View>
    </Card>
  );
}

function NearTermStrip({ hours, ageHours }: { hours: CachedForecastHour[]; ageHours: number }) {
  const samples = hours.filter((hour) => new Date(hour.time).getTime() >= Date.now()).slice(0, 24);
  if (samples.length === 0) return null;

  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Text variant="large">Next 24 hours</Text>
        <Text variant="muted">{ageHours > 24 ? 'aged cache' : 'fresh cache'}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
        {samples.map((hour) => {
          const IconComponent = SYMBOL_ICONS[hour.symbol];
          return (
            <View
              key={hour.time}
              className="border-border bg-muted/50 w-[76px] items-center gap-1 rounded-xl border p-2">
              <Text variant="small">{formatHour(hour.time)}</Text>
              <Icon as={IconComponent} className="text-primary size-5" />
              <Text>{formatNumber(hour.temperatureC, 'C')}</Text>
              <Text variant="muted">
                {formatNumber(hour.precipitationProbabilityPct, '%')} rain
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </Card>
  );
}

function ForecastChart({ days, palette }: { days: CachedForecastDay[]; palette: WeatherPalette }) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(300, Math.min(width - 56, 560));
  const chartHeight = 176;
  const temps = days.flatMap((day) => [day.lowC, day.highC]).filter(isFiniteNumber);

  if (days.length < 2 || temps.length === 0) return null;

  const minTemp = Math.floor(Math.min(...temps) - 2);
  const maxTemp = Math.ceil(Math.max(...temps) + 2);
  const maxRain = Math.max(6, ...days.map((day) => day.precipitationMm ?? 0));
  const left = 24;
  const right = chartWidth - 16;
  const top = 18;
  const tempBottom = 112;
  const rainTop = 126;
  const rainHeight = 34;
  const step = (right - left) / Math.max(1, days.length - 1);
  const xFor = (index: number) => left + index * step;
  const yForTemp = (temp: number) =>
    tempBottom - ((temp - minTemp) / Math.max(1, maxTemp - minTemp)) * (tempBottom - top);
  const highs = days
    .map((day, index) => (day.highC === null ? null : `${xFor(index)},${yForTemp(day.highC)}`))
    .filter(Boolean)
    .join(' ');
  const lows = days
    .map((day, index) => (day.lowC === null ? null : `${xFor(index)},${yForTemp(day.lowC)}`))
    .filter(Boolean)
    .join(' ');
  const barWidth = Math.max(5, Math.min(14, step * 0.42));

  return (
    <Card className="gap-3">
      <View className="flex-row flex-wrap items-start justify-between gap-2">
        <View className="min-w-0 flex-1">
          <Text variant="large">14-day trend from today</Text>
          <Text variant="muted">Temperature lines with daily rain totals below.</Text>
        </View>
        <View className="flex-row items-center gap-3 pt-1">
          <LegendDot color={palette.primary} label="High" />
          <LegendDot color={palette.mutedForeground} label="Low" />
          <LegendDot color={palette.primary} label="Rain" muted />
        </View>
      </View>
      <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
        {[top, (top + tempBottom) / 2, tempBottom].map((y) => (
          <Line
            key={y}
            x1={left}
            x2={right}
            y1={y}
            y2={y}
            stroke={palette.border}
            strokeWidth={1}
          />
        ))}
        {days.map((day, index) => {
          const rain = day.precipitationMm ?? 0;
          const height = (rain / maxRain) * rainHeight;
          return (
            <Rect
              key={day.date}
              x={xFor(index) - barWidth / 2}
              y={rainTop + rainHeight - height}
              width={barWidth}
              height={height}
              rx={barWidth / 2}
              fill={palette.primary}
              opacity={0.35}
            />
          );
        })}
        <Polyline points={highs} fill="none" stroke={palette.primary} strokeWidth={2.5} />
        <Polyline points={lows} fill="none" stroke={palette.mutedForeground} strokeWidth={2} />
        {days.map((day, index) =>
          day.highC === null ? null : (
            <Circle
              key={`${day.date}-high`}
              cx={xFor(index)}
              cy={yForTemp(day.highC)}
              r={2.6}
              fill={palette.primary}
            />
          )
        )}
        <Line
          x1={left}
          x2={right}
          y1={rainTop + rainHeight}
          y2={rainTop + rainHeight}
          stroke={palette.border}
          strokeWidth={1}
        />
      </Svg>
      <View className="flex-row justify-between">
        <Text variant="muted">Today, {formatDate(days[0]?.date)}</Text>
        <Text variant="muted">{formatDate(days[days.length - 1]?.date)}</Text>
      </View>
    </Card>
  );
}

function DailyForecastList({ days, ageHours }: { days: CachedForecastDay[]; ageHours: number }) {
  return (
    <Card className="gap-1">
      <View className="mb-2 flex-row items-center justify-between">
        <Text variant="large">Daily forecast</Text>
        <Text variant="muted">{days.length} days cached</Text>
      </View>
      {days.map((day, index) => {
        const IconComponent = SYMBOL_ICONS[day.symbol];
        const confidence = adjustedConfidence(day.confidencePct, ageHours);
        return (
          <View
            key={day.date}
            className={`border-border flex-row items-center gap-3 py-3 ${
              index === 0 ? '' : 'border-t'
            }`}>
            <View className="w-[76px]">
              <Text variant="small">{formatDay(day.date)}</Text>
              <Text variant="muted">{formatDate(day.date)}</Text>
            </View>
            <Icon as={IconComponent} className="text-primary size-6" strokeWidth={1.8} />
            <View className="min-w-0 flex-1">
              <Text numberOfLines={1}>{day.label}</Text>
              <Text variant="muted">
                {formatNumber(day.lowC, 'C')} / {formatNumber(day.highC, 'C')} ·{' '}
                {formatNumber(day.windKph, 'km/h')} wind
              </Text>
            </View>
            <View className="items-end gap-1">
              <Text variant="small">{formatNumber(day.precipitationProbabilityPct, '%')} rain</Text>
              <Text variant="muted">{formatNumber(day.precipitationMm, 'mm')}</Text>
              <ConfidencePill value={confidence} compact />
            </View>
          </View>
        );
      })}
    </Card>
  );
}

function MetricChip({ icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <View className="border-border bg-muted/50 min-w-[47%] flex-1 flex-row items-center gap-2 rounded-xl border p-3">
      <Icon as={icon} className="text-primary size-4" />
      <View>
        <Text variant="muted">{label}</Text>
        <Text variant="small">{value}</Text>
      </View>
    </View>
  );
}

function ConfidencePill({ value, compact = false }: { value: number; compact?: boolean }) {
  return (
    <View
      className={
        compact
          ? 'bg-muted rounded-full px-2 py-1'
          : 'border-border bg-muted rounded-full border px-3 py-1.5'
      }>
      <Text variant="small">{Math.round(value)}% sure</Text>
    </View>
  );
}

function LegendDot({
  color,
  label,
  muted = false,
}: {
  color: string;
  label: string;
  muted?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-1">
      <View
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: color, opacity: muted ? 0.35 : 1 }}
      />
      <Text variant="muted">{label}</Text>
    </View>
  );
}

function adjustedConfidence(value: number, ageHours: number) {
  const penalty = Math.max(0, Math.floor(ageHours / 12) * 3);
  return Math.max(20, Math.min(95, value - penalty));
}

function formatNumber(value: number | null, unit: string) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  return `${Math.round(value)}${unit === '%' ? '%' : ` ${unit}`}`;
}

function formatDay(date: string | undefined) {
  if (!date) return '--';
  return format(new Date(`${date}T00:00:00`), 'EEE');
}

function formatDate(date: string | undefined) {
  if (!date) return '--';
  return format(new Date(`${date}T00:00:00`), 'MMM d');
}

function formatHour(time: string) {
  return format(new Date(time), 'HH:mm');
}

function isFiniteNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
