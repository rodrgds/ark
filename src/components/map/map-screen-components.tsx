import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { MapPinMarker, UserLocationDot, iconForPinType } from '@/components/map/map-pin';
import {
  formatVisibleBounds,
  getCameraComponent,
  getGeoJSONSourceComponent,
  getLayerComponent,
  getMapComponent,
  getMarkerComponent,
  locationIssueCopy,
  navigationRouteFeatureCollection,
  normalizeBearing,
  normalizeMapEventBounds,
  routeFallbackLabel,
  routeFeatureCollection,
  statusLabel,
  worldOverviewFeatureCollection,
  type LngLat,
  type MapViewBounds,
} from '@/components/map/map-screen-utils';
import type { MapPreset } from '@/constants/map-presets';
import {
  getMapPinMeta,
  MAP_PIN_COLOR_OPTIONS,
  MAP_PIN_TYPES,
  type MapPinType,
} from '@/constants/map-pins';
import { formatPoint } from '@/lib/geo';
import type { MapLibreModule } from '@/services/maps/map.service';
import type { MapLocationIssue } from '@/services/maps/map-location.service';
import {
  getMapPackFormatLabel,
  getUnsupportedMapPackReason,
} from '@/services/maps/map-pack-format';
import { formatMapRegionStorage, routingStatusLabel } from '@/services/maps/map-storage';
import { isPresetDownloaded } from '@/services/maps/map-region-utils';
import { useThemeStore } from '@/stores/theme-store';
import type { MapMarker, MapRegion, NavigationSession, SavedRoute } from '@/types/maps';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  ImageIcon,
  Layers,
  Map as MapIcon,
  MapPin,
  Pencil,
  Route,
  Star,
  Trash2,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

type ManagerTab = 'downloaded' | 'browse';

const WORLD_OVERVIEW_PATHS = [
  'M42 58L72 45L101 53L116 72L107 94L80 100L58 88Z',
  'M118 95L135 105L128 134L113 154L98 132L103 110Z',
  'M151 58L190 43L225 51L243 76L221 92L184 85L157 78Z',
  'M190 91L219 97L229 124L210 152L185 142L172 116Z',
  'M237 64L295 55L329 75L319 101L284 105L252 91Z',
  'M266 126L303 128L321 145L308 160L274 153Z',
];

function eventLngLat(event: any): LngLat | null {
  const lngLat = event?.nativeEvent?.lngLat;
  if (
    Array.isArray(lngLat) &&
    lngLat.length >= 2 &&
    Number.isFinite(lngLat[0]) &&
    Number.isFinite(lngLat[1])
  ) {
    return [lngLat[0], lngLat[1]];
  }
  return null;
}

