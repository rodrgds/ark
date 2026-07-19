import { Screen } from '@/components/layout/screen';
import { TrackRouteSparkline } from '@/components/tracks/track-route-sparkline';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { TracksRepository } from '@/services/db/repositories/tracks.repo';
import {
  PreferencesService,
  type FieldPreferences,
} from '@/services/preferences/preferences.service';
import { TrackExportService } from '@/services/tracks/track-export.service';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatRate,
} from '@/services/tracks/track-format';
import {
  buildChartSeries,
  buildDistanceIntervals,
  buildTimeIntervals,
  routeCoordinates,
} from '@/services/tracks/track-statistics';
import type { Track, TrackInterval, TrackMarker, TrackPoint } from '@/types/tracks';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Camera, Map, Pencil, Share2 } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';

type DetailTab = 'summary' | 'map' | 'charts' | 'intervals' | 'markers';
type TrackChartsModule = typeof import('@/components/tracks/track-charts');

export default function TrackDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const trackId = Array.isArray(id) ? id[0] : id;
  const [track, setTrack] = React.useState<Track | null>(null);
  const [points, setPoints] = React.useState<TrackPoint[]>([]);
  const [markers, setMarkers] = React.useState<TrackMarker[]>([]);
  const [preferences, setPreferences] = React.useState<FieldPreferences | null>(null);
  const [tab, setTab] = React.useState<DetailTab>('summary');
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!trackId) return;
    const [nextTrack, nextPoints, nextMarkers, fieldPreferences] = await Promise.all([
      TracksRepository.getTrack(trackId),
      TracksRepository.listPoints(trackId),
      TracksRepository.listMarkers(trackId),
      PreferencesService.getFieldPreferences(),
    ]);
    setTrack(nextTrack);
    setPoints(nextPoints);
    setMarkers(nextMarkers);
    setPreferences(fieldPreferences);
    if (nextTrack) {
      setTitle(nextTrack.title);
      setDescription(nextTrack.description ?? '');
    }
  }, [trackId]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  const unitSystem = preferences?.unitSystem ?? 'metric';
  const rateMode = preferences?.rateMode ?? 'activity';
  const route = React.useMemo(() => routeCoordinates(points), [points]);
  const chartSeries = React.useMemo(() => buildChartSeries(points), [points]);
  const distanceIntervalMeters =
    unitSystem === 'metric' ? 1000 : unitSystem === 'nautical' ? 1852 : 1609.344;
  const distanceIntervals = React.useMemo(
    () => buildDistanceIntervals(points, distanceIntervalMeters),
    [points, distanceIntervalMeters]
  );
  const timeIntervals = React.useMemo(() => buildTimeIntervals(points, 5 * 60), [points]);
  const charts = useTrackCharts(tab === 'charts' || tab === 'intervals');

  async function renameTrack() {
    if (!track) return;
    setBusy('rename');
    try {
      await TracksRepository.renameTrack(track.id, title, description);
      setRenameOpen(false);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function exportGpx() {
    if (!track) return;
    setBusy('export');
    setMessage(null);
    try {
      const result = await TrackExportService.shareGpx(track.id);
      setMessage(`GPX saved: ${result.fileName}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to export GPX.');
    } finally {
      setBusy(null);
    }
  }

  if (!track) {
    return (
      <Screen>
        <Card className="items-center gap-3 p-6">
          <ActivityIndicator />
          <Text variant="muted">Loading track...</Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card className="gap-4">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="h3" numberOfLines={2}>
              {track.title}
            </Text>
            <Text variant="muted">
              {new Date(track.startedAt).toLocaleString()} · {track.activityType}
            </Text>
          </View>
          <Button
            accessibilityLabel="Rename track"
            size="icon"
            variant="outline"
            onPress={() => setRenameOpen(true)}>
            <Icon as={Pencil} className="size-4" />
          </Button>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Button
            className="min-w-28 flex-1"
            variant="outline"
            onPress={() =>
              router.push({ pathname: '/(tabs)/map', params: { trackId: track.id } } as never)
            }>
            <Icon as={Map} className="size-4" />
            <Text>Open in Map</Text>
          </Button>
          <Button
            className="min-w-28 flex-1"
            variant="outline"
            disabled={busy === 'export'}
            onPress={() => void exportGpx()}>
            {busy === 'export' ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon as={Share2} className="size-4" />
            )}
            <Text>GPX</Text>
          </Button>
        </View>
        {message ? <Text variant="muted">{message}</Text> : null}
      </Card>

      <View className="flex-row flex-wrap gap-2">
        {(['summary', 'map', 'charts', 'intervals', 'markers'] as DetailTab[]).map((item) => (
          <Button
            key={item}
            className="min-w-24 flex-1"
            size="sm"
            variant={tab === item ? 'default' : 'outline'}
            onPress={() => setTab(item)}>
            <Text className="capitalize">{item}</Text>
          </Button>
        ))}
      </View>

      {tab === 'summary' ? (
        <SummaryTab track={track} unitSystem={unitSystem} rateMode={rateMode} />
      ) : null}

      {tab === 'map' ? (
        <Card className="gap-3">
          <TrackRouteSparkline coordinates={route} height={220} />
          <Text variant="muted">
            {route.length} GPS point{route.length === 1 ? '' : 's'} · Open in Map for offline
            regions, saved spots, and navigation context.
          </Text>
        </Card>
      ) : null}

      {tab === 'charts' ? (
        charts.module ? (
          <ChartsTab
            charts={charts.module}
            chartSeries={chartSeries}
            track={track}
            unitSystem={unitSystem}
          />
        ) : (
          <Card className="items-center gap-2 p-5">
            <ActivityIndicator />
            <Text variant="muted" className="text-center">
              {charts.error ?? 'Preparing charts...'}
            </Text>
          </Card>
        )
      ) : null}

      {tab === 'intervals' ? (
        <IntervalsTab
          charts={charts.module}
          distanceIntervals={distanceIntervals}
          timeIntervals={timeIntervals}
          unitSystem={unitSystem}
          rateMode={rateMode}
          track={track}
        />
      ) : null}

      {tab === 'markers' ? <MarkersTab markers={markers} unitSystem={unitSystem} /> : null}

      <ArkBottomSheet
        visible={renameOpen}
        onDismiss={() => setRenameOpen(false)}
        title="Track details"
        description="Rename this recording or add a short note."
        scrollable>
        <Text variant="small">Track name</Text>
        <Input value={title} onChangeText={setTitle} />
        <Text variant="small">Description</Text>
        <Input value={description} onChangeText={setDescription} />
        <Button disabled={busy === 'rename'} onPress={() => void renameTrack()}>
          {busy === 'rename' ? <ActivityIndicator size="small" /> : null}
          <Text>Save</Text>
        </Button>
      </ArkBottomSheet>
    </Screen>
  );
}

function useTrackCharts(enabled: boolean) {
  const [module, setModule] = React.useState<TrackChartsModule | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled || module) return;
    let cancelled = false;
    void import('@/components/tracks/track-charts')
      .then((nextModule) => {
        if (!cancelled) {
          setModule(nextModule);
          setError(null);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Charts are unavailable.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, module]);

  return { module, error };
}

function ChartsTab({
  charts,
  chartSeries,
  track,
  unitSystem,
}: {
  charts: TrackChartsModule;
  chartSeries: ReturnType<typeof buildChartSeries>;
  track: Track;
  unitSystem: FieldPreferences['unitSystem'];
}) {
  const { TrackElevationChart, TrackIntervalsChart, TrackMetricChart, TrackSpeedChart } = charts;
  return (
    <>
      <TrackElevationChart data={chartSeries.distanceElevation} unitSystem={unitSystem} />
      <TrackSpeedChart data={chartSeries.distanceSpeed} unitSystem={unitSystem} />
      <TrackSpeedChart
        title="Speed over time"
        data={chartSeries.timeSpeed}
        unitSystem={unitSystem}
      />
      <TrackMetricChart
        title="Elevation gain"
        subtitle={formatElevation(track.elevationGainMeters, unitSystem)}
        data={chartSeries.distanceGain}
      />
      <TrackMetricChart
        title="GPS accuracy"
        subtitle="Lower is better"
        data={chartSeries.distanceAccuracy}
        emptyLabel="Accuracy data is not available for this track yet."
      />
    </>
  );
}

function SummaryTab({
  track,
  unitSystem,
  rateMode,
}: {
  track: Track;
  unitSystem: FieldPreferences['unitSystem'];
  rateMode: FieldPreferences['rateMode'];
}) {
  return (
    <Card className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        <Metric label="Distance" value={formatDistance(track.distanceMeters, unitSystem)} />
        <Metric label="Total time" value={formatDuration(track.totalTimeSeconds)} />
        <Metric label="Moving" value={formatDuration(track.movingTimeSeconds)} />
        <Metric
          label="Average"
          value={formatRate({
            metersPerSecond: track.averageMovingSpeedMps,
            unitSystem,
            activityType: track.activityType,
            rateMode,
          })}
        />
        <Metric
          label="Max speed"
          value={formatRate({
            metersPerSecond: track.maxSpeedMps,
            unitSystem,
            activityType: track.activityType,
            rateMode: 'speed',
          })}
        />
        <Metric
          label="Elevation gain"
          value={formatElevation(track.elevationGainMeters, unitSystem)}
        />
        <Metric
          label="Elevation loss"
          value={formatElevation(track.elevationLossMeters, unitSystem)}
        />
        <Metric label="Samples" value={String(track.sampleCount)} />
      </View>
      {track.recordingGapCount > 0 ? (
        <Text className="text-destructive">
          {track.recordingGapCount} recording gap{track.recordingGapCount === 1 ? '' : 's'}{' '}
          detected.
        </Text>
      ) : null}
    </Card>
  );
}

function IntervalsTab({
  charts,
  distanceIntervals,
  timeIntervals,
  unitSystem,
  rateMode,
  track,
}: {
  charts: TrackChartsModule | null;
  distanceIntervals: TrackInterval[];
  timeIntervals: TrackInterval[];
  unitSystem: FieldPreferences['unitSystem'];
  rateMode: FieldPreferences['rateMode'];
  track: Track;
}) {
  const TrackIntervalsChart = charts?.TrackIntervalsChart;
  return (
    <>
      {TrackIntervalsChart ? (
        <TrackIntervalsChart intervals={distanceIntervals} unitSystem={unitSystem} />
      ) : null}
      <IntervalList
        title="Distance splits"
        intervals={distanceIntervals}
        unitSystem={unitSystem}
        rateMode={rateMode}
        track={track}
      />
      <IntervalList
        title="Time splits"
        intervals={timeIntervals}
        unitSystem={unitSystem}
        rateMode={rateMode}
        track={track}
      />
    </>
  );
}

function IntervalList({
  title,
  intervals,
  unitSystem,
  rateMode,
  track,
}: {
  title: string;
  intervals: TrackInterval[];
  unitSystem: FieldPreferences['unitSystem'];
  rateMode: FieldPreferences['rateMode'];
  track: Track;
}) {
  return (
    <Card className="gap-2">
      <Text variant="large">{title}</Text>
      {intervals.length ? (
        intervals.map((interval) => (
          <View
            key={`${title}-${interval.index}`}
            className="border-border flex-row items-center justify-between gap-3 border-b py-2 last:border-b-0">
            <View className="min-w-0 flex-1">
              <Text className="font-semibold">Split {interval.label}</Text>
              <Text variant="muted">
                {formatDistance(interval.distanceMeters, unitSystem)} ·{' '}
                {formatDuration(interval.elapsedSeconds, { compact: true })}
              </Text>
            </View>
            <Text className="font-semibold">
              {formatRate({
                metersPerSecond: interval.averageSpeedMps,
                unitSystem,
                activityType: track.activityType,
                rateMode,
              })}
            </Text>
          </View>
        ))
      ) : (
        <Text variant="muted">Not enough samples for intervals yet.</Text>
      )}
    </Card>
  );
}

function MarkersTab({
  markers,
  unitSystem,
}: {
  markers: TrackMarker[];
  unitSystem: FieldPreferences['unitSystem'];
}) {
  return (
    <Card className="gap-2">
      <Text variant="large">Markers</Text>
      {markers.length ? (
        markers.map((marker) => (
          <Pressable
            key={marker.id}
            className="border-border flex-row items-center gap-3 border-b py-3 last:border-b-0"
            onPress={() =>
              router.push({
                pathname: '/(tabs)/map',
                params: { markerId: marker.mapMarkerId ?? '', trackId: marker.trackId },
              } as never)
            }>
            {marker.photoUri ? (
              <Image source={{ uri: marker.photoUri }} className="bg-muted size-12 rounded-md" />
            ) : (
              <View className="bg-primary/15 size-12 items-center justify-center rounded-md">
                <Icon
                  as={marker.markerType === 'photo' ? Camera : Map}
                  className="text-primary size-5"
                />
              </View>
            )}
            <View className="min-w-0 flex-1">
              <Text className="font-semibold" numberOfLines={1}>
                {marker.title}
              </Text>
              <Text variant="muted" numberOfLines={1}>
                {formatDistance(marker.distanceMeters, unitSystem)} ·{' '}
                {formatDuration(marker.elapsedSeconds, { compact: true })}
              </Text>
            </View>
          </Pressable>
        ))
      ) : (
        <Text variant="muted">No markers were saved on this track.</Text>
      )}
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-muted min-w-32 flex-1 rounded-md px-3 py-2">
      <Text variant="small" className="text-muted-foreground">
        {label}
      </Text>
      <Text className="font-semibold" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
