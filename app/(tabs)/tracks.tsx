import { Screen } from '@/components/layout/screen';
import { TrackRouteSparkline } from '@/components/tracks/track-route-sparkline';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { TRACK_ACTIVITIES, TRACK_MARKER_TYPES } from '@/constants/tracks';
import { TracksRepository } from '@/services/db/repositories/tracks.repo';
import { TrackRecordingService } from '@/services/tracks/track-recording.service';
import {
  formatDistance,
  formatDuration,
  formatElevation,
  formatRate,
} from '@/services/tracks/track-format';
import { routeCoordinates } from '@/services/tracks/track-statistics';
import {
  PreferencesService,
  type FieldPreferences,
} from '@/services/preferences/preferences.service';
import { useTrackStore } from '@/stores/track-store';
import type { Track, TrackActivityType, TrackMarkerType, TrackPoint } from '@/types/tracks';
import { router, useFocusEffect } from 'expo-router';
import {
  Camera,
  Check,
  MapPinned,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

export default function TracksScreen() {
  const activeTrack = useTrackStore((state) => state.activeTrack);
  const lastPoint = useTrackStore((state) => state.lastPoint);
  const trackError = useTrackStore((state) => state.error);
  const trackLoading = useTrackStore((state) => state.loading);
  const backgroundPermissionGranted = useTrackStore((state) => state.backgroundPermissionGranted);
  const refreshActive = useTrackStore((state) => state.refresh);
  const startTrack = useTrackStore((state) => state.start);
  const pauseTrack = useTrackStore((state) => state.pause);
  const resumeTrack = useTrackStore((state) => state.resume);
  const finishTrack = useTrackStore((state) => state.finish);
  const discardTrack = useTrackStore((state) => state.discard);
  const [tracks, setTracks] = React.useState<Track[]>([]);
  const [activePoints, setActivePoints] = React.useState<TrackPoint[]>([]);
  const [preferences, setPreferences] = React.useState<FieldPreferences | null>(null);
  const [selectedActivity, setSelectedActivity] = React.useState<TrackActivityType>('hike');
  const [query, setQuery] = React.useState('');
  const [startSheetOpen, setStartSheetOpen] = React.useState(false);
  const [actionsSheetOpen, setActionsSheetOpen] = React.useState(false);
  const [markerSheetOpen, setMarkerSheetOpen] = React.useState(false);
  const [markerTitle, setMarkerTitle] = React.useState('');
  const [markerDescription, setMarkerDescription] = React.useState('');
  const [markerType, setMarkerType] = React.useState<TrackMarkerType>('interesting');
  const [saveMarkerToMap, setSaveMarkerToMap] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [clockNow, setClockNow] = React.useState(() => Date.now());

  const route = React.useMemo(() => routeCoordinates(activePoints), [activePoints]);
  const unitSystem = preferences?.unitSystem ?? 'metric';
  const rateMode = preferences?.rateMode ?? 'activity';
  const filteredTracks = React.useMemo(() => filterTracks(tracks, query), [tracks, query]);

  const load = React.useCallback(async () => {
    const [fieldPreferences, recentTracks] = await Promise.all([
      PreferencesService.getFieldPreferences(),
      TracksRepository.listTracks(24),
      refreshActive(),
    ]).then(async ([fieldPreferences, recentTracks]) => {
      const active = useTrackStore.getState().activeTrack;
      const points = active ? await TracksRepository.listPoints(active.id) : [];
      setActivePoints(points);
      return [fieldPreferences, recentTracks] as const;
    });
    setPreferences(fieldPreferences);
    setSelectedActivity((current) => current || fieldPreferences.defaultTrackActivity);
    setTracks(recentTracks);
  }, [refreshActive]);

  React.useEffect(() => {
    void load();
    return PreferencesService.subscribeFieldPreferences((next) => {
      setPreferences(next);
      setSelectedActivity((current) => current || next.defaultTrackActivity);
    });
  }, [load]);

  useFocusEffect(
    React.useCallback(() => {
      void load();
    }, [load])
  );

  React.useEffect(() => {
    if (!activeTrack) return;
    const interval = setInterval(
      () => {
        void refreshActive().catch(() => undefined);
      },
      activeTrack.status === 'recording' ? 3000 : 9000
    );
    return () => clearInterval(interval);
  }, [activeTrack, refreshActive]);

  React.useEffect(() => {
    if (!activeTrack) {
      setActivePoints([]);
      return;
    }
    void TracksRepository.listPoints(activeTrack.id)
      .then(setActivePoints)
      .catch(() => undefined);
  }, [activeTrack?.id, activeTrack?.updatedAt, lastPoint?.id]);

  React.useEffect(() => {
    if (activeTrack?.status !== 'recording') return;
    setClockNow(Date.now());
    const interval = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeTrack?.status, activeTrack?.id]);

  async function start() {
    setBusy('start');
    setMessage(null);
    try {
      await startTrack({ activityType: selectedActivity });
      setStartSheetOpen(false);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function runAction(action: 'pause' | 'resume' | 'finish' | 'discard') {
    setBusy(action);
    setMessage(null);
    try {
      if (action === 'pause') await pauseTrack();
      if (action === 'resume') await resumeTrack();
      if (action === 'finish') await finishTrack();
      if (action === 'discard') await discardTrack();
      if (action === 'finish' || action === 'discard') setActionsSheetOpen(false);
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function addPhotoMarker() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage('Camera permission is required before Ark can attach a track photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.78 });
    if (result.canceled || !result.assets[0]) return;
    setBusy('photo');
    try {
      const photoUri = await TrackRecordingService.copyTrackPhoto(result.assets[0].uri);
      await TrackRecordingService.addMarker({
        title: 'Photo marker',
        markerType: 'photo',
        photoUri,
        saveToMap: saveMarkerToMap,
      });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this photo marker.');
    } finally {
      setBusy(null);
    }
  }

  async function saveMarker() {
    setBusy('marker');
    setMessage(null);
    try {
      await TrackRecordingService.addMarker({
        title: markerTitle,
        description: markerDescription,
        markerType,
        saveToMap: saveMarkerToMap,
      });
      setMarkerSheetOpen(false);
      setMarkerTitle('');
      setMarkerDescription('');
      setMarkerType('interesting');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save this marker.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <View className="flex-row items-center gap-3">
        <View className="border-border min-w-0 flex-1 flex-row items-center border-b px-1">
          <Icon as={Search} className="text-muted-foreground size-4" />
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder="Search tracks"
            returnKeyType="search"
            accessibilityLabel="Search tracks"
            className="min-h-11 flex-1 border-0 bg-transparent px-3 py-2"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear tracks search"
              className="active:bg-accent size-9 items-center justify-center rounded-md"
              onPress={() => setQuery('')}>
              <Icon as={X} className="text-muted-foreground size-4" />
            </Pressable>
          ) : null}
        </View>
        <Button
          size="sm"
          variant="secondary"
          disabled={Boolean(activeTrack)}
          onPress={() => setStartSheetOpen(true)}>
          <Icon as={Plus} className="size-4" />
          <Text>New</Text>
        </Button>
      </View>

      {activeTrack ? (
        <ActiveTrackCard
          track={activeTrack}
          route={route}
          unitSystem={unitSystem}
          rateMode={rateMode}
          lastPoint={lastPoint}
          now={clockNow}
          busy={busy}
          onPause={() => void runAction('pause')}
          onResume={() => void runAction('resume')}
          onFinish={() => void runAction('finish')}
          onMore={() => setActionsSheetOpen(true)}
        />
      ) : null}

      {message || trackError ? (
        <Card className="border-destructive/70 bg-destructive/10 p-3">
          <Text className="text-destructive">{message ?? trackError}</Text>
        </Card>
      ) : null}

      <View className="gap-2">
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="large">Recordings</Text>
          <Text variant="small" className="text-muted-foreground">
            {filteredTracks.length}
          </Text>
        </View>
        {filteredTracks.length ? (
          filteredTracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              unitSystem={unitSystem}
              rateMode={rateMode}
              onPress={() =>
                router.push({ pathname: '/tracks/[id]', params: { id: track.id } } as never)
              }
            />
          ))
        ) : (
          <Card className="items-center gap-2 p-5">
            <Icon as={MapPinned} className="text-muted-foreground size-6" />
            <Text variant="muted" className="text-center">
              {query
                ? 'No tracks match this search.'
                : 'Finished tracks will appear here with maps, charts, intervals, markers, and GPX export.'}
            </Text>
            {!query && !activeTrack ? (
              <Button
                className="mt-1"
                size="sm"
                variant="secondary"
                onPress={() => setStartSheetOpen(true)}>
                <Icon as={Plus} className="size-4" />
                <Text>New track</Text>
              </Button>
            ) : null}
          </Card>
        )}
      </View>

      <ArkBottomSheet
        visible={startSheetOpen}
        onDismiss={() => setStartSheetOpen(false)}
        title="New track"
        description="Choose an activity, then start recording."
        footer={
          <Button
            size="lg"
            disabled={busy === 'start' || trackLoading}
            onPress={() => void start()}>
            {busy === 'start' || trackLoading ? <ActivityIndicator size="small" /> : null}
            <Text>Start Recording</Text>
          </Button>
        }>
        <ActivitySelector value={selectedActivity} onChange={setSelectedActivity} />
        <View className="flex-row flex-wrap gap-2">
          <StatusPill
            label={backgroundPermissionGranted ? 'Background ready' : 'Foreground only'}
          />
          <StatusPill label={preferences?.recordingProfile ?? 'normal'} />
          <StatusPill label={unitSystem} />
        </View>
      </ArkBottomSheet>

      <ArkBottomSheet
        visible={actionsSheetOpen && Boolean(activeTrack)}
        onDismiss={() => setActionsSheetOpen(false)}
        title="Track actions"
        description={activeTrack?.title}>
        <Button
          variant="outline"
          onPress={() => {
            setActionsSheetOpen(false);
            setMarkerSheetOpen(true);
          }}>
          <Icon as={MapPinned} className="size-4" />
          <Text>Add marker</Text>
        </Button>
        <Button
          variant="outline"
          disabled={busy === 'photo'}
          onPress={() => {
            setActionsSheetOpen(false);
            void addPhotoMarker();
          }}>
          {busy === 'photo' ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon as={Camera} className="size-4" />
          )}
          <Text>Take photo</Text>
        </Button>
        <Button
          variant="destructive"
          disabled={busy === 'discard'}
          onPress={() => void runAction('discard')}>
          {busy === 'discard' ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon as={Trash2} className="size-4" />
          )}
          <Text>Discard track</Text>
        </Button>
      </ArkBottomSheet>

      <ArkBottomSheet
        visible={markerSheetOpen}
        onDismiss={() => setMarkerSheetOpen(false)}
        title="Add marker"
        description="Save the current GPS point on this track."
        scrollable
        footer={
          <Button disabled={busy === 'marker'} onPress={() => void saveMarker()}>
            {busy === 'marker' ? <ActivityIndicator size="small" /> : null}
            <Text>Save Marker</Text>
          </Button>
        }>
        <Text variant="small">Marker name</Text>
        <Input value={markerTitle} onChangeText={setMarkerTitle} />
        <Text variant="small">Note</Text>
        <Input value={markerDescription} onChangeText={setMarkerDescription} />
        <View className="flex-row flex-wrap gap-2">
          {TRACK_MARKER_TYPES.map((type) => (
            <Button
              key={type.id}
              size="sm"
              variant={markerType === type.id ? 'default' : 'outline'}
              onPress={() => setMarkerType(type.id)}>
              <Text>{type.label}</Text>
            </Button>
          ))}
        </View>
        <Button
          variant={saveMarkerToMap ? 'default' : 'outline'}
          onPress={() => setSaveMarkerToMap((value) => !value)}>
          <Text>{saveMarkerToMap ? 'Also saved to map' : 'Track only'}</Text>
        </Button>
      </ArkBottomSheet>
    </Screen>
  );
}