export function MapCanvas({
  cameraRef,
  canMount,
  center,
  fullscreen,
  hasDownloadedRegion,
  initialZoom,
  isSearchActive,
  mapBearing,
  mapBackgroundColor,
  mapKey,
  mapReady,
  mapStyle,
  maplibre,
  markers,
  navigationSession,
  routes,
  selectedMarker,
  showWorldOverview,
  status,
  suppressLongPressUntilRef,
  userLocation,
  onBearingChange,
  onBoundsChange,
  onCenterChange,
  onZoomChange,
  onCloseMarkerPopup,
  onEditMarker,
  onNavigateToMarker,
  onDismissSearch,
  onLongPress,
  onMapPress,
  onMapLoadFailed,
  onMapReady,
  onMapUnmount,
  onMarkerPress,
}: {
  cameraRef: React.MutableRefObject<any>;
  canMount: boolean;
  center: LngLat;
  fullscreen: boolean;
  hasDownloadedRegion: boolean;
  initialZoom: number;
  isSearchActive: boolean;
  mapBearing: number;
  mapBackgroundColor: string;
  mapKey: string;
  mapReady: boolean;
  mapStyle: unknown;
  maplibre: MapLibreModule | null;
  markers: MapMarker[];
  navigationSession: NavigationSession | null;
  routes: SavedRoute[];
  selectedMarker: MapMarker | null;
  showWorldOverview: boolean;
  status: string;
  suppressLongPressUntilRef: React.MutableRefObject<number>;
  userLocation: { latitude: number; longitude: number } | null;
  onBearingChange: (bearing: number) => void;
  onBoundsChange: (bounds: MapViewBounds | null) => void;
  onCenterChange: (center: LngLat) => void;
  onZoomChange?: (zoom: number) => void;
  onCloseMarkerPopup: () => void;
  onEditMarker: (marker: MapMarker) => void;
  onNavigateToMarker: (marker: MapMarker) => void;
  onDismissSearch: () => void;
  onLongPress: (center: LngLat) => void;
  onMapPress: (center: LngLat) => void;
  onMapLoadFailed: () => void;
  onMapReady: (mapKey: string) => void;
  onMapUnmount: (mapKey: string) => void;
  onMarkerPress: (marker: MapMarker) => void;
}) {
  const colors = useThemeStore((state) => state.colors);
  const Map = getMapComponent(maplibre);
  const Camera = getCameraComponent(maplibre);
  const GeoJSONSource = getGeoJSONSourceComponent(maplibre);
  const Layer = getLayerComponent(maplibre);
  const Marker = getMarkerComponent(maplibre);
  const routeData = React.useMemo(() => routeFeatureCollection(routes), [routes]);
  const navigationRouteData = React.useMemo(
    () => navigationRouteFeatureCollection(navigationSession),
    [navigationSession]
  );
  const overviewData = React.useMemo(() => worldOverviewFeatureCollection(), []);

  React.useEffect(() => () => onMapUnmount(mapKey), [mapKey]);

  if (!Map || !Camera || !canMount) {
    return (
      <View className="flex-1" style={{ backgroundColor: mapBackgroundColor }}>
        <WorldOverviewFallback status={status} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: mapBackgroundColor }}>
      <Map
        key={mapKey}
        androidView="texture"
        style={{ flex: 1, backgroundColor: mapBackgroundColor }}
        mapStyle={mapStyle as never}
        logo={false}
        attribution={false}
        compass={false}
        scaleBar={fullscreen}
        onDidFailLoadingMap={onMapLoadFailed}
        onDidFinishLoadingMap={() => onMapReady(mapKey)}
        onPress={(event: any) => {
          if (isSearchActive) {
            onDismissSearch();
            return;
          }
          Keyboard.dismiss();
          const lngLat = eventLngLat(event);
          if (lngLat) onMapPress(lngLat);
        }}
        onLongPress={(event: any) => {
          if (isSearchActive || Date.now() < suppressLongPressUntilRef.current) {
            onDismissSearch();
            return;
          }
          onLongPress(event.nativeEvent.lngLat);
        }}
        onRegionIsChanging={(event: any) => {
          onBearingChange(event.nativeEvent.bearing ?? 0);
        }}
        onRegionDidChange={(event: any) => {
          onCenterChange(event.nativeEvent.center);
          onBoundsChange(normalizeMapEventBounds(event.nativeEvent.bounds));
          onBearingChange(event.nativeEvent.bearing ?? 0);
          const nextZoom =
            event.nativeEvent.zoom ??
            event.nativeEvent.zoomLevel ??
            event.nativeEvent.properties?.zoomLevel;
          if (nextZoom != null) {
            onZoomChange?.(nextZoom);
          }
        }}>
        <Camera
          ref={cameraRef}
          initialViewState={{
            center,
            zoom: initialZoom,
            bearing: mapBearing,
          }}
        />
        {Marker && userLocation ? (
          <Marker
            key="ark-user-location"
            id="ark-user-location"
            lngLat={[userLocation.longitude, userLocation.latitude]}
            anchor="center">
            <UserLocationDot mapBearing={mapBearing} />
          </Marker>
        ) : null}
        {showWorldOverview && GeoJSONSource && Layer ? (
          <GeoJSONSource id="ark-world-overview" data={overviewData}>
            <Layer
              id="ark-world-land"
              type="fill"
              paint={{
                fillColor: colors.card,
                fillOpacity: 0.72,
              }}
            />
            <Layer
              id="ark-world-coast"
              type="line"
              paint={{
                lineColor: colors.primary,
                lineOpacity: 0.75,
                lineWidth: 1,
              }}
            />
          </GeoJSONSource>
        ) : null}
        {GeoJSONSource && Layer && routes.length ? (
          <GeoJSONSource id="ark-routes" data={routeData}>
            <Layer
              id="ark-routes-halo"
              type="line"
              paint={{
                lineColor: colors.background,
                lineOpacity: 0.9,
                lineWidth: 7,
              }}
              layout={{
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Layer
              id="ark-routes-line"
              type="line"
              paint={{
                lineColor: colors.foreground,
                lineOpacity: 0.72,
                lineWidth: 4,
              }}
              layout={{
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </GeoJSONSource>
        ) : null}
        {GeoJSONSource && Layer && navigationSession ? (
          <GeoJSONSource id="ark-active-navigation-route" data={navigationRouteData}>
            <Layer
              id="ark-active-navigation-route-halo"
              type="line"
              paint={{
                lineColor: colors.background,
                lineOpacity: 0.94,
                lineWidth: 11,
              }}
              layout={{
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Layer
              id="ark-active-navigation-route-line"
              type="line"
              paint={{
                lineColor: colors.foreground,
                lineOpacity: 0.98,
                lineWidth: 6,
              }}
              layout={{
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </GeoJSONSource>
        ) : null}
        {Marker
          ? markers.map((marker) => (
              <Marker
                key={`ark-marker-${marker.id}`}
                id={`ark-marker-${marker.id}`}
                lngLat={[marker.longitude, marker.latitude]}
                anchor="center"
                onPress={() => onMarkerPress(marker)}>
                <MapPinMarker marker={marker} selected={selectedMarker?.id === marker.id} />
              </Marker>
            ))
          : null}
        {Marker && selectedMarker ? (
          <Marker
            key={selectedMarker.id}
            id={`ark-marker-popup-${selectedMarker.id}`}
            lngLat={[selectedMarker.longitude, selectedMarker.latitude]}
            anchor="bottom"
            onPress={onCloseMarkerPopup}
            offset={[0, -14]}>
            <MarkerPopup
              marker={selectedMarker}
              onClose={onCloseMarkerPopup}
              onEdit={() => onEditMarker(selectedMarker)}
              onNavigate={() => onNavigateToMarker(selectedMarker)}
            />
          </Marker>
        ) : null}
      </Map>
      {!mapReady ? (
        <View
          className="absolute inset-0"
          pointerEvents="none"
          style={{ backgroundColor: mapBackgroundColor }}
        />
      ) : null}
    </View>
  );
}

export function LocationNoticeCard({
  issue,
  loading,
  onOpenSettings,
  onRetry,
}: {
  issue: MapLocationIssue;
  loading: boolean;
  onOpenSettings: () => void;
  onRetry: () => void;
}) {
  const copy = locationIssueCopy(issue);

  return (
    <Card className="border-primary/35 bg-background/95 gap-3 p-3">
      <View className="flex-row items-start gap-2">
        <Icon as={MapPin} className="text-primary mt-0.5 size-4" />
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-sm font-semibold">{copy.title}</Text>
          <Text className="text-muted-foreground text-xs">{copy.body}</Text>
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button className="h-9 flex-1" disabled={loading} size="sm" onPress={onRetry}>
          {loading ? <ActivityIndicator size="small" /> : <Icon as={MapPin} className="size-4" />}
          <Text>{copy.retryLabel}</Text>
        </Button>
        {issue.canOpenSettings ? (
          <Button className="h-9 flex-1" size="sm" variant="outline" onPress={onOpenSettings}>
            <Text>Settings</Text>
          </Button>
        ) : null}
      </View>
    </Card>
  );
}

export function MissingRegionPromptModal({
  visible,
  busy,
  region,
  downloadingRegion,
  onDownload,
}: {
  visible: boolean;
  busy: boolean;
  region: MapPreset | null;
  downloadingRegion?: MapRegion | null;
  onDownload: (updatedPreset?: MapPreset) => void;
}) {
  const [dynamicPreset, setDynamicPreset] = React.useState<MapPreset | null>(null);

  React.useEffect(() => {
    if (!visible || !region?.id.startsWith('dynamic-')) {
      setDynamicPreset(null);
      return undefined;
    }
    const { center } = region;
    if (!center) return undefined;

    setDynamicPreset(null);
    const abortController = new AbortController();
    import('@/services/maps/geocoding.service').then(({ GeocodingService }) => {
      GeocodingService.reverseGeocode(center[1], center[0], abortController.signal).then(
        (result) => {
          if (abortController.signal.aborted) return;
          if (result.bounds) {
            setDynamicPreset({
              ...region,
              name: result.name,
              bounds: result.bounds,
              bbox: [
                result.bounds.west,
                result.bounds.south,
                result.bounds.east,
                result.bounds.north,
              ],
              estimatedSizeMb: 450,
              estimatedSize: '450 MB',
            });
          } else {
            setDynamicPreset({ ...region, name: result.name });
          }
        }
      );
    });

    return () => abortController.abort();
  }, [visible, region?.id, region?.center?.[0], region?.center?.[1]]);

  if (!visible || !region) return null;

  const activeRegion = dynamicPreset?.id === region.id ? dynamicPreset : region;
  const size = activeRegion?.estimatedSizeMb
    ? `About ${Math.round(activeRegion.estimatedSizeMb)} MB`
    : activeRegion?.estimatedSize;
  const name = activeRegion?.name || downloadingRegion?.name;
  const preset = activeRegion;
  const routingLabel = downloadingRegion ? routingStatusLabel(downloadingRegion) : null;
  const unsupportedReason = preset ? getUnsupportedMapPackReason(preset) : null;
  const unsupported = Boolean(unsupportedReason);
  const downloaded = downloadingRegion?.status === 'downloaded';
  const updateAvailable = false;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      className="absolute inset-0 items-center justify-center p-4"
      pointerEvents="box-none">
      <View className="w-full max-w-xs" pointerEvents="box-none">
        <Card
          className="border-primary/35 bg-background/95 gap-4 p-5 shadow-2xl"
          pointerEvents="auto">
          <View className="items-center gap-1">
            <Text variant="h3" className="text-center">
              {name}
            </Text>
            {downloadingRegion ? (
              <Text className="text-muted-foreground text-sm font-medium">
                Downloading... {Math.round((downloadingRegion.progress || 0) * 100)}%
                {routingLabel ? ` · ${routingLabel}` : ''}
              </Text>
            ) : (
              <Text className="text-muted-foreground text-sm font-medium">
                {size}
                {preset?.routingPackUrl ? ' + navigation' : ''}
              </Text>
            )}
          </View>
          {downloadingRegion ? (
            <View className="mt-2">
              <Progress value={downloadingRegion.progress || 0} />
            </View>
          ) : (
            <Button
              disabled={(downloaded && !updateAvailable) || busy || unsupported}
              size="default"
              onPress={() => onDownload(activeRegion || undefined)}
              className="mt-2">
              {busy ? (
                <ActivityIndicator size="small" />
              ) : (
                <Icon as={Download} className="size-4" />
              )}
              <Text>{unsupported ? 'Planned' : 'Download Map'}</Text>
            </Button>
          )}
          {unsupportedReason ? (
            <Text variant="small" className="text-muted-foreground text-center">
              {unsupportedReason}
            </Text>
          ) : null}
        </Card>
      </View>
    </Animated.View>
  );
}

export function CompassButton({
  bearing,
  top,
  visible,
  onPress,
}: {
  bearing: number;
  top: number;
  visible: boolean;
  onPress: () => void;
}) {
  const colors = useThemeStore((state) => state.colors);
  const visibility = useSharedValue(0);

  React.useEffect(() => {
    visibility.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 110 : 90,
      easing: Easing.out(Easing.quad),
    });
  }, [visibility, visible]);

  const visibilityStyle = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ scale: 0.94 + visibility.value * 0.06 }],
  }));

  return (
    <Animated.View
      className="absolute right-3"
      pointerEvents={visible ? 'auto' : 'none'}
      style={[{ top }, visibilityStyle]}>
      <Pressable
        accessibilityLabel="Reset map north"
        className="border-primary/40 bg-card/95 size-12 items-center justify-center rounded-lg border"
        onPress={onPress}>
        <Animated.View
          className="h-8 w-5 items-center justify-center"
          style={{ transform: [{ rotate: `${-normalizeBearing(bearing)}deg` }] }}>
          <View
            style={{
              width: 0,
              height: 0,
              borderLeftWidth: 6,
              borderRightWidth: 6,
              borderBottomWidth: 17,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: colors.primary,
            }}
          />
          <View className="relative h-4 w-3 items-center">
            <View
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 6,
                borderRightWidth: 6,
                borderTopWidth: 17,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: colors.primary,
              }}
            />
            <View
              className="absolute top-0"
              style={{
                width: 0,
                height: 0,
                borderLeftWidth: 4,
                borderRightWidth: 4,
                borderTopWidth: 13,
                borderLeftColor: 'transparent',
                borderRightColor: 'transparent',
                borderTopColor: colors.card,
              }}
            />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

