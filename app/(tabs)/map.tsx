import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import type { MapPreset } from '@/constants/map-presets';
import { getMapPinMeta, MAP_PIN_TYPES, type MapPinType } from '@/constants/map-pins';
import { NAV_COLORS } from '@/constants/theme';
import { FileSystemService } from '@/services/files/filesystem.service';
import { MapService, type MapLibreModule } from '@/services/maps/map.service';
import { MapLocationService, type MapLocationIssue } from '@/services/maps/map-location.service';
import { getMapPackFormatLabel, getUnsupportedMapPackReason } from '@/services/maps/map-pack-format';
import { startPresetRegionDownload } from '@/services/maps/map-region-downloads';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { formatMapRegionStorage } from '@/services/maps/map-storage';
import { getMissingRegionPrompt } from '@/services/maps/missing-region-prompt';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { isPresetDownloaded } from '@/services/maps/map-region-utils';
import { useThemeStore } from '@/stores/theme-store';
import { useSensorStore } from '@/stores/sensor-store';
import type { MapMarker, MapRegion, OfflineMapSearchResult, SavedRoute } from '@/types/maps';
import type { LocationObject } from 'expo-location';
import { useNetInfo } from '@react-native-community/netinfo';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Droplets,
  Flame,
  Home,
  Hospital,
  ImageIcon,
  Layers,
  List,
  Map as MapIcon,
  MapPin,
  Maximize2,
  Minimize2,
  Pause,
  Pencil,
  Pill,
  Play,
  RefreshCw,
  Route,
  Search,
  Shield,
  Star,
  Tent,
  Trash2,
  Users,
  X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Keyboard,
  Linking,
  Modal,
  Pressable,
  type TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

type Panel = 'offline' | 'saved' | null;
type ManagerTab = 'downloaded' | 'browse';
type TopMode = 'compact' | 'search' | 'map';
type LngLat = [number, number];
type MapViewBounds = [number, number, number, number];
type CameraAction =
  | { type: 'center'; center: LngLat; zoom: number; duration: number }
  | { type: 'bounds'; bounds: MapViewBounds; padding: number; duration: number };

const DEFAULT_CENTER: LngLat = [0, 20];
const WORLD_OVERVIEW_ZOOM = 1.1;
const OFFLINE_REGION_ZOOM = 8;
const TOP_TRANSITION = LinearTransition.duration(180).easing(Easing.out(Easing.quad));
const SEARCH_INSET_WITH_COMPASS = 64;
const SEARCH_INSET_WITHOUT_COMPASS = 12;
const COMPASS_NORTH_EPSILON_DEGREES = 1.25;
const BEARING_UPDATE_EPSILON_DEGREES = 0.35;
const CENTER_UPDATE_EPSILON_DEGREES = 0.00001;
const COMPASS_RESET_SUPPRESS_MS = 500;
const SEARCH_GESTURE_SUPPRESS_MS = 450;
const WORLD_OVERVIEW_PATHS = [
  'M42 58L72 45L101 53L116 72L107 94L80 100L58 88Z',
  'M118 95L135 105L128 134L113 154L98 132L103 110Z',
  'M151 58L190 43L225 51L243 76L221 92L184 85L157 78Z',
  'M190 91L219 97L229 124L210 152L185 142L172 116Z',
  'M237 64L295 55L329 75L319 101L284 105L252 91Z',
  'M266 126L303 128L321 145L308 160L274 153Z',
];
const WORLD_OVERVIEW_POLYGONS: LngLat[][] = [
  [
    [-168, 72],
    [-52, 72],
    [-50, 8],
    [-88, -8],
    [-126, 15],
    [-168, 50],
    [-168, 72],
  ],
  [
    [-82, 12],
    [-34, 6],
    [-44, -56],
    [-72, -54],
    [-86, -20],
    [-82, 12],
  ],
  [
    [-12, 72],
    [46, 72],
    [72, 36],
    [45, 6],
    [5, 24],
    [-12, 72],
  ],
  [
    [-18, 34],
    [50, 34],
    [58, -35],
    [24, -36],
    [5, -4],
    [-18, 34],
  ],
  [
    [40, 68],
    [178, 68],
    [150, 8],
    [92, 6],
    [58, 30],
    [40, 68],
  ],
  [
    [110, -10],
    [156, -10],
    [154, -44],
    [112, -44],
    [110, -10],
  ],
];

