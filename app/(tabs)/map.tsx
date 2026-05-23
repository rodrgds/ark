import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import type { MapPreset } from '@/constants/map-presets';
import { FileSystemService } from '@/services/files/filesystem.service';
import { SettingsRepository } from '@/services/db/repositories/settings.repo';
import { MapService, type MapLibreModule } from '@/services/maps/map.service';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { useThemeStore } from '@/stores/theme-store';
import type { MapMarker, MapRegion, OfflineMapSearchResult, SavedRoute } from '@/types/maps';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { useNavigation } from 'expo-router';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  ImageIcon,
  Layers,
  List,
  LocateFixed,
  MapPin,
  Maximize2,
  Minimize2,
  Plus,
  Route,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Panel = 'offline' | 'saved' | null;
type ManagerTab = 'downloaded' | 'browse';
type TopMode = 'compact' | 'search' | 'map';
type LngLat = [number, number];

const DEFAULT_CENTER: LngLat = [-9.1393, 38.7223];
const DEFAULT_MAP_SETTING_KEY = 'maps.defaultRegionId';
const TOP_TRANSITION = LinearTransition.duration(180).easing(Easing.out(Easing.quad));

export default function MapScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const cameraRef = React.useRef<any>(null);
  const [regions, setRegions] = React.useState<MapRegion[]>([]);
  const [markers, setMarkers] = React.useState<MapMarker[]>([]);
  const [routes, setRoutes] = React.useState<SavedRoute[]>([]);
  const [offlineResults, setOfflineResults] = React.useState<OfflineMapSearchResult[]>([]);
  const [maplibre, setMaplibre] = React.useState<MapLibreModule | null>(null);
  const [maplibreChecked, setMaplibreChecked] = React.useState(false);
  const [activePanel, setActivePanel] = React.useState<Panel>(null);
  const [managerTab, setManagerTab] = React.useState<ManagerTab>('downloaded');
  const [topMode, setTopMode] = React.useState<TopMode>('compact');
  const [search, setSearch] = React.useState('');
  const [presetSearch, setPresetSearch] = React.useState('');
  const [savedSearch, setSavedSearch] = React.useState('');
  const [selectedRegionId, setSelectedRegionId] = React.useState<string | null>(null);
  const [pendingSpot, setPendingSpot] = React.useState<LngLat | null>(null);
  const [spotTitle, setSpotTitle] = React.useState('');
  const [spotDescription, setSpotDescription] = React.useState('');
  const [spotPhotoUri, setSpotPhotoUri] = React.useState<string | null>(null);
  const [center, setCenter] = React.useState<LngLat>(DEFAULT_CENTER);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [styleReachable, setStyleReachable] = React.useState<boolean | null>(null);
  const [checkingStyle, setCheckingStyle] = React.useState(false);
  const [recommendedPresets, setRecommendedPresets] = React.useState<MapPreset[]>(() =>
    MapPresetsService.recommendedForLocation(null)
  );

  const downloadedRegions = React.useMemo(
    () => regions.filter((region) => region.status === 'downloaded'),
    [regions]
  );
  const selectedRegion = React.useMemo(
    () => downloadedRegions.find((region) => region.id === selectedRegionId) ?? null,
    [downloadedRegions, selectedRegionId]
  );
  const mapStyle = React.useMemo(() => {
    // If a downloaded offline pack is selected, always use the local JSON style.
    // MapLibre's offline pack intercepts the tile requests that were cached at download time,
    // so the map renders fully offline. Using the remote styleUrl here would fail offline.
    if (selectedRegion?.status === 'downloaded') {
      return MapService.getLocalStyle(theme);
    }
    // No offline region selected — use themed remote style (requires internet)
    return MapService.getThemedStyle(theme);
  }, [selectedRegion, theme]);
  const mapStyleUrl =
    typeof mapStyle === 'string' ? mapStyle : MapService.getDefaultStyleUrl(theme);
  const status = MapService.getRuntimeStatus(maplibre, maplibreChecked);
  const nativeMapAvailable = Boolean(getMapComponent(maplibre) && getCameraComponent(maplibre));
  // Allow mounting the map if:
  //  - we have a downloaded region (can render fully offline), OR
  //  - the online style is reachable (for live browsing without a downloaded pack)
  const hasDownloadedRegion = downloadedRegions.length > 0 && Boolean(selectedRegion);
  const canMountMap = nativeMapAvailable && (hasDownloadedRegion || styleReachable === true);
  const filteredMarkers = React.useMemo(() => {
    const query = savedSearch.trim().toLowerCase();
    if (!query) return markers;
    return markers.filter((marker) =>
      `${marker.title} ${marker.description ?? ''}`.toLowerCase().includes(query)
    );
  }, [markers, savedSearch]);
  const presetResults = React.useMemo(() => MapPresetsService.search(presetSearch), [presetSearch]);

  async function load(options: { syncNative?: boolean } = {}) {
    if (options.syncNative) await OfflineMapService.syncNativePacks();
    const [nextRegions, nextMarkers, nextRoutes, storedDefault] = await Promise.all([
      OfflineMapService.listRegions(),
      OfflineMapService.listMarkers(),
      OfflineMapService.listRoutes(),
      SettingsRepository.get(DEFAULT_MAP_SETTING_KEY),
    ]);
    setRegions(nextRegions);
    setMarkers(nextMarkers);
    setRoutes(nextRoutes);

    const nextDownloaded = nextRegions.filter((region) => region.status === 'downloaded');
    setSelectedRegionId((current) => {
      if (current && nextDownloaded.some((region) => region.id === current)) return current;
      if (storedDefault && nextDownloaded.some((region) => region.id === storedDefault)) {
        return storedDefault;
      }
      return nextDownloaded[0]?.id ?? null;
    });
  }

  React.useEffect(() => {
    void load({ syncNative: true });
    MapService.loadMapLibre()
      .then(setMaplibre)
      .finally(() => setMaplibreChecked(true));
  }, []);

  React.useEffect(() => {
    navigation.setOptions({ tabBarStyle: fullscreen ? { display: 'none' } : undefined });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [fullscreen, navigation]);

  React.useEffect(() => {
    let canceled = false;
    if (!maplibre) {
      setStyleReachable(null);
      return;
    }
    // If we have a downloaded offline pack selected, the map works offline — skip the check
    if (hasDownloadedRegion) {
      setStyleReachable(true);
      setCheckingStyle(false);
      return;
    }
    setCheckingStyle(true);
    MapService.canReachStyleUrl(mapStyleUrl)
      .then((reachable) => {
        if (!canceled) setStyleReachable(reachable);
      })
      .finally(() => {
        if (!canceled) setCheckingStyle(false);
      });
    return () => {
      canceled = true;
    };
  }, [maplibre, mapStyleUrl, hasDownloadedRegion]);


  React.useEffect(() => {
    const hasActiveDownloads = regions.some((region) => region.status === 'downloading');
    if (!hasActiveDownloads && !busy?.startsWith('download:')) return;
    const interval = setInterval(() => {
      void load({ syncNative: true });
    }, 1000);
    return () => clearInterval(interval);
  }, [regions, busy]);

  React.useEffect(() => {
    let canceled = false;
    const timeout = setTimeout(() => {
      OfflineMapService.searchOffline(search).then((results) => {
        if (!canceled) setOfflineResults(results);
      });
    }, 120);
    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [search, markers.length, regions.length, routes.length]);

  React.useEffect(() => {
    let canceled = false;
    Location.getForegroundPermissionsAsync()
      .then((permission) => {
        if (!permission.granted) return null;
        return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      })
      .then((position) => {
        if (canceled) return;
        setRecommendedPresets(
          MapPresetsService.recommendedForLocation(
            position
              ? {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                }
              : null
          )
        );
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!mapReady || !canMountMap || !selectedRegion) return;
    const timeout = setTimeout(() => fitRegion(selectedRegion), 150);
    return () => clearTimeout(timeout);
  }, [mapReady, canMountMap, selectedRegion?.id]);

  function openSpotDialog(lngLat: LngLat) {
    setPendingSpot(lngLat);
    setSpotTitle('');
    setSpotDescription('');
    setSpotPhotoUri(null);
  }

  async function cancelSpotDialog() {
    if (spotPhotoUri) await FileSystemService.deleteByUri(spotPhotoUri).catch(() => undefined);
    setPendingSpot(null);
    setSpotPhotoUri(null);
  }

  async function attachSpotPhoto() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'image/*',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const savedUri = await FileSystemService.copyToAppDirectory({
      sourceUri: asset.uri,
      directory: 'maps',
      fileName: asset.name ?? 'spot-photo.jpg',
    });
    if (spotPhotoUri) await FileSystemService.deleteByUri(spotPhotoUri).catch(() => undefined);
    setSpotPhotoUri(savedUri);
  }

  async function saveSpot() {
    if (!pendingSpot || !spotTitle.trim()) {
      setError('Add a title before saving this spot.');
      return;
    }
    setBusy('spot');
    setError(null);
    try {
      await OfflineMapService.createMarker({
        title: spotTitle.trim(),
        description: spotDescription.trim() || null,
        longitude: pendingSpot[0],
        latitude: pendingSpot[1],
        photoUri: spotPhotoUri,
      });
      setPendingSpot(null);
      setSpotPhotoUri(null);
      await load();
    } catch {
      setError('Unable to save this spot.');
    } finally {
      setBusy(null);
    }
  }

  async function locateMe() {
    setBusy('locate');
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Location permission is required to center the map.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      centerOn([current.coords.longitude, current.coords.latitude], 13);
    } catch {
      setError('Unable to get your current location.');
    } finally {
      setBusy(null);
    }
  }

  async function downloadPreset(preset: MapPreset) {
    const existing = regions.find((region) => region.name === preset.name);
    const regionId =
      existing?.id ??
      (await OfflineMapService.createRegionDownload({
        name: preset.name,
        bounds: preset.bounds,
        minZoom: preset.minZoom,
        maxZoom: preset.maxZoom,
        styleUrl: MapService.getDefaultStyleUrl(theme),
      }));
    await load();
    await startDownload(regionId);
    setSelectedRegionId(regionId);
    await SettingsRepository.set(DEFAULT_MAP_SETTING_KEY, regionId);
  }

  async function startDownload(regionId: string) {
    setBusy(`download:${regionId}`);
    setError(null);
    try {
      const result = await OfflineMapService.refreshRegion(regionId);
      if (!result.ok) setError(result.reason ?? 'Unable to download this map region.');
    } finally {
      await load({ syncNative: true });
      setBusy(null);
    }
  }

  async function selectRegion(region: MapRegion) {
    setSelectedRegionId(region.id);
    await SettingsRepository.set(DEFAULT_MAP_SETTING_KEY, region.id);
    fitRegion(region);
    setTopMode('compact');
  }

  async function deleteRegion(region: MapRegion) {
    Alert.alert('Delete offline region?', region.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await OfflineMapService.deleteRegion(region.id);
          if (selectedRegionId === region.id) {
            setSelectedRegionId(null);
            await SettingsRepository.set(DEFAULT_MAP_SETTING_KEY, '');
          }
          await load({ syncNative: true });
        },
      },
    ]);
  }

  async function deleteMarker(marker: MapMarker) {
    Alert.alert('Delete spot?', marker.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await OfflineMapService.deleteMarker(marker.id);
          await load();
        },
      },
    ]);
  }

  async function deleteRoute(route: SavedRoute) {
    Alert.alert('Delete route?', route.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await OfflineMapService.deleteRoute(route.id);
          await load();
        },
      },
    ]);
  }

  function centerOn(nextCenter: LngLat, zoom = 13) {
    setCenter(nextCenter);
    if (cameraRef.current?.flyTo) {
      cameraRef.current.flyTo({ center: nextCenter, zoom, duration: 650 });
    } else {
      cameraRef.current?.easeTo?.({ center: nextCenter, zoom, duration: 650 });
    }
  }

  function fitRegion(region: MapRegion) {
    const bounds = regionBounds(region);
    if (!bounds) return;
    const [west, south, east, north] = bounds;
    // Camera.fitBounds(ne, sw, paddingNumber, durationMs) — padding must be a number, not an object
    cameraRef.current?.fitBounds?.([east, north], [west, south], 42, 650);
    setCenter([(west + east) / 2, (south + north) / 2]);
  }

  function centerOnRoute(route: SavedRoute) {
    const bounds = routeBounds(route);
    if (!bounds) return;
    const [west, south, east, north] = bounds;
    // Camera.fitBounds(ne, sw, paddingNumber, durationMs) — padding must be a number, not an object
    cameraRef.current?.fitBounds?.([east, north], [west, south], 64, 650);
    setCenter([(west + east) / 2, (south + north) / 2]);
  }

  function openSearchResult(result: OfflineMapSearchResult) {
    setSearch('');
    setTopMode('compact');
    if (result.kind === 'spot' && result.longitude != null && result.latitude != null) {
      centerOn([result.longitude, result.latitude], 14);
      return;
    }
    if (result.kind === 'region') {
      const region = regions.find((item) => item.id === result.id);
      if (region) fitRegion(region);
      return;
    }
    const route = routes.find((item) => item.id === result.id);
    if (route) centerOnRoute(route);
  }

  const mapStatus =
    nativeMapAvailable && styleReachable === false && !selectedRegion
      ? 'Map source unreachable. Downloaded maps can still render when selected.'
      : status.reason;

  return (
    <View className="bg-background flex-1">
      <MapCanvas
        cameraRef={cameraRef}
        canMount={canMountMap}
        center={regionCenter(selectedRegion) ?? center}
        checkingSource={checkingStyle}
        fullscreen={fullscreen}
        mapStyle={mapStyle}
        maplibre={maplibre}
        markers={markers}
        routes={routes}
        selectedRegion={selectedRegion}
        status={mapStatus}
        onCenterChange={setCenter}
        onLongPress={openSpotDialog}
        onMapLoadFailed={() =>
          setError('Map source failed to load. Select a downloaded map or retry with internet.')
        }
        onMapReady={() => setMapReady(true)}
        onMarkerPress={(marker) => centerOn([marker.longitude, marker.latitude], 14)}
      />

      <View className="absolute right-3 left-3 gap-2" style={{ top: Math.max(insets.top + 2, 6) }}>
        <TopMapControls
          downloadedRegions={downloadedRegions}
          mode={topMode}
          offlineResults={offlineResults}
          search={search}
          selectedRegion={selectedRegion}
          onChangeMode={setTopMode}
          onChangeSearch={setSearch}
          onOpenResult={openSearchResult}
          onSelectRegion={selectRegion}
        />
      </View>

      <View className="absolute right-3 gap-2" style={{ bottom: Math.max(insets.bottom + 12, 20) }}>
        <MapFab
          icon={LocateFixed}
          label="Locate me"
          loading={busy === 'locate'}
          onPress={locateMe}
        />
        <MapFab icon={Plus} label="Add spot" onPress={() => openSpotDialog(center)} />
        <MapFab
          icon={Download}
          label="Offline maps"
          onPress={() => {
            setManagerTab(downloadedRegions.length ? 'downloaded' : 'browse');
            setActivePanel('offline');
          }}
        />
        <MapFab icon={List} label="Saved data" onPress={() => setActivePanel('saved')} />
        <MapFab
          icon={fullscreen ? Minimize2 : Maximize2}
          label={fullscreen ? 'Exit full map' : 'Fullscreen'}
          onPress={() => setFullscreen((value) => !value)}
        />
      </View>

      <View
        className="absolute left-3 max-w-[75%] gap-2"
        style={{ bottom: Math.max(insets.bottom + 12, 20) }}>
        {error ? (
          <Card className="border-destructive bg-background/95 flex-row items-start gap-2 p-3">
            <Icon as={AlertTriangle} className="text-destructive mt-0.5 size-4" />
            <Text className="text-destructive flex-1 text-sm">{error}</Text>
          </Card>
        ) : null}
        {!canMountMap ? (
          <Card className="bg-background/95 gap-1 p-3">
            <Text variant="small">Map engine</Text>
            <Text variant="muted">{checkingStyle ? 'Checking map source.' : mapStatus}</Text>
          </Card>
        ) : null}
      </View>

      <OfflineManagerPanel
        busy={busy}
        downloadedRegions={downloadedRegions}
        managerTab={managerTab}
        presetResults={presetResults}
        presetSearch={presetSearch}
        recommendedPresets={recommendedPresets}
        regions={regions}
        selectedRegionId={selectedRegionId}
        visible={activePanel === 'offline'}
        onChangePresetSearch={setPresetSearch}
        onChangeTab={setManagerTab}
        onClose={() => setActivePanel(null)}
        onDeleteRegion={deleteRegion}
        onDownloadPreset={downloadPreset}
        onSelectRegion={selectRegion}
      />

      <SavedDataPanel
        markers={filteredMarkers}
        routes={routes}
        search={savedSearch}
        visible={activePanel === 'saved'}
        onChangeSearch={setSavedSearch}
        onClose={() => setActivePanel(null)}
        onDeleteMarker={deleteMarker}
        onDeleteRoute={deleteRoute}
        onFocusMarker={(marker) => {
          centerOn([marker.longitude, marker.latitude], 14);
          setActivePanel(null);
        }}
        onFocusRoute={(route) => {
          centerOnRoute(route);
          setActivePanel(null);
        }}
      />

      <SpotDialog
        busy={busy === 'spot'}
        description={spotDescription}
        lngLat={pendingSpot}
        photoUri={spotPhotoUri}
        title={spotTitle}
        onAttachPhoto={attachSpotPhoto}
        onCancel={cancelSpotDialog}
        onChangeDescription={setSpotDescription}
        onChangeTitle={setSpotTitle}
        onRemovePhoto={async () => {
          if (spotPhotoUri)
            await FileSystemService.deleteByUri(spotPhotoUri).catch(() => undefined);
          setSpotPhotoUri(null);
        }}
        onSave={saveSpot}
      />
    </View>
  );
}