function WorldOverviewFallback({ status }: { status: string }) {
  const colors = useThemeStore((state) => state.colors);
  return (
    <View className="bg-background flex-1">
      <View className="absolute inset-0">
        <Svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice" style={{ flex: 1 }}>
          <Path d="M0 0H360V180H0Z" fill={colors.muted} />
          {WORLD_OVERVIEW_PATHS.map((path) => (
            <Path
              key={path}
              d={path}
              fill={colors.card}
              stroke={colors.primary}
              strokeWidth={0.9}
            />
          ))}
        </Svg>
      </View>
      <View className="flex-1 items-center justify-center gap-4 p-8">
        <View className="border-primary/40 bg-background/80 size-20 items-center justify-center rounded-lg border">
          <Icon as={Layers} className="text-primary size-9" />
        </View>
        <View className="bg-background/80 border-border max-w-80 gap-1 rounded-lg border p-3">
          <Text variant="h3" className="text-center">
            World overview
          </Text>
          <Text variant="muted" className="text-center">
            {status}
          </Text>
        </View>
      </View>
    </View>
  );
}

export function OfflineMapsPanel({
  busyKey,
  managerTab,
  presetResults,
  presetSearch,
  regions,
  viewedBounds,
  visible,
  onChangePresetSearch,
  onChangeTab,
  onClose,
  onDeleteRegion,
  onDownloadPreset,
  onDownloadRegion,
  onDownloadVisibleArea,
  onFocusRegion,
  onPauseRegion,
}: {
  busyKey: string | null;
  managerTab: ManagerTab;
  presetResults: MapPreset[];
  presetSearch: string;
  regions: MapRegion[];
  viewedBounds: MapViewBounds | null;
  visible: boolean;
  onChangePresetSearch: (value: string) => void;
  onChangeTab: (tab: ManagerTab) => void;
  onClose: () => void;
  onDeleteRegion: (region: MapRegion) => void;
  onDownloadPreset: (preset: MapPreset) => void;
  onDownloadRegion: (regionId: string) => void;
  onDownloadVisibleArea: () => void;
  onFocusRegion: (region: MapRegion) => void;
  onPauseRegion: (region: MapRegion) => void;
}) {
  const visibleAreaBusy = busyKey === 'download:visible-area';
  const hasVisibleBounds = Boolean(viewedBounds);

  return (
    <ArkBottomSheet visible={visible} onDismiss={onClose} scrollable snapPoints={['68%', '92%']}>
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="h3" className="min-w-0 flex-1">
          Offline maps
        </Text>
        <Button size="icon" variant="outline" onPress={onClose}>
          <Icon as={X} className="size-4" />
        </Button>
      </View>

      <Card className="gap-3 p-3">
        <View className="flex-row items-start gap-3">
          <View className="bg-primary/15 size-10 items-center justify-center rounded-md">
            <Icon as={Layers} className="text-primary size-5" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-semibold">Visible area</Text>
            <Text variant="small" className="text-muted-foreground">
              {hasVisibleBounds
                ? `${formatVisibleBounds(viewedBounds!)}. Ark will save the current map view as a custom offline region.`
                : 'Move or zoom the map once to let Ark read the current visible bounds.'}
            </Text>
          </View>
        </View>
        <Button disabled={!hasVisibleBounds || visibleAreaBusy} onPress={onDownloadVisibleArea}>
          {visibleAreaBusy ? (
            <ActivityIndicator size="small" />
          ) : (
            <Icon as={Download} className="size-4" />
          )}
          <Text>Download visible area</Text>
        </Button>
      </Card>

      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          variant={managerTab === 'downloaded' ? 'default' : 'outline'}
          onPress={() => onChangeTab('downloaded')}>
          <Text>Downloaded</Text>
        </Button>
        <Button
          className="flex-1"
          variant={managerTab === 'browse' ? 'default' : 'outline'}
          onPress={() => onChangeTab('browse')}>
          <Text>Browse</Text>
        </Button>
      </View>

      {managerTab === 'downloaded' ? (
        <View className="gap-2">
          {regions.length ? (
            regions.map((region) => (
              <OfflineRegionRow
                key={region.id}
                busy={busyKey === `download:${region.id}`}
                region={region}
                onDelete={() => onDeleteRegion(region)}
                onDownload={() => onDownloadRegion(region.id)}
                onFocus={() => onFocusRegion(region)}
                onPause={() => onPauseRegion(region)}
              />
            ))
          ) : (
            <Text variant="muted">No offline regions saved yet.</Text>
          )}
        </View>
      ) : (
        <View className="gap-3">
          <Input
            value={presetSearch}
            onChangeText={onChangePresetSearch}
            placeholder="Search regions"
            autoCapitalize="none"
          />
          <View className="gap-2">
            {presetResults.length ? (
              presetResults.map((preset) => (
                <PresetRegionRow
                  key={preset.id}
                  busy={busyKey === `download:${preset.id}`}
                  preset={preset}
                  onDownload={() => onDownloadPreset(preset)}
                />
              ))
            ) : (
              <Text variant="muted">No catalog regions match this search.</Text>
            )}
          </View>
        </View>
      )}
    </ArkBottomSheet>
  );
}