function filterTracks(tracks: Track[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return tracks;
  return tracks.filter((track) =>
    [
      track.title,
      track.description,
      track.activityType,
      track.status,
      new Date(track.startedAt).toLocaleDateString(),
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized))
  );
}

function ActiveTrackCard({
  track,
  route,
  unitSystem,
  rateMode,
  lastPoint,
  now,
  busy,
  onPause,
  onResume,
  onFinish,
  onMore,
}: {
  track: Track;
  route: ReturnType<typeof routeCoordinates>;
  unitSystem: FieldPreferences['unitSystem'];
  rateMode: FieldPreferences['rateMode'];
  lastPoint: TrackPoint | null;
  now: number;
  busy: string | null;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onMore: () => void;
}) {
  const totalTimeSeconds =
    track.status === 'recording'
      ? Math.max(track.totalTimeSeconds, (now - track.startedAt) / 1000)
      : track.totalTimeSeconds;
  const movingTimeSeconds = Math.max(track.movingTimeSeconds, lastPoint?.movingElapsedSeconds ?? 0);
  const rateMps = track.averageMovingSpeedMps ?? track.averageSpeedMps ?? lastPoint?.speedMps;

  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="large" numberOfLines={1}>
            {track.title}
          </Text>
          <Text variant="muted">
            {track.status === 'paused' ? 'Paused' : 'Recording'} ·{' '}
            {formatDuration(totalTimeSeconds)}
          </Text>
        </View>
        <Button
          variant="outline"
          size="sm"
          onPress={() =>
            router.push({ pathname: '/tracks/[id]', params: { id: track.id } } as never)
          }>
          <Text>Details</Text>
        </Button>
      </View>
      <TrackRouteSparkline coordinates={route} height={118} />
      <View className="flex-row flex-wrap gap-2">
        <Metric label="Distance" value={formatDistance(track.distanceMeters, unitSystem)} />
        <Metric label="Moving" value={formatDuration(movingTimeSeconds, { compact: true })} />
        <Metric
          label="Rate"
          value={formatRate({
            metersPerSecond: rateMps,
            unitSystem,
            activityType: track.activityType,
            rateMode,
          })}
        />
        <Metric label="Gain" value={formatElevation(track.elevationGainMeters, unitSystem)} />
      </View>
      {lastPoint?.latitude != null && lastPoint.longitude != null ? (
        <Text variant="muted">
          Last point {lastPoint.latitude.toFixed(5)}, {lastPoint.longitude.toFixed(5)}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {track.status === 'paused' ? (
          <ActionButton icon={Play} label="Resume" busy={busy === 'resume'} onPress={onResume} />
        ) : (
          <ActionButton icon={Pause} label="Pause" busy={busy === 'pause'} onPress={onPause} />
        )}
        <ActionButton icon={Check} label="Finish" busy={busy === 'finish'} onPress={onFinish} />
        <ActionButton icon={MoreHorizontal} label="More" onPress={onMore} />
      </View>
    </Card>
  );
}

function ActivitySelector({
  value,
  onChange,
}: {
  value: TrackActivityType;
  onChange: (value: TrackActivityType) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {TRACK_ACTIVITIES.map((activity) => (
        <Button
          key={activity.id}
          className="min-w-24 flex-1"
          size="sm"
          variant={value === activity.id ? 'default' : 'outline'}
          onPress={() => onChange(activity.id)}>
          <Text>{activity.shortLabel}</Text>
        </Button>
      ))}
    </View>
  );
}

function TrackRow({
  track,
  unitSystem,
  rateMode,
  onPress,
}: {
  track: Track;
  unitSystem: FieldPreferences['unitSystem'];
  rateMode: FieldPreferences['rateMode'];
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <Card className="gap-3 p-3">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-semibold" numberOfLines={1}>
              {track.title}
            </Text>
            <Text variant="muted">
              {new Date(track.startedAt).toLocaleDateString()} · {track.activityType}
            </Text>
          </View>
          <Text className="font-semibold">{formatDistance(track.distanceMeters, unitSystem)}</Text>
        </View>
        <View className="flex-row flex-wrap gap-2">
          <Metric label="Time" value={formatDuration(track.totalTimeSeconds, { compact: true })} />
          <Metric
            label="Avg"
            value={formatRate({
              metersPerSecond: track.averageMovingSpeedMps,
              unitSystem,
              activityType: track.activityType,
              rateMode,
            })}
          />
          <Metric label="Gain" value={formatElevation(track.elevationGainMeters, unitSystem)} />
        </View>
      </Card>
    </Pressable>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="bg-muted min-w-24 flex-1 rounded-md px-3 py-2">
      <Text variant="small" className="text-muted-foreground">
        {label}
      </Text>
      <Text className="font-semibold" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  busy,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  label: string;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Button className="min-w-28 flex-1" variant="outline" onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator size="small" /> : <Icon as={icon} className="size-4" />}
      <Text>{label}</Text>
    </Button>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <View className="border-border bg-card rounded-md border px-3 py-2">
      <Text variant="small" className="text-muted-foreground capitalize">
        {label}
      </Text>
    </View>
  );
}