function MapCanvas({
  cameraRef,
  canMount,
  center,
  checkingSource,
  fullscreen,
  mapStyle,
  maplibre,
  markers,
  routes,
  selectedRegion,
  status,
  onCenterChange,
  onLongPress,
  onMapLoadFailed,
  onMapReady,
  onMarkerPress,
}: {
  cameraRef: React.MutableRefObject<any>;
  canMount: boolean;
  center: LngLat;
  checkingSource: boolean;
  fullscreen: boolean;
  mapStyle: unknown;
  maplibre: MapLibreModule | null;
  markers: MapMarker[];
  routes: SavedRoute[];
  selectedRegion: MapRegion | null;
  status: string;
  onCenterChange: (center: LngLat) => void;
  onLongPress: (center: LngLat) => void;
  onMapLoadFailed: () => void;
  onMapReady: () => void;
  onMarkerPress: (marker: MapMarker) => void;
}) {
  const Map = getMapComponent(maplibre);
  const Camera = getCameraComponent(maplibre);
  const Marker = getMarkerComponent(maplibre);
  const GeoJSONSource = getGeoJSONSourceComponent(maplibre);
  const Layer = getLayerComponent(maplibre);
  const UserLocation = getUserLocationComponent(maplibre);
  const routeData = React.useMemo(() => routeFeatureCollection(routes), [routes]);
  const mapKey = typeof mapStyle === 'string' ? mapStyle : 'json-style';

  if (!Map || !Camera || !canMount) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-8">
        <View className="border-primary/40 bg-primary/15 size-20 items-center justify-center rounded-lg border">
          <Icon as={Layers} className="text-primary size-9" />
        </View>
        <View className="max-w-80 gap-1">
          <Text variant="h3" className="text-center">
            Offline map console
          </Text>
          <Text variant="muted" className="text-center">
            {checkingSource ? 'Checking map source availability.' : status}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Map
      key={mapKey}
      style={{ flex: 1 }}
      mapStyle={mapStyle as never}
      logo={false}
      attribution={false}
      compass
      scaleBar={fullscreen}
      onDidFailLoadingMap={onMapLoadFailed}
      onDidFinishLoadingMap={onMapReady}
      onLongPress={(event: any) => onLongPress(event.nativeEvent.lngLat)}
      onRegionDidChange={(event: any) => onCenterChange(event.nativeEvent.center)}>
      <Camera
        ref={cameraRef}
        initialViewState={{
          center,
          zoom: selectedRegion?.minZoom ?? 8,
        }}
      />
      {UserLocation ? <UserLocation animated /> : null}
      {GeoJSONSource && Layer && routes.length ? (
        <GeoJSONSource id="ark-routes" data={routeData}>
          <Layer
            id="ark-routes-line"
            type="line"
            style={{
              lineColor: '#95a78b',
              lineOpacity: 0.92,
              lineWidth: 4,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </GeoJSONSource>
      ) : null}
      {Marker
        ? markers.map((marker) => (
            <Marker
              key={marker.id}
              id={marker.id}
              lngLat={[marker.longitude, marker.latitude]}
              anchor="bottom"
              onPress={() => onMarkerPress(marker)}>
              <View className="items-center">
                <View className="border-background bg-primary size-5 rounded-full border-2" />
                <View className="bg-primary h-2 w-0.5" />
              </View>
            </Marker>
          ))
        : null}
    </Map>
  );
}

function TopMapControls({
  downloadedRegions,
  mode,
  offlineResults,
  search,
  selectedRegion,
  onChangeMode,
  onChangeSearch,
  onOpenResult,
  onSelectRegion,
}: {
  downloadedRegions: MapRegion[];
  mode: TopMode;
  offlineResults: OfflineMapSearchResult[];
  search: string;
  selectedRegion: MapRegion | null;
  onChangeMode: (mode: TopMode) => void;
  onChangeSearch: (value: string) => void;
  onOpenResult: (result: OfflineMapSearchResult) => void;
  onSelectRegion: (region: MapRegion) => void;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {mode !== 'map' ? (
          <Animated.View layout={TOP_TRANSITION} className="flex-1">
            <View className="border-border bg-card/95 flex-row items-center gap-2 rounded-lg border px-3 py-2">
              <Icon as={Search} className="text-muted-foreground size-4" />
              <Input
                className="h-9 min-h-0 flex-1 border-0 bg-transparent px-0 py-0"
                value={search}
                onChangeText={onChangeSearch}
                onFocus={() => onChangeMode('search')}
                placeholder="Search offline map data"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {mode === 'search' || search ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8"
                  onPress={() => {
                    onChangeSearch('');
                    onChangeMode('compact');
                  }}>
                  <Icon as={X} className="size-4" />
                </Button>
              ) : null}
            </View>
          </Animated.View>
        ) : null}

        {mode !== 'search' ? (
          <Animated.View layout={TOP_TRANSITION} className={mode === 'map' ? 'flex-1' : ''}>
            <Pressable
              className="border-border bg-card/95 h-[53px] flex-row items-center justify-center gap-2 rounded-lg border px-3"
              onPress={() => onChangeMode(mode === 'map' ? 'compact' : 'map')}>
              <Icon as={Layers} className="text-primary size-4" />
              {mode === 'map' ? (
                <Text className="min-w-0 flex-1" numberOfLines={1}>
                  {selectedRegion?.name ?? 'Select map'}
                </Text>
              ) : null}
              <Icon as={ChevronDown} className="text-muted-foreground size-4" />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      {mode === 'map' ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}>
          <Card className="gap-1 p-2">
            {downloadedRegions.length ? (
              downloadedRegions.map((region) => (
                <Button
                  key={region.id}
                  variant={selectedRegion?.id === region.id ? 'secondary' : 'ghost'}
                  className="justify-start px-2"
                  onPress={() => onSelectRegion(region)}>
                  <Icon
                    as={selectedRegion?.id === region.id ? CheckCircle2 : Layers}
                    className="text-primary size-4"
                  />
                  <Text className="min-w-0 flex-1" numberOfLines={1}>
                    {region.name}
                  </Text>
                </Button>
              ))
            ) : (
              <Text variant="muted" className="px-2 py-1">
                No downloaded maps.
              </Text>
            )}
          </Card>
        </Animated.View>
      ) : null}

      {mode === 'search' && search.trim().length >= 2 ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}>
          <Card className="gap-1 p-2">
            {offlineResults.length ? (
              offlineResults.map((result) => (
                <Button
                  key={`${result.kind}:${result.id}`}
                  className="justify-start px-2"
                  variant="ghost"
                  size="sm"
                  onPress={() => onOpenResult(result)}>
                  <Icon as={iconForSearchResult(result.kind)} className="text-primary size-4" />
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm">{result.title}</Text>
                    <Text variant="small" className="text-muted-foreground">
                      {labelForSearchResult(result.kind)} · {result.subtitle}
                    </Text>
                  </View>
                </Button>
              ))
            ) : (
              <Text variant="muted" className="px-2 py-1">
                No offline matches.
              </Text>
            )}
          </Card>
        </Animated.View>
      ) : null}
    </View>
  );
}