function OfflineRegionRow({
  busy,
  region,
  onDelete,
  onDownload,
  onFocus,
  onPause,
}: {
  busy: boolean;
  region: MapRegion;
  onDelete: () => void;
  onDownload: () => void;
  onFocus: () => void;
  onPause: () => void;
}) {
  const canPause = region.status === 'downloading' || region.status === 'queued';
  const canDownload =
    region.status === 'not_downloaded' || region.status === 'failed' || region.status === 'paused';
  const routingLabel = routingStatusLabel(region);

  return (
    <Card className="gap-3 p-3">
      <View className="flex-row items-start gap-3">
        <View className="bg-primary/15 size-10 items-center justify-center rounded-md">
          <Icon as={MapIcon} className="text-primary size-5" />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-semibold" numberOfLines={1}>
            {region.name}
          </Text>
          <Text variant="small" className="text-muted-foreground" numberOfLines={2}>
            {formatMapRegionStorage(region)} · {getMapPackFormatLabel(region.packFormat)}
            {routingLabel ? ` · ${routingLabel}` : ''}
          </Text>
          <StatusBadge region={region} />
        </View>
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Button className="h-9 flex-1" size="sm" variant="outline" onPress={onFocus}>
          <Icon as={MapIcon} className="size-4" />
          <Text>Map</Text>
        </Button>
        {canPause ? (
          <Button className="h-9 flex-1" size="sm" variant="outline" onPress={onPause}>
            <Text>Pause</Text>
          </Button>
        ) : canDownload ? (
          <Button className="h-9 flex-1" disabled={busy} size="sm" onPress={onDownload}>
            {busy ? <ActivityIndicator size="small" /> : <Icon as={Download} className="size-4" />}
            <Text>{region.status === 'paused' ? 'Resume' : 'Download'}</Text>
          </Button>
        ) : null}
        <Button className="h-9 flex-1" size="sm" variant="outline" onPress={onDelete}>
          <Icon as={Trash2} className="size-4" />
          <Text>Delete</Text>
        </Button>
      </View>
    </Card>
  );
}