export default function MapScreen() {
  const navigation = useNavigation();
  const { markerId } = useLocalSearchParams<{ markerId?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const cameraRef = React.useRef<any>(null);
  const pendingCameraActionRef = React.useRef<CameraAction | null>(null);
  const autoFocusedRegionIdRef = React.useRef<string | null>(null);
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
  const [pendingSpot, setPendingSpot] = React.useState<LngLat | null>(null);
  const [spotTitle, setSpotTitle] = React.useState('');
  const [spotDescription, setSpotDescription] = React.useState('');
  const [spotPhotoUri, setSpotPhotoUri] = React.useState<string | null>(null);
  const [spotPinType, setSpotPinType] = React.useState<MapPinType>('custom');
  const [spotEmergency, setSpotEmergency] = React.useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | null>(null);
  const [editingMarker, setEditingMarker] = React.useState<MapMarker | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editPhotoUri, setEditPhotoUri] = React.useState<string | null>(null);
  const [editPinType, setEditPinType] = React.useState<MapPinType>('custom');
  const [editEmergency, setEditEmergency] = React.useState(false);
  const [center, setCenter] = React.useState<LngLat>(DEFAULT_CENTER);
  const [viewedBounds, setViewedBounds] = React.useState<MapViewBounds | null>(null);
  const [zoom, setZoom] = React.useState<number>(WORLD_OVERVIEW_ZOOM);
  const mapZoomRef = React.useRef(WORLD_OVERVIEW_ZOOM);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [mapReady, setMapReady] = React.useState(false);
  const [showEmergencyPinsOnly, setShowEmergencyPinsOnly] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [catalogMeta, setCatalogMeta] = React.useState(() => MapPresetsService.getCatalogMeta());
  const [catalogVersion, setCatalogVersion] = React.useState(0);
  const [userLocation, setUserLocation] = React.useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationIssue, setLocationIssue] = React.useState<MapLocationIssue | null>(null);
  const [recommendedPresets, setRecommendedPresets] = React.useState<MapPreset[]>(() =>
    MapPresetsService.recommendedForLocation(null)
  );
  const netInfo = useNetInfo();
  const [isPlacing, setIsPlacing] = React.useState(false);
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [mapBearing, setMapBearing] = React.useState(0);
  const compassVisible = bearingDistanceFromNorth(mapBearing) > COMPASS_NORTH_EPSILON_DEGREES;
  const mapBearingRef = React.useRef(0);
  const mapCenterRef = React.useRef<LngLat>(DEFAULT_CENTER);
  const compassResetSuppressUntilRef = React.useRef(0);
  const searchInputRef = React.useRef<TextInput>(null);
  const searchGestureSuppressUntilRef = React.useRef(0);
  const searchRightInset = useSharedValue(SEARCH_INSET_WITHOUT_COMPASS);
  const animatedSearchStyle = useAnimatedStyle(() => ({
    right: searchRightInset.value,
  }));

  const downloadedRegions = React.useMemo(
    () => regions.filter((region) => region.status === 'downloaded'),
    [regions]
  );
  const primaryDownloadedRegion = downloadedRegions[0] ?? null;
  const userLocationCenter = React.useMemo<LngLat | null>(
    () => (userLocation ? [userLocation.longitude, userLocation.latitude] : null),
    [userLocation]
  );
  const mapInitialCenter = React.useMemo(() => {
    if (userLocationCenter) return userLocationCenter;
    const downloadedCenter = regionCenter(primaryDownloadedRegion);
    return downloadedCenter && isDefaultCenter(center) ? downloadedCenter : center;
  }, [center, primaryDownloadedRegion, userLocationCenter]);
  const mapInitialZoom = userLocationCenter
    ? 15
    : primaryDownloadedRegion
      ? regionInitialZoom(primaryDownloadedRegion)
      : WORLD_OVERVIEW_ZOOM;
  const hasActiveMapDownloads = React.useMemo(
    () => regions.some((region) => region.status === 'downloading' || region.status === 'queued'),
    [regions]
  );
  const mapStyle = React.useMemo(() => {
    if (downloadedRegions.length > 0) {
      return MapService.getLocalStyle(theme);
    }
    return MapService.getOverviewStyle(theme);
  }, [downloadedRegions.length, theme]);
  const mapInstanceKey =
    downloadedRegions.length > 0 ? 'offline-regions-map' : 'world-overview-map';
  const activeMapKeyRef = React.useRef(mapInstanceKey);
  const status = MapService.getRuntimeStatus(maplibre, maplibreChecked);
  const nativeMapAvailable = Boolean(getMapComponent(maplibre) && getCameraComponent(maplibre));
  const hasDownloadedRegion = downloadedRegions.length > 0;
  const canMountMap = nativeMapAvailable;

  const filteredMarkers = React.useMemo(() => {
    const source = showEmergencyPinsOnly
      ? markers.filter((marker) => marker.isEmergencyPin)
      : markers;
    const query = savedSearch.trim().toLowerCase();
    if (!query) return source;
    return source.filter((marker) =>
      `${marker.title} ${marker.description ?? ''} ${marker.pinType} ${
        marker.isEmergencyPin ? 'emergency' : ''
      }`
        .toLowerCase()
        .includes(query)
    );
  }, [markers, savedSearch, showEmergencyPinsOnly]);
  const visibleMarkers = React.useMemo(
    () => (showEmergencyPinsOnly ? markers.filter((marker) => marker.isEmergencyPin) : markers),
    [markers, showEmergencyPinsOnly]
  );
  const selectedMarker = React.useMemo(
    () => markers.find((marker) => marker.id === selectedMarkerId) ?? null,
    [markers, selectedMarkerId]
  );
  const presetResults = React.useMemo(
    () => MapPresetsService.search(presetSearch),
    [presetSearch, catalogVersion]
  );
  // Reactive suggestion: computed on every center/zoom/regions change — no timers.
  const visibleMissingRegionPrompt = React.useMemo(() => {
    if (activePanel || isPlacing) return null;
    const regionsInView = viewedBounds
      ? MapPresetsService.getRegionsForBoundingBox(viewedBounds)
      : MapPresetsService.listPresets();
    return getMissingRegionPrompt({
      latitude: center[1],
      longitude: center[0],
      viewedBounds,
      regions: regionsInView.length ? regionsInView : MapPresetsService.listPresets(),
      downloadedRegions: regions,
      zoom,
    });
  }, [activePanel, center, isPlacing, regions, viewedBounds, zoom, catalogVersion]);

  async function load(options: { syncNative?: boolean } = {}) {
    if (options.syncNative) await OfflineMapService.syncNativePacks();
    const [nextRegions, nextMarkers, nextRoutes] = await Promise.all([
      OfflineMapService.listRegions(),
      OfflineMapService.listMarkers(),
      OfflineMapService.listRoutes(),
    ]);
    setRegions(nextRegions);
    setMarkers(nextMarkers);
    setRoutes(nextRoutes);
  }

  React.useEffect(() => {
    void load({ syncNative: true });
    void focusUserLocation({ requestPermission: true, centerMap: true, showBusy: false });
    MapService.loadMapLibre()
      .then(setMaplibre)
      .finally(() => setMaplibreChecked(true));
    MapPresetsService.refreshCatalog()
      .then((meta) => {
        setCatalogMeta(meta);
        setCatalogVersion((version) => version + 1);
      })
      .catch(() => undefined);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void load({ syncNative: true });
    }, [])
  );

  React.useEffect(() => {
    navigation.setOptions({
      tabBarStyle: fullscreen ? { display: 'none' } : undefined,
    });
    return () => navigation.setOptions({ tabBarStyle: undefined });
  }, [fullscreen, navigation]);

  React.useEffect(() => {
    activeMapKeyRef.current = mapInstanceKey;
    setMapReady(false);
    cameraRef.current = null;
    autoFocusedRegionIdRef.current = null;
  }, [canMountMap, mapInstanceKey]);

  React.useEffect(() => {
    if (!maplibre || !nativeMapAvailable) return;
    MapService.setNetworkConnected(maplibre, hasActiveMapDownloads);
    return () => MapService.setNetworkConnected(maplibre, true);
  }, [maplibre, nativeMapAvailable, hasActiveMapDownloads]);

  React.useEffect(() => {
    const action = pendingCameraActionRef.current;
    if (!action || !mapReady || !canMountMap) return;
    if (runCameraAction(cameraRef.current, action)) pendingCameraActionRef.current = null;
  }, [mapReady, canMountMap]);

  React.useEffect(() => {
    if (selectedMarkerId && !markers.some((marker) => marker.id === selectedMarkerId)) {
      setSelectedMarkerId(null);
    }
  }, [markers, selectedMarkerId]);

  React.useEffect(() => {
    if (
      userLocation ||
      !primaryDownloadedRegion ||
      autoFocusedRegionIdRef.current === primaryDownloadedRegion.id
    ) {
      return;
    }
    if (!regionBounds(primaryDownloadedRegion)) return;
    autoFocusedRegionIdRef.current = primaryDownloadedRegion.id;
    fitRegion(primaryDownloadedRegion);
  }, [primaryDownloadedRegion?.id, mapReady, canMountMap, userLocation]);

  React.useEffect(() => {
    const targetMarkerId = Array.isArray(markerId) ? markerId[0] : markerId;
    if (!targetMarkerId) return;
    const marker = markers.find((item) => item.id === targetMarkerId);
    if (!marker) return;
    setSelectedMarkerId(marker.id);
    centerOn([marker.longitude, marker.latitude], 15);
  }, [markerId, markers, mapReady, canMountMap]);

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
  }, [catalogVersion, markers, regions, routes, search]);

  React.useEffect(() => {
    setRecommendedPresets(MapPresetsService.recommendedForLocation(userLocation));
  }, [catalogVersion, userLocation]);

  // (suggestion is now computed via useMemo — no debounced effect needed)

  const closeSearchKeyboard = React.useCallback(() => {
    searchGestureSuppressUntilRef.current = Date.now() + SEARCH_GESTURE_SUPPRESS_MS;
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    setSearchFocused(false);
    setTopMode('compact');
  }, []);

  React.useEffect(() => {
    const visible = compassVisible;
    searchRightInset.value = withTiming(
      visible ? SEARCH_INSET_WITH_COMPASS : SEARCH_INSET_WITHOUT_COMPASS,
      { duration: 140, easing: Easing.out(Easing.quad) }
    );
  }, [compassVisible, searchRightInset]);

  React.useEffect(() => {
    if (!searchFocused && topMode !== 'search') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSearchKeyboard();
      return true;
    });
    return () => subscription.remove();
  }, [closeSearchKeyboard, searchFocused, topMode]);

  React.useEffect(() => {
    if (!searchFocused && topMode !== 'search') return undefined;
    return navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();
      closeSearchKeyboard();
    });
  }, [closeSearchKeyboard, navigation, searchFocused, topMode]);

  function openSpotDialog(lngLat: LngLat) {
    setPendingSpot(lngLat);
    setSpotTitle('');
    setSpotDescription('');
    setSpotPhotoUri(null);
    setSpotPinType('custom');
    setSpotEmergency(false);
  }

  async function cancelSpotDialog() {
    if (spotPhotoUri) await FileSystemService.deleteByUri(spotPhotoUri).catch(() => undefined);
    setPendingSpot(null);
    setSpotPhotoUri(null);
    setSpotPinType('custom');
    setSpotEmergency(false);
  }

  async function pickSpotPhoto(source: 'camera' | 'library') {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showSheetAlert('Permission needed', 'Camera access is required to take spot photos.');
        return null;
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showSheetAlert(
          'Permission needed',
          'Photo library access is required to choose spot photos.'
        );
        return null;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
          });
    if (result.canceled || !result.assets[0]) return null;
    const asset = result.assets[0];
    return FileSystemService.copyToAppDirectory({
      sourceUri: asset.uri,
      directory: 'maps',
      fileName: `spot-${Date.now()}.jpg`,
    });
  }

  async function attachSpotPhoto(source: 'camera' | 'library' = 'camera') {
    const savedUri = await pickSpotPhoto(source);
    if (!savedUri) return;
    if (spotPhotoUri) await FileSystemService.deleteByUri(spotPhotoUri).catch(() => undefined);
    setSpotPhotoUri(savedUri);
  }

  function openEditMarker(marker: MapMarker) {
    setEditingMarker(marker);
    setEditTitle(marker.title);
    setEditDescription(marker.description ?? '');
    setEditPhotoUri(marker.photoUri);
    setEditPinType(marker.pinType);
    setEditEmergency(marker.isEmergencyPin);
  }

  async function cancelEditMarker() {
    if (editPhotoUri && editPhotoUri !== editingMarker?.photoUri) {
      await FileSystemService.deleteByUri(editPhotoUri).catch(() => undefined);
    }
    setEditingMarker(null);
    setEditTitle('');
    setEditDescription('');
    setEditPhotoUri(null);
    setEditPinType('custom');
    setEditEmergency(false);
  }

  async function attachEditPhoto(source: 'camera' | 'library') {
    const savedUri = await pickSpotPhoto(source);
    if (!savedUri) return;
    if (editPhotoUri && editPhotoUri !== editingMarker?.photoUri) {
      await FileSystemService.deleteByUri(editPhotoUri).catch(() => undefined);
    }
    setEditPhotoUri(savedUri);
  }

  async function removeEditPhoto() {
    if (editPhotoUri && editPhotoUri !== editingMarker?.photoUri) {
      await FileSystemService.deleteByUri(editPhotoUri).catch(() => undefined);
    }
    setEditPhotoUri(null);
  }

  async function saveMarkerEdit() {
    if (!editingMarker || !editTitle.trim()) {
      setError('Add a name before saving this spot.');
      return;
    }
    setBusy(`marker:${editingMarker.id}`);
    setError(null);
    try {
      await OfflineMapService.updateMarker(editingMarker.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        pinType: editPinType,
        isEmergencyPin: editEmergency,
        photoUri: editPhotoUri,
      });
      setSelectedMarkerId(editingMarker.id);
      setEditingMarker(null);
      setEditTitle('');
      setEditDescription('');
      setEditPhotoUri(null);
      setEditPinType('custom');
      setEditEmergency(false);
      await load();
    } catch {
      setError('Unable to update this spot.');
    } finally {
      setBusy(null);
    }
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
        pinType: spotPinType,
        isEmergencyPin: spotEmergency,
        longitude: pendingSpot[0],
        latitude: pendingSpot[1],
        photoUri: spotPhotoUri,
      });
      setPendingSpot(null);
      setSpotPhotoUri(null);
      setSpotPinType('custom');
      setSpotEmergency(false);
      await load();
    } catch {
      setError('Unable to save this spot.');
    } finally {
      setBusy(null);
    }
  }

  async function locateMe() {
    await focusUserLocation({ requestPermission: true, centerMap: true, showBusy: true });
  }

  async function openLocationSettings() {
    await Linking.openSettings().catch(() => undefined);
  }

  async function focusUserLocation({
    requestPermission,
    centerMap: shouldCenterMap,
    showBusy,
  }: {
    requestPermission: boolean;
    centerMap: boolean;
    showBusy: boolean;
  }) {
    if (showBusy) setBusy('locate');
    setError(null);
    try {
      const resolution = await MapLocationService.resolveUserLocation(
        {
          requestPermission,
          showUserSettingsDialog: showBusy,
        },
        (lastKnown) => {
          applyUserPosition(lastKnown, shouldCenterMap, 15, showBusy ? 180 : 0);
          if (showBusy) setBusy(null);
        }
      );
      if (resolution.issue?.kind === 'permission_denied') {
        setLocationIssue(resolution.issue);
        return;
      }
      setLocationIssue(null);

      if (resolution.current) {
        setLocationIssue(null);
        const shouldMoveToFreshPosition =
          shouldCenterMap ||
          !resolution.lastKnown ||
          centerDistance(locationToCenter(resolution.lastKnown), locationToCenter(resolution.current)) >
            CENTER_UPDATE_EPSILON_DEGREES;
        applyUserPosition(resolution.current, shouldMoveToFreshPosition, 15, showBusy ? 260 : 420);
      } else if (resolution.issue) {
        setLocationIssue(resolution.issue);
      }
    } catch {
      setLocationIssue({ kind: 'unavailable' });
    } finally {
      if (showBusy) setBusy(null);
    }
  }

  function applyUserPosition(
    position: LocationObject,
    shouldCenterMap: boolean,
    zoom: number,
    duration: number
  ) {
    const nextLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    setUserLocation((current) =>
      current && sameLocation(current, nextLocation) ? current : nextLocation
    );
    setLocationIssue(null);
    if (shouldCenterMap) centerOn([nextLocation.longitude, nextLocation.latitude], zoom, duration);
  }

  async function downloadPreset(preset: MapPreset) {
    setBusy(`download:${preset.id}`);
    setError(null);
    try {
      MapService.setNetworkConnected(maplibre, true);
      const result = await startPresetRegionDownload(preset, {
        catalogVersion: catalogMeta.version,
        regions,
        theme,
      });
      if (!result.ok) setError(result.reason ?? 'Unable to download this map region.');
    } finally {
      await load({ syncNative: true });
      setBusy(null);
    }
  }

  async function startDownload(regionId: string) {
    setBusy(`download:${regionId}`);
    setError(null);
    try {
      MapService.setNetworkConnected(maplibre, true);
      const result = await OfflineMapService.refreshRegion(regionId);
      if (!result.ok) setError(result.reason ?? 'Unable to download this map region.');
    } finally {
      await load({ syncNative: true });
      setBusy(null);
    }
  }

  async function pauseRegion(region: MapRegion) {
    await OfflineMapService.pauseRegion(region.id);
    await load({ syncNative: true });
  }

  async function deleteRegion(region: MapRegion) {
    showSheetAlert('Delete offline region?', region.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await OfflineMapService.deleteRegion(region.id);
          await load({ syncNative: true });
        },
      },
    ]);
  }

  async function deleteMarker(marker: MapMarker) {
    showSheetAlert('Delete spot?', marker.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await OfflineMapService.deleteMarker(marker.id);
          if (selectedMarkerId === marker.id) setSelectedMarkerId(null);
          if (editingMarker?.id === marker.id) setEditingMarker(null);
          await load();
        },
      },
    ]);
  }

  async function deleteRoute(route: SavedRoute) {
    showSheetAlert('Delete route?', route.title, [
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

  async function downloadMissingRegion(preset: MapPreset) {
    await downloadPreset(preset);
  }

  function centerOn(nextCenter: LngLat, zoom = 13, duration = 420) {
    setCenter(nextCenter);
    mapCenterRef.current = nextCenter;
    queueCameraAction({
      type: 'center',
      center: nextCenter,
      zoom,
      duration,
    });
  }

  function resetNorth() {
    compassResetSuppressUntilRef.current = Date.now() + COMPASS_RESET_SUPPRESS_MS;
    mapBearingRef.current = 0;
    setMapBearing(0);
    if (!mapReady || !canMountMap) return;
    cameraRef.current?.easeTo?.({
      center,
      bearing: 0,
      duration: 220,
    });
  }

  function fitRegion(region: MapRegion) {
    const bounds = regionBounds(region);
    if (!bounds) return;
    const [west, south, east, north] = bounds;
    const nextCenter: LngLat = [(west + east) / 2, (south + north) / 2];
    setCenter(nextCenter);
    mapCenterRef.current = nextCenter;
    queueCameraAction({
      type: 'bounds',
      bounds: [west, south, east, north],
      padding: 42,
      duration: 650,
    });
  }

  function centerOnRoute(route: SavedRoute) {
    const bounds = routeBounds(route);
    if (!bounds) return;
    const [west, south, east, north] = bounds;
    const nextCenter: LngLat = [(west + east) / 2, (south + north) / 2];
    setCenter(nextCenter);
    mapCenterRef.current = nextCenter;
    queueCameraAction({
      type: 'bounds',
      bounds: [west, south, east, north],
      padding: 64,
      duration: 650,
    });
  }

  function queueCameraAction(action: CameraAction) {
    pendingCameraActionRef.current = action;
    if (!mapReady || !canMountMap) return;
    if (runCameraAction(cameraRef.current, action)) pendingCameraActionRef.current = null;
    else {
      requestAnimationFrame(() => {
        if (pendingCameraActionRef.current !== action) return;
        if (runCameraAction(cameraRef.current, action)) pendingCameraActionRef.current = null;
      });
    }
  }

  function openSearchResult(result: OfflineMapSearchResult) {
    setSearch('');
    setTopMode('compact');
    setSearchFocused(false);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
    if (result.kind === 'spot' && result.longitude != null && result.latitude != null) {
      centerOn([result.longitude, result.latitude], 14);
      setSelectedMarkerId(result.id);
      return;
    }
    if (result.kind === 'region') {
      const region = regions.find((item) => item.id === result.id);
      if (region) fitRegion(region);
      else if (result.longitude != null && result.latitude != null) {
        centerOn([result.longitude, result.latitude], 10);
      }
      return;
    }
    const route = routes.find((item) => item.id === result.id);
    if (route) centerOnRoute(route);
  }

  const handleBearingChange = React.useCallback((bearing: number) => {
    if (Date.now() < compassResetSuppressUntilRef.current) return;
    const normalized = normalizeBearing(bearing);
    if (bearingDelta(mapBearingRef.current, normalized) < BEARING_UPDATE_EPSILON_DEGREES) return;
    mapBearingRef.current = normalized;
    setMapBearing(normalized);
  }, []);

  const handleCenterChange = React.useCallback((nextCenter: LngLat) => {
    if (!isFiniteLngLat(nextCenter)) return;
    if (centerDistance(mapCenterRef.current, nextCenter) < CENTER_UPDATE_EPSILON_DEGREES) return;
    mapCenterRef.current = nextCenter;
    setCenter(nextCenter);
  }, []);

  const handleZoomChange = React.useCallback((nextZoom: number) => {
    if (!Number.isFinite(nextZoom)) return;
    if (Math.abs(mapZoomRef.current - nextZoom) < 0.05) return;
    mapZoomRef.current = nextZoom;
    setZoom(nextZoom);
  }, []);

  const mapStatus = nativeMapAvailable
    ? 'Low-detail world overview is available without network tiles.'
    : status.reason;

  const activeDownloadingRegion = React.useMemo(() => {
    return regions.find((r) => r.status === 'downloading' || r.status === 'queued') || null;
  }, [regions]);

  return (
    <View className="bg-background flex-1">
      <MapCanvas
        cameraRef={cameraRef}
        canMount={canMountMap}
        center={mapInitialCenter}
        fullscreen={fullscreen}
        hasDownloadedRegion={hasDownloadedRegion}
        initialZoom={mapInitialZoom}
        isSearchActive={searchFocused || topMode === 'search'}
        mapBearing={mapBearing}
        mapKey={mapInstanceKey}
        mapStyle={mapStyle}
        maplibre={maplibre}
        markers={visibleMarkers}
        routes={routes}
        selectedMarker={selectedMarker}
        status={mapStatus}
        suppressLongPressUntilRef={searchGestureSuppressUntilRef}
        userLocation={userLocation}
        onBearingChange={handleBearingChange}
        onBoundsChange={setViewedBounds}
        onCenterChange={handleCenterChange}
        onZoomChange={handleZoomChange}
        onCloseMarkerPopup={() => setSelectedMarkerId(null)}
        onDismissSearch={closeSearchKeyboard}
        onLongPress={openSpotDialog}
        onMapLoadFailed={() =>
          setError(
            hasDownloadedRegion
              ? 'Offline map pack is incomplete or unavailable. Retry the map download while online.'
              : 'Map source failed to load. Select a downloaded map or retry with internet.'
          )
        }
        onMapReady={(readyKey) => {
          if (readyKey === activeMapKeyRef.current) setMapReady(true);
        }}
        onMapUnmount={(deadKey) => {
          if (deadKey === activeMapKeyRef.current) {
            setMapReady(false);
            setViewedBounds(null);
            cameraRef.current = null;
          }
        }}
        onMarkerPress={(marker) => {
          centerOn([marker.longitude, marker.latitude], 14);
          setSelectedMarkerId(marker.id);
        }}
      />

      {!isPlacing && !fullscreen ? (
        <Animated.View
          layout={LinearTransition}
          className="absolute left-3 gap-2"
          style={[{ top: 6 }, animatedSearchStyle]}>
          <TopMapControls
            mode={topMode}
            noDownloadedRegions={!hasDownloadedRegion}
            offlineResults={offlineResults}
            searchInputRef={searchInputRef}
            search={search}
            onChangeFocus={setSearchFocused}
            onChangeMode={setTopMode}
            onChangeSearch={setSearch}
            onCloseSearch={closeSearchKeyboard}
            onOpenResult={openSearchResult}
          />
        </Animated.View>
      ) : null}

      {!isPlacing && !fullscreen ? (
        <CompassButton bearing={mapBearing} top={6} visible={compassVisible} onPress={resetNorth} />
      ) : null}

      {!isPlacing ? (
        <View
          className="absolute right-3 gap-2"
          style={{ bottom: fullscreen ? Math.max(insets.bottom + 12, 32) : 12 }}>
          <MapFab label="Locate me" loading={busy === 'locate'} onPress={locateMe} text="Me" />
          <MapFab
            icon={MapPin}
            label="Add spot"
            onPress={() => {
              setSelectedMarkerId(null);
              setIsPlacing(true);
            }}
          />
          <MapFab icon={List} label="Saved data" onPress={() => setActivePanel('saved')} />
          <MapFab
            icon={fullscreen ? Minimize2 : Maximize2}
            label={fullscreen ? 'Exit full map' : 'Fullscreen'}
            onPress={() => setFullscreen((value) => !value)}
          />
        </View>
      ) : null}

      <View
        className="absolute left-3 w-72 gap-2"
        style={{ bottom: fullscreen ? Math.max(insets.bottom + 12, 32) : 12 }}>
        {locationIssue && !userLocation ? (
          <LocationNoticeCard
            issue={locationIssue}
            loading={busy === 'locate'}
            onOpenSettings={openLocationSettings}
            onRetry={locateMe}
          />
        ) : null}
        {error ? (
          <Card className="border-destructive bg-background/95 flex-row items-start gap-2 p-3">
            <Icon as={AlertTriangle} className="text-destructive mt-0.5 size-4" />
            <Text className="text-destructive flex-1 text-sm">{error}</Text>
          </Card>
        ) : null}
      </View>

      {isPlacing ? (
        <View className="absolute inset-0 items-center justify-center" pointerEvents="box-none">
          <View className="bg-primary/20 border-primary/40 size-20 items-center justify-center rounded-full border-2">
            <View className="bg-primary size-2 rounded-full" />
            <View className="bg-primary absolute h-8 w-0.5" />
            <View className="bg-primary absolute h-0.5 w-8" />
          </View>
          <View
            className="absolute right-3 left-3 flex-row gap-2"
            style={{ bottom: fullscreen ? Math.max(insets.bottom + 6, 10) : 6 }}>
            <Button
              className="bg-background/95 h-12 flex-1"
              variant="outline"
              onPress={() => setIsPlacing(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button
              className="h-12 flex-1 shadow-lg"
              onPress={() => {
                setIsPlacing(false);
                openSpotDialog(center);
              }}>
              <Icon as={Check} className="size-4" />
              <Text>Confirm</Text>
            </Button>
          </View>
        </View>
      ) : null}

      <SavedDataPanel
        markers={filteredMarkers}
        routes={routes}
        search={savedSearch}
        visible={activePanel === 'saved'}
        onChangeSearch={setSavedSearch}
        onClose={() => setActivePanel(null)}
        onDeleteMarker={deleteMarker}
        onDeleteRoute={deleteRoute}
        onEditMarker={openEditMarker}
        onFocusMarker={(marker) => {
          centerOn([marker.longitude, marker.latitude], 14);
          setSelectedMarkerId(marker.id);
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
        isEmergency={spotEmergency}
        lngLat={pendingSpot}
        photoUri={spotPhotoUri}
        pinType={spotPinType}
        title={spotTitle}
        onAttachPhoto={attachSpotPhoto}
        onCancel={cancelSpotDialog}
        onChangeDescription={setSpotDescription}
        onChangeEmergency={setSpotEmergency}
        onChangePinType={setSpotPinType}
        onChangeTitle={setSpotTitle}
        onRemovePhoto={async () => {
          if (spotPhotoUri)
            await FileSystemService.deleteByUri(spotPhotoUri).catch(() => undefined);
          setSpotPhotoUri(null);
        }}
        onSave={saveSpot}
      />

      <EditSpotDialog
        busy={Boolean(editingMarker && busy === `marker:${editingMarker.id}`)}
        description={editDescription}
        isEmergency={editEmergency}
        marker={editingMarker}
        photoUri={editPhotoUri}
        pinType={editPinType}
        title={editTitle}
        onAttachPhoto={attachEditPhoto}
        onCancel={cancelEditMarker}
        onChangeDescription={setEditDescription}
        onChangeEmergency={setEditEmergency}
        onChangePinType={setEditPinType}
        onChangeTitle={setEditTitle}
        onRemovePhoto={removeEditPhoto}
        onSave={saveMarkerEdit}
      />

      <MissingRegionPromptModal
        visible={Boolean(visibleMissingRegionPrompt && netInfo.isConnected)}
        busy={Boolean(visibleMissingRegionPrompt && busy === `download:${visibleMissingRegionPrompt.id}`)}
        region={visibleMissingRegionPrompt}
        downloadingRegion={
          activeDownloadingRegion &&
          visibleMissingRegionPrompt &&
          (activeDownloadingRegion.manifestRegionId === visibleMissingRegionPrompt.id ||
           activeDownloadingRegion.name === visibleMissingRegionPrompt.name)
            ? activeDownloadingRegion
            : null
        }
        onDownload={(updatedPreset) => {
          if (updatedPreset) downloadMissingRegion(updatedPreset);
          else if (visibleMissingRegionPrompt) downloadMissingRegion(visibleMissingRegionPrompt);
        }}
      />
    </View>
  );
}

function MapCanvas({
  cameraRef,
  canMount,
  center,
  fullscreen,
  hasDownloadedRegion,
  initialZoom,
  isSearchActive,
  mapBearing,
  mapKey,
  mapStyle,
  maplibre,
  markers,
  routes,
  selectedMarker,
  status,
  suppressLongPressUntilRef,
  userLocation,
  onBearingChange,
  onBoundsChange,
  onCenterChange,
  onZoomChange,
  onCloseMarkerPopup,
  onDismissSearch,
  onLongPress,
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
  mapKey: string;
  mapStyle: unknown;
  maplibre: MapLibreModule | null;
  markers: MapMarker[];
  routes: SavedRoute[];
  selectedMarker: MapMarker | null;
  status: string;
  suppressLongPressUntilRef: React.MutableRefObject<number>;
  userLocation: { latitude: number; longitude: number } | null;
  onBearingChange: (bearing: number) => void;
  onBoundsChange: (bounds: MapViewBounds | null) => void;
  onCenterChange: (center: LngLat) => void;
  onZoomChange?: (zoom: number) => void;
  onCloseMarkerPopup: () => void;
  onDismissSearch: () => void;
  onLongPress: (center: LngLat) => void;
  onMapLoadFailed: () => void;
  onMapReady: (mapKey: string) => void;
  onMapUnmount: (mapKey: string) => void;
  onMarkerPress: (marker: MapMarker) => void;
}) {
  const Map = getMapComponent(maplibre);
  const Camera = getCameraComponent(maplibre);
  const GeoJSONSource = getGeoJSONSourceComponent(maplibre);
  const Layer = getLayerComponent(maplibre);
  const Marker = getMarkerComponent(maplibre);
  const routeData = React.useMemo(() => routeFeatureCollection(routes), [routes]);
  const markerData = React.useMemo(() => markerFeatureCollection(markers), [markers]);
  const overviewData = React.useMemo(() => worldOverviewFeatureCollection(), []);

  React.useEffect(() => () => onMapUnmount(mapKey), [mapKey]);

  if (!Map || !Camera || !canMount) {
    return <WorldOverviewFallback status={status} />;
  }

  return (
    <Map
      key={mapKey}
      style={{ flex: 1 }}
      mapStyle={mapStyle as never}
      logo={false}
      attribution={false}
      compass={false}
      scaleBar={fullscreen}
      onDidFailLoadingMap={onMapLoadFailed}
      onDidFinishLoadingMap={() => onMapReady(mapKey)}
      onPress={() => {
        if (isSearchActive) onDismissSearch();
        else Keyboard.dismiss();
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
        const nextZoom = event.nativeEvent.zoom ?? event.nativeEvent.zoomLevel ?? event.nativeEvent.properties?.zoomLevel;
        if (nextZoom != null) {
          onZoomChange?.(nextZoom);
        }
      }}>
      <Camera
        ref={cameraRef}
        initialViewState={{
          center,
          zoom: hasDownloadedRegion ? initialZoom : WORLD_OVERVIEW_ZOOM,
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
      {!hasDownloadedRegion && GeoJSONSource && Layer ? (
        <GeoJSONSource id="ark-world-overview" data={overviewData}>
          <Layer
            id="ark-world-land"
            type="fill"
            paint={{
              fillColor: '#2f3a2a',
              fillOpacity: 0.72,
            }}
          />
          <Layer
            id="ark-world-coast"
            type="line"
            paint={{
              lineColor: '#95a78b',
              lineOpacity: 0.75,
              lineWidth: 1,
            }}
          />
        </GeoJSONSource>
      ) : null}
      {GeoJSONSource && Layer && routes.length ? (
        <GeoJSONSource id="ark-routes" data={routeData}>
          <Layer
            id="ark-routes-line"
            type="line"
            paint={{
              lineColor: '#95a78b',
              lineOpacity: 0.92,
              lineWidth: 4,
            }}
            layout={{
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </GeoJSONSource>
      ) : null}
      {GeoJSONSource && Layer && markers.length ? (
        <GeoJSONSource
          id="ark-markers"
          data={markerData}
          hitbox={{ top: 18, right: 18, bottom: 18, left: 18 }}
          onPress={(event: any) => {
            const markerId = event.nativeEvent.features?.[0]?.properties?.markerId;
            const marker = markers.find((item) => item.id === markerId);
            if (marker) onMarkerPress(marker);
          }}>
          <Layer
            id="ark-marker-halo"
            type="circle"
            paint={{
              circleColor: '#050316',
              circleOpacity: 0.95,
              circleRadius: ['interpolate', ['linear'], ['zoom'], 6, 5, 14, 8],
              circleStrokeColor: '#F2B84B',
              circleStrokeWidth: 2,
            }}
          />
          <Layer
            id="ark-marker-core"
            type="circle"
            paint={{
              circleColor: '#F2B84B',
              circleOpacity: 1,
              circleRadius: ['interpolate', ['linear'], ['zoom'], 6, 2.5, 14, 4.5],
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
              <MarkerDot marker={marker} selected={selectedMarker?.id === marker.id} />
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
          <MarkerPopup marker={selectedMarker} onClose={onCloseMarkerPopup} />
        </Marker>
      ) : null}
    </Map>
  );
}

function LocationNoticeCard({
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

function MissingRegionPromptModal({
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
    if (visible && region?.id.startsWith('dynamic-')) {
      const { center } = region;
      if (center) {
        import('@/services/maps/geocoding.service').then(({ GeocodingService }) => {
          GeocodingService.reverseGeocode(center[1], center[0]).then((result) => {
             if (result.bounds) {
               setDynamicPreset({
                 ...region,
                 name: result.name,
                 bounds: result.bounds,
                 bbox: [result.bounds.west, result.bounds.south, result.bounds.east, result.bounds.north],
                 estimatedSizeMb: 450,
                 estimatedSize: '450 MB',
               });
             } else {
               setDynamicPreset({ ...region, name: result.name });
             }
          });
        });
      }
    } else {
      setDynamicPreset(null);
    }
  }, [visible, region]);

  if (!visible || !region) return null;

  const activeRegion = dynamicPreset || region;
  const size = activeRegion?.estimatedSizeMb
    ? `About ${Math.round(activeRegion.estimatedSizeMb)} MB`
    : activeRegion?.estimatedSize;
  const name = activeRegion?.name || downloadingRegion?.name;
  const preset = activeRegion;
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
        <Card className="border-primary/35 bg-background/95 gap-4 p-5 shadow-2xl" pointerEvents="auto">
          <View className="items-center gap-1">
            <Text variant="h3" className="text-center">{name}</Text>
            {downloadingRegion ? (
              <Text className="text-muted-foreground font-medium text-sm">
                Downloading... {Math.round((downloadingRegion.progress || 0) * 100)}%
              </Text>
            ) : (
              <Text className="text-muted-foreground font-medium text-sm">{size}</Text>
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
              {busy ? <ActivityIndicator size="small" /> : <Icon as={Download} className="size-4" />}
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

function CompassButton({
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
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = NAV_COLORS[theme];
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
  return (
    <View className="bg-background flex-1">
      <View className="absolute inset-0">
        <Svg viewBox="0 0 360 180" preserveAspectRatio="xMidYMid slice" style={{ flex: 1 }}>
          <Path d="M0 0H360V180H0Z" fill="#181d16" />
          {WORLD_OVERVIEW_PATHS.map((path) => (
            <Path key={path} d={path} fill="#2f3a2a" stroke="#95a78b" strokeWidth={0.9} />
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

function MarkerDot({ marker, selected }: { marker: MapMarker; selected: boolean }) {
  const color = marker.color || getMapPinMeta(marker.pinType).color;
  const PinIcon = iconForPinType(marker.pinType);
  return (
    <View
      style={{
        width: selected || marker.isEmergencyPin ? 26 : 20,
        height: selected || marker.isEmergencyPin ? 26 : 20,
        borderRadius: 999,
        backgroundColor: '#050316',
        borderColor: marker.isEmergencyPin ? '#FFFFFF' : color,
        borderWidth: marker.isEmergencyPin ? 3 : selected ? 3 : 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: selected || marker.isEmergencyPin ? 15 : 12,
          height: selected || marker.isEmergencyPin ? 15 : 12,
          backgroundColor: color,
        }}>
        <Icon as={PinIcon} className="text-background size-3.5" />
      </View>
    </View>
  );
}

function UserLocationDot({ mapBearing }: { mapBearing: number }) {
  const heading = useSensorStore((state) => state.heading);

  return (
    <View className="items-center justify-center">
      {heading !== null ? (
        <View
          className="absolute"
          style={{ transform: [{ rotate: `${heading - mapBearing}deg` }] }}>
          <Svg width={100} height={100} viewBox="0 0 100 100">
            <Path
              d="M50 50 L75 5 A 40 40 0 0 0 25 5 Z"
              fill="rgba(149, 167, 139, 0.45)"
            />
          </Svg>
        </View>
      ) : null}
      <View className="bg-primary/20 size-9 items-center justify-center rounded-full">
        <View className="border-background bg-primary size-5 rounded-full border-4" />
      </View>
    </View>
  );
}

function iconForPinType(type: MapPinType) {
  if (type === 'home') return Home;
  if (type === 'meeting_point') return Users;
  return MapPin;
}

function TopMapControls({
  mode,
  noDownloadedRegions,
  offlineResults,
  searchInputRef,
  search,
  onChangeFocus,
  onChangeMode,
  onChangeSearch,
  onCloseSearch,
  onOpenResult,
}: {
  mode: TopMode;
  noDownloadedRegions: boolean;
  offlineResults: OfflineMapSearchResult[];
  searchInputRef: React.RefObject<TextInput | null>;
  search: string;
  onChangeFocus: (focused: boolean) => void;
  onChangeMode: (mode: TopMode) => void;
  onChangeSearch: (value: string) => void;
  onCloseSearch: () => void;
  onOpenResult: (result: OfflineMapSearchResult) => void;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        <Animated.View layout={TOP_TRANSITION} className="flex-1">
          <View className="border-border bg-card/95 h-12 flex-row items-center gap-2 rounded-lg border px-3">
            <Icon as={Search} className="text-muted-foreground size-4" />
            <Input
              ref={searchInputRef}
              className="h-8 min-h-0 flex-1 border-0 bg-transparent px-0 py-0"
              value={search}
              onChangeText={onChangeSearch}
              onFocus={() => {
                onChangeFocus(true);
                onChangeMode('search');
              }}
              onBlur={() => {
                onChangeFocus(false);
              }}
              placeholder="Search map and saved data"
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
                  onCloseSearch();
                }}>
                <Icon as={X} className="size-4" />
              </Button>
            ) : null}
          </View>
        </Animated.View>
      </View>

      {noDownloadedRegions ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}>
          <View className="border-primary/40 bg-card/95 flex-row items-center gap-2 self-start rounded-full border px-3 py-2">
            <Icon as={AlertTriangle} className="text-primary size-4" />
            <Text variant="small">No downloaded map regions</Text>
          </View>
        </Animated.View>
      ) : null}

      {mode === 'search' && search.trim().length >= 2 ? (
        <Animated.View entering={FadeIn.duration(120)} exiting={FadeOut.duration(100)}>
          <Card className="gap-1 p-2">
            {offlineResults.length ? (
              offlineResults.map((result) => (
                <Button
                  key={`${result.kind}:${result.id}`}
                  className="h-auto min-h-14 items-start justify-start px-2 py-2"
                  variant="ghost"
                  onPress={() => onOpenResult(result)}>
                  <Icon
                    as={iconForSearchResult(result.kind)}
                    className="text-primary mt-0.5 size-4"
                  />
                  <View className="min-w-0 flex-1 items-start gap-1">
                    <Text className="text-sm leading-5" numberOfLines={1}>
                      {result.title}
                    </Text>
                    <Text
                      variant="small"
                      className="text-muted-foreground leading-4"
                      numberOfLines={2}>
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

function SavedDataPanel({
  markers,
  routes,
  search,
  visible,
  onChangeSearch,
  onClose,
  onDeleteMarker,
  onDeleteRoute,
  onEditMarker,
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
  onEditMarker: (marker: MapMarker) => void;
  onFocusMarker: (marker: MapMarker) => void;
  onFocusRoute: (route: SavedRoute) => void;
}) {
  return (
    <Panel title="Saved spots and routes" visible={visible} onClose={onClose}>
      {({ expand }) => (
        <>
          <Input
            value={search}
            onChangeText={onChangeSearch}
            placeholder="Filter saved spots"
            autoCapitalize="none"
            onFocus={expand}
          />

          <View className="gap-2">
            <Text variant="large">Spots</Text>
            {markers.length ? (
              markers.map((marker) => (
                <SavedRow
                  key={marker.id}
                  color={marker.color || getMapPinMeta(marker.pinType).color}
                  emergency={marker.isEmergencyPin}
                  icon={iconForPinType(marker.pinType)}
                  photoUri={marker.photoUri}
                  title={marker.title}
                  subtitle={`${getMapPinMeta(marker.pinType).label}${
                    marker.isEmergencyPin ? ' · Emergency' : ''
                  } · ${marker.description ?? formatPoint(marker.latitude, marker.longitude)}`}
                  onPress={() => onFocusMarker(marker)}
                  onEdit={() => onEditMarker(marker)}
                  onDelete={() => onDeleteMarker(marker)}
                />
              ))
            ) : (
              <Text variant="muted">No saved spots match this filter.</Text>
            )}
          </View>
        </>
      )}
    </Panel>
  );
}

function SavedRow({
  color,
  emergency,
  icon,
  photoUri,
  title,
  subtitle,
  onDelete,
  onEdit,
  onPress,
}: {
  color?: string;
  emergency?: boolean;
  icon: React.ComponentProps<typeof Icon>['as'];
  photoUri?: string | null;
  title: string;
  subtitle: string;
  onDelete: () => void;
  onEdit: () => void;
  onPress: () => void;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <Pressable className="min-w-0 flex-1 flex-row items-center gap-3" onPress={onPress}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} className="bg-muted size-10 rounded-md" />
        ) : (
          <View
            className="size-10 items-center justify-center rounded-md"
            style={{ backgroundColor: `${color ?? '#F2B84B'}26` }}>
            <Icon as={icon} className="text-primary size-5" />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1">
            <Text className="min-w-0 flex-1" numberOfLines={1}>
              {title}
            </Text>
            {emergency ? <Icon as={Star} className="text-primary size-3.5" /> : null}
          </View>
          <Text variant="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      <Button accessibilityLabel={`Edit ${title}`} size="icon" variant="outline" onPress={onEdit}>
        <Icon as={Pencil} className="size-4" />
      </Button>
      <Button
        accessibilityLabel={`Delete ${title}`}
        size="icon"
        variant="outline"
        onPress={onDelete}>
        <Icon as={Trash2} className="size-4" />
      </Button>
    </Card>
  );
}

function PinTypeSelector({
  emergency,
  value,
  onChangeEmergency,
  onChangeValue,
}: {
  emergency: boolean;
  value: MapPinType;
  onChangeEmergency: (value: boolean) => void;
  onChangeValue: (value: MapPinType) => void;
}) {
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

function MarkerPopup({ marker, onClose }: { marker: MapMarker; onClose: () => void }) {
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
          borderTopColor: '#F2B84B',
        }}
      />
    </View>
  );
}

function Panel({
  children,
  title,
  visible,
  onClose,
}: {
  children: React.ReactNode | ((controls: { expand: () => void }) => React.ReactNode);
  title: string;
  visible: boolean;
  onClose: () => void;
}) {
  const sheetRef = React.useRef<any>(null);
  const expandPanel = React.useCallback(() => {
    sheetRef.current?.expand?.();
  }, []);
  const renderedChildren =
    typeof children === 'function' ? children({ expand: expandPanel }) : children;

  return (
    <ArkBottomSheet
      visible={visible}
      onDismiss={onClose}
      scrollable
      sheetRef={sheetRef}
      snapPoints={['58%', '92%']}>
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="h3" className="min-w-0 flex-1">
          {title}
        </Text>
        <Button size="icon" variant="outline" onPress={onClose}>
          <Icon as={X} className="size-4" />
        </Button>
      </View>
      {renderedChildren}
    </ArkBottomSheet>
  );
}

function SpotDialog({
  busy,
  description,
  isEmergency,
  lngLat,
  photoUri,
  pinType,
  title,
  onAttachPhoto,
  onCancel,
  onChangeDescription,
  onChangeEmergency,
  onChangePinType,
  onChangeTitle,
  onRemovePhoto,
  onSave,
}: {
  busy: boolean;
  description: string;
  isEmergency: boolean;
  lngLat: LngLat | null;
  photoUri: string | null;
  pinType: MapPinType;
  title: string;
  onAttachPhoto: (source: 'camera' | 'library') => void;
  onCancel: () => void;
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
        emergency={isEmergency}
        value={pinType}
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

function EditSpotDialog({
  busy,
  description,
  isEmergency,
  marker,
  photoUri,
  pinType,
  title,
  onAttachPhoto,
  onCancel,
  onChangeDescription,
  onChangeEmergency,
  onChangePinType,
  onChangeTitle,
  onRemovePhoto,
  onSave,
}: {
  busy: boolean;
  description: string;
  isEmergency: boolean;
  marker: MapMarker | null;
  photoUri: string | null;
  pinType: MapPinType;
  title: string;
  onAttachPhoto: (source: 'camera' | 'library') => void;
  onCancel: () => void;
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
        emergency={isEmergency}
        value={pinType}
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

function MapFab({
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

function getMapComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Map');
}

function getCameraComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Camera');
}

function getGeoJSONSourceComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'GeoJSONSource');
}

function getLayerComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Layer');
}

function getMarkerComponent(maplibre: MapLibreModule | null) {
  return getMapLibreExport(maplibre, 'Marker');
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

function markerFeatureCollection(markers: MapMarker[]) {
  return {
    type: 'FeatureCollection',
    features: markers.map((marker) => ({
      type: 'Feature',
      properties: {
        markerId: marker.id,
        title: marker.title,
      },
      geometry: {
        type: 'Point',
        coordinates: [marker.longitude, marker.latitude],
      },
    })),
  };
}

function worldOverviewFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: WORLD_OVERVIEW_POLYGONS.map((polygon, index) => ({
      type: 'Feature',
      properties: { id: `overview-${index}` },
      geometry: {
        type: 'Polygon',
        coordinates: [polygon],
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

function mapPadding(value: number) {
  return { top: value, right: value, bottom: value, left: value };
}

function runCameraAction(camera: any, action: CameraAction) {
  if (!camera) return false;
  if (action.type === 'center') {
    if (typeof camera.easeTo === 'function') {
      camera.easeTo({
        center: action.center,
        zoom: action.zoom,
        duration: action.duration,
      });
      return true;
    }
    if (typeof camera.flyTo === 'function') {
      camera.flyTo({
        center: action.center,
        zoom: action.zoom,
        duration: action.duration,
      });
      return true;
    }
    return false;
  }

  if (typeof camera.fitBounds === 'function') {
    camera.fitBounds(action.bounds, {
      padding: mapPadding(action.padding),
      duration: action.duration,
    });
    return true;
  }
  return false;
}

function regionCenter(region: MapRegion | null): LngLat | null {
  const bounds = region ? regionBounds(region) : null;
  if (!bounds) return null;
  return [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
}

function regionInitialZoom(region: MapRegion) {
  const minZoom = region.minZoom ?? OFFLINE_REGION_ZOOM;
  const maxZoom = region.maxZoom ?? Math.max(minZoom, OFFLINE_REGION_ZOOM);
  return Math.max(minZoom, Math.min(maxZoom, OFFLINE_REGION_ZOOM));
}

function isDefaultCenter(center: LngLat) {
  return center[0] === DEFAULT_CENTER[0] && center[1] === DEFAULT_CENTER[1];
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

function locationIssueCopy(issue: MapLocationIssue) {
  if (issue.kind === 'permission_denied') {
    return {
      title: 'Location is off',
      body: issue.canOpenSettings
        ? 'Enable location in system settings to center the map and show GPS coordinates.'
        : 'Allow location access to center the map and show GPS coordinates.',
      retryLabel: 'Retry',
    };
  }
  if (issue.kind === 'timeout') {
    return {
      title: 'Location not fixed',
      body: 'Move near open sky or use saved pins and downloaded regions until GPS locks.',
      retryLabel: 'Try again',
    };
  }
  return {
    title: 'Location unavailable',
    body: 'GPS is not returning a position right now. Saved pins and offline regions still work.',
    retryLabel: 'Try again',
  };
}

function formatPoint(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

function sameLocation(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number }
) {
  return (
    Math.abs(left.latitude - right.latitude) < CENTER_UPDATE_EPSILON_DEGREES &&
    Math.abs(left.longitude - right.longitude) < CENTER_UPDATE_EPSILON_DEGREES
  );
}

function isFiniteLngLat(center: LngLat) {
  return Number.isFinite(center[0]) && Number.isFinite(center[1]);
}

function normalizeMapEventBounds(bounds: unknown): MapViewBounds | null {
  if (!Array.isArray(bounds) || bounds.length !== 4) return null;
  const [west, south, east, north] = bounds;
  if (
    !Number.isFinite(west) ||
    !Number.isFinite(south) ||
    !Number.isFinite(east) ||
    !Number.isFinite(north) ||
    east <= west ||
    north <= south
  ) {
    return null;
  }
  return [west, south, east, north];
}

function centerDistance(left: LngLat, right: LngLat) {
  return Math.max(Math.abs(left[0] - right[0]), Math.abs(left[1] - right[1]));
}

function locationToCenter(position: LocationObject): LngLat {
  return [position.coords.longitude, position.coords.latitude];
}

function normalizeBearing(bearing: number) {
  return ((bearing % 360) + 360) % 360;
}

function bearingDelta(left: number, right: number) {
  return bearingDistanceFromNorth(right - left);
}

function bearingDistanceFromNorth(bearing: number) {
  const normalized = normalizeBearing(bearing);
  return Math.min(normalized, 360 - normalized);
}