function OfflineManagerPanel({
  busy,
  downloadedRegions,
  managerTab,
  presetResults,
  presetSearch,
  recommendedPresets,
  regions,
  selectedRegionId,
  visible,
  onChangePresetSearch,
  onChangeTab,
  onClose,
  onDeleteRegion,
  onDownloadPreset,
  onSelectRegion,
}: {
  busy: string | null;
  downloadedRegions: MapRegion[];
  managerTab: ManagerTab;
  presetResults: MapPreset[];
  presetSearch: string;
  recommendedPresets: MapPreset[];
  regions: MapRegion[];
  selectedRegionId: string | null;
  visible: boolean;
  onChangePresetSearch: (value: string) => void;
  onChangeTab: (tab: ManagerTab) => void;
  onClose: () => void;
  onDeleteRegion: (region: MapRegion) => void;
  onDownloadPreset: (preset: MapPreset) => void;
  onSelectRegion: (region: MapRegion) => void;
}) {
  const visiblePresets = presetSearch.trim() ? presetResults : recommendedPresets;

  return (
    <Panel title="Offline maps" visible={visible} onClose={onClose}>
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
          <Text>Download more</Text>
        </Button>
      </View>

      {managerTab === 'downloaded' ? (
        <View className="gap-3">
          <View className="gap-1">
            <Text variant="large">Preset region</Text>
            <Text variant="muted">This map opens by default and drives the visible map area.</Text>
          </View>
          {downloadedRegions.length ? (
            downloadedRegions.map((region) => (
              <RegionCard
                key={region.id}
                busy={busy === `download:${region.id}`}
                isSelected={selectedRegionId === region.id}
                region={region}
                onDelete={() => onDeleteRegion(region)}
                onDownload={() => undefined}
                onSelect={() => onSelectRegion(region)}
              />
            ))
          ) : (
            <Card className="gap-1">
              <Text>No downloaded maps yet.</Text>
              <Text variant="muted">Open Download more and choose a preset region.</Text>
            </Card>
          )}
        </View>
      ) : (
        <View className="gap-3">
          <Input
            value={presetSearch}
            onChangeText={onChangePresetSearch}
            placeholder="Search regions"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View className="gap-2">
            <Text variant="large">{presetSearch.trim() ? 'Preset regions' : 'Recommended'}</Text>
            {visiblePresets.map((preset) => {
              const matchingRegion = regions.find((region) => region.name === preset.name);
              const downloaded = matchingRegion?.status === 'downloaded';
              const downloading = matchingRegion?.status === 'downloading';
              return (
                <PresetCard
                  key={preset.id}
                  busy={matchingRegion ? busy === `download:${matchingRegion.id}` : false}
                  downloaded={downloaded}
                  downloading={downloading}
                  preset={preset}
                  progress={matchingRegion?.progress ?? 0}
                  onDownload={() => onDownloadPreset(preset)}
                />
              );
            })}
          </View>
        </View>
      )}
    </Panel>
  );
}