function PresetRegionRow({
  busy,
  preset,
  onDownload,
}: {
  busy: boolean;
  preset: MapPreset;
  onDownload: () => void;
}) {
  const unsupportedReason = getUnsupportedMapPackReason(preset);
  return (
    <Card className="gap-3 p-3">
      <View className="flex-row items-start gap-3">
        <View className="bg-primary/15 size-10 items-center justify-center rounded-md">
          <Icon as={Layers} className="text-primary size-5" />
        </View>
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-semibold" numberOfLines={1}>
            {preset.name}
          </Text>
          <Text variant="small" className="text-muted-foreground" numberOfLines={2}>
            {preset.estimatedSize}
            {preset.routingPackUrl ? ' · navigation included' : ''}
          </Text>
        </View>
      </View>
      <Button disabled={busy || Boolean(unsupportedReason)} onPress={onDownload}>
        {busy ? <ActivityIndicator size="small" /> : <Icon as={Download} className="size-4" />}
        <Text>{unsupportedReason ? 'Planned' : 'Download map'}</Text>
      </Button>
      {unsupportedReason ? (
        <Text variant="small" className="text-muted-foreground">
          {unsupportedReason}
        </Text>
      ) : null}
    </Card>
  );
}

function PinTypeSelector({
  color,
  emergency,
  value,
  onChangeColor,
  onChangeEmergency,
  onChangeValue,
}: {
  color: string;
  emergency: boolean;
  value: MapPinType;
  onChangeColor: (value: string) => void;
  onChangeEmergency: (value: boolean) => void;
  onChangeValue: (value: MapPinType) => void;
}) {
  const colors = useThemeStore((state) => state.colors);
  const colorOptions = React.useMemo(() => {
    const unique = new Set([colors.primary, ...MAP_PIN_COLOR_OPTIONS]);
    return Array.from(unique);
  }, [colors.primary]);
  return (
    <View className="gap-3">
      <View className="flex-row flex-wrap gap-2">
        {MAP_PIN_TYPES.map((pin) => {
          const selected = pin.type === value;
          const PinIcon = iconForPinType(pin.type);
          return (
            <Button
              key={pin.type}
              className="h-10 px-3"
              size="sm"
              variant={selected ? 'default' : 'outline'}
              onPress={() => onChangeValue(pin.type)}>
              <Icon
                as={PinIcon}
                className={selected ? 'text-primary-foreground size-4' : 'text-primary size-4'}
              />
              <Text>{pin.label}</Text>
            </Button>
          );
        })}
      </View>
      <View className="gap-2">
        <Text variant="small" className="text-muted-foreground">
          Color
        </Text>
        <View className="flex-row flex-wrap gap-2">
          {colorOptions.map((optionColor) => {
            const selected = optionColor.toLowerCase() === color.toLowerCase();
            return (
              <Button
                key={optionColor}
                accessibilityLabel={`Use marker color ${optionColor}`}
                className={
                  selected ? 'border-primary bg-background h-10 w-10 border-2 p-0' : 'h-10 w-10 p-0'
                }
                size="icon"
                variant="outline"
                onPress={() => onChangeColor(optionColor)}>
                <View
                  className="size-5 rounded-full"
                  style={{
                    backgroundColor: optionColor,
                    borderColor: colors.border,
                    borderWidth: optionColor.toLowerCase() === '#f8fafc' ? 1 : 0,
                  }}
                />
              </Button>
            );
          })}
        </View>
      </View>
      <Button
        className="h-11 justify-start"
        variant={emergency ? 'default' : 'outline'}
        onPress={() => onChangeEmergency(!emergency)}>
        <Icon as={Star} className="size-4" />
        <Text>Emergency-important</Text>
      </Button>
    </View>
  );
}

