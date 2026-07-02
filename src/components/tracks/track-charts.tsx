import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatSpeed,
} from '@/services/tracks/track-format';
import { useThemeStore } from '@/stores/theme-store';
import type { TrackChartPoint, TrackInterval, UnitSystem } from '@/types/tracks';
import { CartesianChart, Line } from 'victory-native';
import * as React from 'react';
import { View } from 'react-native';

type ChartDatum = {
  x: number;
  y: number;
};

export function TrackMetricChart({
  title,
  subtitle,
  data,
  color,
  emptyLabel = 'Not enough samples yet.',
}: {
  title: string;
  subtitle?: string;
  data: TrackChartPoint[];
  color?: string;
  emptyLabel?: string;
}) {
  const colors = useThemeStore((state) => state.colors);
  const chartData = React.useMemo(
    () =>
      data
        .map((point) => ({ x: point.x, y: point.y }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    [data]
  );
  const stroke = color ?? colors.chart1;
  return (
    <Card className="gap-3 p-3">
      <View className="gap-1">
        <Text className="font-semibold">{title}</Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>
      {chartData.length >= 2 ? (
        <View className="h-44 overflow-hidden rounded-md" style={{ backgroundColor: colors.muted }}>
          <CartesianChart
            data={chartData}
            xKey="x"
            yKeys={['y']}
            padding={{ left: 10, right: 12, top: 16, bottom: 16 }}
            domainPadding={{ left: 4, right: 4, top: 8, bottom: 8 }}
            frame={{
              lineColor: colors.border,
              lineWidth: 1,
            }}>
            {({ points }) => (
              <Line
                points={points.y}
                color={stroke}
                strokeWidth={3}
                strokeCap="round"
                strokeJoin="round"
                curveType="natural"
              />
            )}
          </CartesianChart>
        </View>
      ) : (
        <View className="bg-muted h-28 items-center justify-center rounded-md px-4">
          <Text variant="muted" className="text-center">
            {emptyLabel}
          </Text>
        </View>
      )}
    </Card>
  );
}

export function TrackElevationChart({
  data,
  unitSystem,
}: {
  data: TrackChartPoint[];
  unitSystem: UnitSystem;
}) {
  const last = data.at(-1)?.y ?? 0;
  return (
    <TrackMetricChart
      title="Elevation"
      subtitle={`Last sample ${formatElevation(last, unitSystem)}`}
      data={data}
    />
  );
}

export function TrackSpeedChart({
  data,
  unitSystem,
  title = 'Speed',
}: {
  data: TrackChartPoint[];
  unitSystem: UnitSystem;
  title?: string;
}) {
  const colors = useThemeStore((state) => state.colors);
  const max = data.reduce((value, point) => Math.max(value, point.y), 0);
  return (
    <TrackMetricChart
      title={title}
      subtitle={`Peak ${formatSpeed(max, unitSystem)}`}
      data={data}
      color={colors.chart5}
    />
  );
}

export function TrackIntervalsChart({
  intervals,
  unitSystem,
}: {
  intervals: TrackInterval[];
  unitSystem: UnitSystem;
}) {
  const colors = useThemeStore((state) => state.colors);
  const data = intervals.map((interval) => ({
    x: interval.index + 1,
    y: interval.averageSpeedMps ?? 0,
  }));
  return (
    <TrackMetricChart
      title="Intervals"
      subtitle={`${intervals.length} split${intervals.length === 1 ? '' : 's'} · ${formatDistance(
        intervals.reduce((sum, interval) => sum + interval.distanceMeters, 0),
        unitSystem
      )} · ${formatDuration(
        intervals.reduce((sum, interval) => sum + interval.elapsedSeconds, 0),
        { compact: true }
      )}`}
      data={data}
      color={colors.chart4}
    />
  );
}