function RegionCard({
  busy,
  isSelected,
  region,
  onDelete,
  onDownload,
  onSelect,
}: {
  busy: boolean;
  isSelected: boolean;
  region: MapRegion;
  onDelete: () => void;
  onDownload: () => void;
  onSelect: () => void;
}) {
  const downloaded = region.status === 'downloaded';
  const downloading = region.status === 'downloading';
  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <Pressable className="min-w-0 flex-1 gap-1" onPress={onSelect}>
          <View className="flex-row items-center gap-2">
            <Text variant="large" numberOfLines={1}>
              {region.name}
            </Text>
            {isSelected ? <Icon as={Star} className="text-primary size-4" /> : null}
          </View>
          <Text variant="muted">
            Zoom {region.minZoom ?? '-'} - {region.maxZoom ?? '-'}
          </Text>
        </Pressable>
        <StatusBadge region={region} />
      </View>

      {downloading ? (
        <View className="gap-2">
          <Progress value={region.progress} />
          <Text variant="small">{Math.round(region.progress * 100)}% downloaded</Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between gap-3">
        <Text variant="muted">
          {region.sizeBytes ? FileSystemService.formatBytes(region.sizeBytes) : 'Size pending'}
        </Text>
        <View className="flex-row gap-2">
          {!downloaded ? (
            <Button size="sm" disabled={busy || downloading} onPress={onDownload}>
              {busy || downloading ? (
                <ActivityIndicator />
              ) : (
                <Icon as={Download} className="size-4" />
              )}
              <Text>{region.status === 'failed' ? 'Retry' : 'Download'}</Text>
            </Button>
          ) : null}
          <Button size="sm" variant={isSelected ? 'secondary' : 'outline'} onPress={onSelect}>
            <Icon as={isSelected ? Check : Layers} className="size-4" />
            <Text>{isSelected ? 'Default' : 'Use'}</Text>
          </Button>
          <Button size="sm" variant="outline" onPress={onDelete}>
            <Icon as={Trash2} className="size-4" />
          </Button>
        </View>
      </View>
    </Card>
  );
}

function PresetCard({
  busy,
  downloaded,
  downloading,
  preset,
  progress,
  onDownload,
}: {
  busy: boolean;
  downloaded: boolean;
  downloading: boolean;
  preset: MapPreset;
  progress: number;
  onDownload: () => void;
}) {
  return (
    <Card className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text variant="large">{preset.name}</Text>
          <Text variant="muted" numberOfLines={2}>
            {preset.description}
          </Text>
        </View>
        {downloaded ? (
          <View className="bg-primary/15 flex-row items-center gap-1 rounded-full px-2 py-1">
            <Icon as={CheckCircle2} className="text-primary size-3.5" />
            <Text variant="small">Downloaded</Text>
          </View>
        ) : null}
      </View>
      {downloading ? (
        <View className="gap-2">
          <Progress value={progress} />
          <Text variant="small">{Math.round(progress * 100)}% downloaded</Text>
        </View>
      ) : null}
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="muted">
          Zoom {preset.minZoom} - {preset.maxZoom} · {preset.estimatedSize}
        </Text>
        <Button size="sm" disabled={downloaded || downloading || busy} onPress={onDownload}>
          {busy || downloading ? <ActivityIndicator /> : <Icon as={Download} className="size-4" />}
          <Text>{downloaded ? 'Ready' : 'Download'}</Text>
        </Button>
      </View>
    </Card>
  );
}

function SavedDataPanel({
  markers,
  routes,
  search,
  visible,
  onChangeSearch,
  onClose,
  onDeleteMarker,
  onDeleteRoute,
  onFocusMarker,
  onFocusRoute,
}: {
  markers: MapMarker[];
  routes: SavedRoute[];
  search: string;
  visible: boolean;
  onChangeSearch: (value: string) => void;
  onClose: () => void;
  onDeleteMarker: (marker: MapMarker) => void;
  onDeleteRoute: (route: SavedRoute) => void;
  onFocusMarker: (marker: MapMarker) => void;
  onFocusRoute: (route: SavedRoute) => void;
}) {
  return (
    <Panel title="Saved spots and routes" visible={visible} onClose={onClose}>
      <Input
        value={search}
        onChangeText={onChangeSearch}
        placeholder="Filter saved spots"
        autoCapitalize="none"
      />

      <View className="gap-2">
        <Text variant="large">Spots</Text>
        {markers.length ? (
          markers.map((marker) => (
            <SavedRow
              key={marker.id}
              icon={MapPin}
              photoUri={marker.photoUri}
              title={marker.title}
              subtitle={marker.description ?? formatPoint(marker.latitude, marker.longitude)}
              onPress={() => onFocusMarker(marker)}
              onDelete={() => onDeleteMarker(marker)}
            />
          ))
        ) : (
          <Text variant="muted">No saved spots match this filter.</Text>
        )}
      </View>

      <View className="gap-2">
        <Text variant="large">Routes</Text>
        {routes.length ? (
          routes.map((route) => (
            <SavedRow
              key={route.id}
              icon={Route}
              title={route.title}
              subtitle={`${route.points.length} points${
                route.distanceMeters ? ` · ${(route.distanceMeters / 1000).toFixed(1)} km` : ''
              }`}
              onPress={() => onFocusRoute(route)}
              onDelete={() => onDeleteRoute(route)}
            />
          ))
        ) : (
          <Text variant="muted">No route drafts yet.</Text>
        )}
      </View>
    </Panel>
  );
}

function SavedRow({
  icon,
  photoUri,
  title,
  subtitle,
  onDelete,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  photoUri?: string | null;
  title: string;
  subtitle: string;
  onDelete: () => void;
  onPress: () => void;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <Pressable className="min-w-0 flex-1 flex-row items-center gap-3" onPress={onPress}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} className="bg-muted size-10 rounded-md" />
        ) : (
          <View className="bg-primary/15 size-10 items-center justify-center rounded-md">
            <Icon as={icon} className="text-primary size-5" />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1}>{title}</Text>
          <Text variant="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      <Button size="icon" variant="outline" onPress={onDelete}>
        <Icon as={Trash2} className="size-4" />
      </Button>
    </Card>
  );
}