export function MarkerPopup({
  marker,
  onClose,
  onEdit,
  onNavigate,
}: {
  marker: MapMarker;
  onClose: () => void;
  onEdit: () => void;
  onNavigate: () => void;
}) {
  const colors = useThemeStore((state) => state.colors);
  const pinMeta = getMapPinMeta(marker.pinType);
  const PinIcon = iconForPinType(marker.pinType);
  return (
    <View className="w-72 items-center">
      <Card className="border-primary/40 bg-background/95 w-72 gap-3 overflow-hidden p-3">
        <View className="flex-row items-start gap-3">
          <View className="h-16 w-16 shrink-0 overflow-hidden rounded-md">
            {marker.photoUri ? (
              <Image source={{ uri: marker.photoUri }} className="bg-muted h-full w-full" />
            ) : (
              <View className="bg-primary/15 h-full w-full items-center justify-center">
                <Icon as={PinIcon} className="text-primary size-7" />
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1 gap-1">
            <View className="flex-row items-start gap-2">
              <Text variant="large" className="min-w-0 flex-1 leading-5" numberOfLines={2}>
                {marker.title}
              </Text>
              <Pressable
                accessibilityLabel="Edit spot"
                className="bg-muted/70 size-8 shrink-0 items-center justify-center rounded-md"
                onPress={onEdit}>
                <Icon as={Pencil} className="text-muted-foreground size-4" />
              </Pressable>
              <Pressable
                accessibilityLabel="Close spot details"
                className="bg-muted/70 size-8 shrink-0 items-center justify-center rounded-md"
                onPress={onClose}>
                <Icon as={X} className="text-muted-foreground size-4" />
              </Pressable>
            </View>
            <Text variant="muted" className="text-sm leading-5" numberOfLines={2}>
              {marker.description || 'No description saved.'}
            </Text>
            <View className="flex-row flex-wrap gap-1">
              <View className="bg-muted/70 flex-row items-center gap-1 rounded-full px-2 py-1">
                <Icon as={PinIcon} className="text-primary size-3" />
                <Text variant="small">{pinMeta.label}</Text>
              </View>
              {marker.isEmergencyPin ? (
                <View className="bg-primary/15 flex-row items-center gap-1 rounded-full px-2 py-1">
                  <Icon as={Star} className="text-primary size-3" />
                  <Text variant="small">Emergency</Text>
                </View>
              ) : null}
            </View>
            <Text variant="small" className="text-muted-foreground" numberOfLines={1}>
              {formatPoint(marker.latitude, marker.longitude)}
            </Text>
            <Button className="mt-1 h-9 self-start" size="sm" onPress={onNavigate}>
              <Icon as={Route} className="size-4" />
              <Text>Navigate</Text>
            </Button>
          </View>
        </View>
      </Card>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 9,
          borderRightWidth: 9,
          borderTopWidth: 12,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: colors.primary,
        }}
      />
    </View>
  );
}

export function NavigationStatusCard({
  session,
  onFocus,
  onStop,
}: {
  session: NavigationSession;
  onFocus: () => void;
  onStop: () => void;
}) {
  const nextManeuver = session.route.maneuvers[session.currentManeuverIndex];
  const remaining = session.remainingDistanceMeters ?? session.route.distanceMeters;
  const routingModeLabel =
    session.route.routingMode === 'direct'
      ? `Direct line · ${routeFallbackLabel(session.route)}`
      : 'Offline route';
  return (
    <Card className="border-primary/40 bg-background/95 gap-3 p-3">
      <View className="flex-row items-start gap-2">
        <Icon as={Route} className="text-primary mt-0.5 size-4" />
        <View className="min-w-0 flex-1 gap-1">
          <Text className="text-sm font-semibold" numberOfLines={1}>
            {session.status === 'rerouting' ? 'Recalculating route' : session.destinationTitle}
          </Text>
          <Text className="text-muted-foreground text-xs" numberOfLines={2}>
            {nextManeuver?.instruction ?? 'Follow the highlighted route.'}
          </Text>
          <Text variant="small" className="text-muted-foreground">
            {routingModeLabel} · {(remaining / 1000).toFixed(1)} km remaining
          </Text>
        </View>
      </View>
      <View className="flex-row gap-2">
        <Button className="h-9 flex-1" size="sm" variant="outline" onPress={onFocus}>
          <Icon as={MapIcon} className="size-4" />
          <Text>Route</Text>
        </Button>
        <Button className="h-9 flex-1" size="sm" variant="outline" onPress={onStop}>
          <Icon as={X} className="size-4" />
          <Text>Stop</Text>
        </Button>
      </View>
    </Card>
  );
}

export function SpotDialog({
  busy,
  color,
  description,
  isEmergency,
  lngLat,
  photoUri,
  pinType,
  title,
  onAttachPhoto,
  onCancel,
  onChangeColor,
  onChangeDescription,
  onChangeEmergency,
  onChangePinType,
  onChangeTitle,
  onRemovePhoto,
  onSave,
}: {
  busy: boolean;
  color: string;
  description: string;
  isEmergency: boolean;
  lngLat: LngLat | null;
  photoUri: string | null;
  pinType: MapPinType;
  title: string;
  onAttachPhoto: (source: 'camera' | 'library') => void;
  onCancel: () => void;
  onChangeColor: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeEmergency: (value: boolean) => void;
  onChangePinType: (value: MapPinType) => void;
  onChangeTitle: (value: string) => void;
  onRemovePhoto: () => void;
  onSave: () => void;
}) {
  return (
    <ArkBottomSheet
      visible={Boolean(lngLat)}
      title="Save spot"
      description={lngLat ? formatPoint(lngLat[1], lngLat[0]) : ''}
      onDismiss={onCancel}
      scrollable
      snapPoints={['88%']}>
      <Input value={title} onChangeText={onChangeTitle} placeholder="Spot title" />
      <PinTypeSelector
        color={color}
        emergency={isEmergency}
        value={pinType}
        onChangeColor={onChangeColor}
        onChangeEmergency={onChangeEmergency}
        onChangeValue={onChangePinType}
      />
      <Input
        className="min-h-24"
        multiline
        textAlignVertical="top"
        value={description}
        onChangeText={onChangeDescription}
        placeholder="Description"
      />
      {photoUri ? (
        <View className="gap-2">
          <Image source={{ uri: photoUri }} className="bg-muted h-36 w-full rounded-lg" />
          <View className="flex-row gap-2">
            <Button className="flex-1" variant="outline" onPress={() => onAttachPhoto('camera')}>
              <Icon as={Camera} className="size-4" />
              <Text>Camera</Text>
            </Button>
            <Button className="flex-1" variant="outline" onPress={() => onAttachPhoto('library')}>
              <Icon as={ImageIcon} className="size-4" />
              <Text>Library</Text>
            </Button>
            <Button className="flex-1" variant="outline" onPress={onRemovePhoto}>
              <Icon as={Trash2} className="size-4" />
              <Text>Remove</Text>
            </Button>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Button className="flex-1" variant="outline" onPress={() => onAttachPhoto('camera')}>
            <Icon as={Camera} className="size-4" />
            <Text>Take</Text>
          </Button>
          <Button className="flex-1" variant="outline" onPress={() => onAttachPhoto('library')}>
            <Icon as={ImageIcon} className="size-4" />
            <Text>Choose</Text>
          </Button>
        </View>
      )}
      <View className="flex-row gap-2">
        <Button className="flex-1" variant="outline" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
        <Button className="flex-1" disabled={busy} onPress={onSave}>
          {busy ? <ActivityIndicator /> : <Icon as={MapPin} className="size-4" />}
          <Text>Save</Text>
        </Button>
      </View>
    </ArkBottomSheet>
  );
}