function Panel({
  children,
  title,
  visible,
  onClose,
}: {
  children: React.ReactNode;
  title: string;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/55">
        <Pressable className="flex-1" onPress={onClose} />
        <View className="border-border bg-background max-h-[82%] rounded-t-xl border-t p-3">
          <View className="mb-3 flex-row items-center justify-between gap-3">
            <Text variant="h3">{title}</Text>
            <Button size="icon" variant="outline" onPress={onClose}>
              <Icon as={X} className="size-4" />
            </Button>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SpotDialog({
  busy,
  description,
  lngLat,
  photoUri,
  title,
  onAttachPhoto,
  onCancel,
  onChangeDescription,
  onChangeTitle,
  onRemovePhoto,
  onSave,
}: {
  busy: boolean;
  description: string;
  lngLat: LngLat | null;
  photoUri: string | null;
  title: string;
  onAttachPhoto: () => void;
  onCancel: () => void;
  onChangeDescription: (value: string) => void;
  onChangeTitle: (value: string) => void;
  onRemovePhoto: () => void;
  onSave: () => void;
}) {
  return (
    <Modal visible={Boolean(lngLat)} animationType="fade" transparent onRequestClose={onCancel}>
      <View className="flex-1 justify-center bg-black/60 p-4">
        <Card className="gap-3">
          <View className="gap-1">
            <Text variant="h3">Save spot</Text>
            <Text variant="muted">{lngLat ? formatPoint(lngLat[1], lngLat[0]) : ''}</Text>
          </View>
          <Input value={title} onChangeText={onChangeTitle} placeholder="Spot title" />
          <Input value={description} onChangeText={onChangeDescription} placeholder="Description" />
          {photoUri ? (
            <View className="gap-2">
              <Image source={{ uri: photoUri }} className="bg-muted h-36 w-full rounded-lg" />
              <Button variant="outline" onPress={onRemovePhoto}>
                <Icon as={Trash2} className="size-4" />
                <Text>Remove photo</Text>
              </Button>
            </View>
          ) : (
            <Button variant="outline" onPress={onAttachPhoto}>
              <Icon as={ImageIcon} className="size-4" />
              <Text>Add photo</Text>
            </Button>
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
        </Card>
      </View>
    </Modal>
  );
}

function MapFab({
  icon,
  label,
  loading,
  onPress,
}: {
  icon: React.ComponentProps<typeof Icon>['as'];
  label: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <Button
      accessibilityLabel={label}
      size="icon"
      variant="outline"
      className="border-primary/40 bg-card/95"
      onPress={onPress}>
      {loading ? <ActivityIndicator /> : <Icon as={icon} className="text-primary size-5" />}
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

function getMapComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Map');
}

function getCameraComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Camera');
}

function getMarkerComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Marker');
}

function getGeoJSONSourceComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'GeoJSONSource');
}

function getLayerComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Layer');
}

function getUserLocationComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'UserLocation');
}

function getMapLibreExport(maplibre: MapLibreModule | null, name: string) {
  const maybeDefault = maplibre as (MapLibreModule & { default?: Record<string, unknown> }) | null;
  return (maplibre?.[name as keyof MapLibreModule] ?? maybeDefault?.default?.[name]) as
    | React.ComponentType<any>
    | undefined;
}

function routeFeatureCollection(routes: SavedRoute[]) {
  return {
    type: 'FeatureCollection',
    features: routes
      .filter((route) => route.points.length >= 2)
      .map((route) => ({
        type: 'Feature',
        properties: { id: route.id, title: route.title },
        geometry: {
          type: 'LineString',
          coordinates: route.points.map((point) => [point.longitude, point.latitude]),
        },
      })),
  };
}

function regionBounds(region: MapRegion): [number, number, number, number] | null {
  if (region.west == null || region.south == null || region.east == null || region.north == null) {
    return null;
  }
  return [region.west, region.south, region.east, region.north];
}

function regionCenter(region: MapRegion | null): LngLat | null {
  const bounds = region ? regionBounds(region) : null;
  if (!bounds) return null;
  return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}

function routeBounds(route: SavedRoute): [number, number, number, number] | null {
  if (!route.points.length) return null;
  const latitudes = route.points.map((point) => point.latitude);
  const longitudes = route.points.map((point) => point.longitude);
  return [
    Math.min(...longitudes),
    Math.min(...latitudes),
    Math.max(...longitudes),
    Math.max(...latitudes),
  ];
}

function iconForSearchResult(kind: OfflineMapSearchResult['kind']) {
  if (kind === 'route') return Route;
  if (kind === 'region') return Layers;
  return MapPin;
}

function labelForSearchResult(kind: OfflineMapSearchResult['kind']) {
  if (kind === 'route') return 'Route';
  if (kind === 'region') return 'Region';
  return 'Spot';
}

function statusLabel(status: MapRegion['status']) {
  if (status === 'downloaded') return 'Downloaded';
  if (status === 'downloading') return 'Downloading';
  if (status === 'failed') return 'Failed';
  if (status === 'queued') return 'Queued';
  return 'Not downloaded';
}

function formatPoint(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}