export function EditSpotDialog({
  busy,
  color,
  description,
  isEmergency,
  marker,
  photoUri,
  pinType,
  title,
  onAttachPhoto,
  onCancel,
  onChangeColor,
  onChangeDescription,
  onChangeEmergency,
  onChangePinType,
  onChangeTitle,
  onRemovePhoto,
  onSave,
}: {
  busy: boolean;
  color: string;
  description: string;
  isEmergency: boolean;
  marker: MapMarker | null;
  photoUri: string | null;
  pinType: MapPinType;
  title: string;
  onAttachPhoto: (source: 'camera' | 'library') => void;
  onCancel: () => void;
  onChangeColor: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangeEmergency: (value: boolean) => void;
  onChangePinType: (value: MapPinType) => void;
  onChangeTitle: (value: string) => void;
  onRemovePhoto: () => void;
  onSave: () => void;
}) {
  return (
    <ArkBottomSheet
      visible={Boolean(marker)}
      title="Edit spot"
      description={marker ? formatPoint(marker.latitude, marker.longitude) : ''}
      onDismiss={onCancel}
      scrollable
      snapPoints={['88%']}>
      <Input value={title} onChangeText={onChangeTitle} placeholder="Name" />
      <PinTypeSelector
        color={color}
        emergency={isEmergency}
        value={pinType}
        onChangeColor={onChangeColor}
        onChangeEmergency={onChangeEmergency}
        onChangeValue={onChangePinType}
      />
      <Input
        className="min-h-24"
        multiline
        textAlignVertical="top"
        value={description}
        onChangeText={onChangeDescription}
        placeholder="Description"
      />
      {photoUri ? (
        <View className="gap-2">
          <Image source={{ uri: photoUri }} className="bg-muted h-40 w-full rounded-lg" />
          <View className="flex-row gap-2">
            <Button className="flex-1" variant="outline" onPress={() => onAttachPhoto('camera')}>
              <Icon as={Camera} className="size-4" />
              <Text>Camera</Text>
            </Button>
            <Button className="flex-1" variant="outline" onPress={() => onAttachPhoto('library')}>
              <Icon as={ImageIcon} className="size-4" />
              <Text>Library</Text>
            </Button>
            <Button className="flex-1" variant="outline" onPress={onRemovePhoto}>
              <Icon as={Trash2} className="size-4" />
              <Text>Remove</Text>
            </Button>
          </View>
        </View>
      ) : (
        <View className="flex-row gap-2">
          <Button className="flex-1" variant="outline" onPress={() => onAttachPhoto('camera')}>
            <Icon as={Camera} className="size-4" />
            <Text>Take</Text>
          </Button>
          <Button className="flex-1" variant="outline" onPress={() => onAttachPhoto('library')}>
            <Icon as={ImageIcon} className="size-4" />
            <Text>Choose</Text>
          </Button>
        </View>
      )}
      <View className="flex-row gap-2">
        <Button className="flex-1" variant="outline" onPress={onCancel}>
          <Text>Cancel</Text>
        </Button>
        <Button className="flex-1" disabled={busy} onPress={onSave}>
          {busy ? <ActivityIndicator /> : <Icon as={Check} className="size-4" />}
          <Text>Update</Text>
        </Button>
      </View>
    </ArkBottomSheet>
  );
}

export function MapFab({
  active,
  icon,
  label,
  loading,
  onPress,
  text,
}: {
  active?: boolean;
  icon?: React.ComponentProps<typeof Icon>['as'];
  label: string;
  loading?: boolean;
  onPress: () => void;
  text?: string;
}) {
  return (
    <Button
      accessibilityLabel={label}
      size={text ? 'default' : 'icon'}
      variant={active ? 'default' : 'outline'}
      className={
        active
          ? text
            ? 'h-12 min-w-12 px-3'
            : ''
          : text
            ? 'border-primary/40 bg-card/95 h-12 min-w-12 px-3'
            : 'border-primary/40 bg-card/95'
      }
      onPress={onPress}>
      {loading ? (
        <ActivityIndicator />
      ) : text ? (
        <Text className={active ? 'text-primary-foreground font-bold' : 'text-primary font-bold'}>
          {text}
        </Text>
      ) : icon ? (
        <Icon
          as={icon}
          className={active ? 'text-primary-foreground size-5' : 'text-primary size-5'}
        />
      ) : null}
    </Button>
  );
}

function StatusBadge({ region }: { region: MapRegion }) {
  const status = region.status;
  const icon =
    status === 'downloaded' ? CheckCircle2 : status === 'failed' ? AlertTriangle : Clock3;
  const label = statusLabel(status);
  return (
    <View
      className={
        status === 'downloaded'
          ? 'bg-primary/15 flex-row items-center gap-1 rounded-full px-2 py-1'
          : status === 'failed'
            ? 'bg-destructive/15 flex-row items-center gap-1 rounded-full px-2 py-1'
            : 'bg-muted flex-row items-center gap-1 rounded-full px-2 py-1'
      }>
      <Icon
        as={icon}
        className={status === 'failed' ? 'text-destructive size-3.5' : 'text-primary size-3.5'}
      />
      <Text variant="small">{label}</Text>
    </View>
  );
}
