import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { confirmDestructive, showSheetAlert } from '@/components/ui/sheet-alert';
import { Text } from '@/components/ui/text';
import { useTabsChrome } from '@/components/layout/tabs-chrome';
import { SavedDataPanel } from '@/components/map/saved-data-panel';
import { TopMapControls, type TopMapMode } from '@/components/map/map-toolbar';
import {
  CompassButton,
  EditSpotDialog,
  LocationNoticeCard,
  MapCanvas,
  MapFab,
  MapPointActionSheet,
  MarkerActionSheet,
  MissingRegionPromptModal,
  NavigationStatusCard,
  OfflineMapsPanel,
  SpotDialog,
} from '@/components/map/map-screen-components';
import {
  CENTER_UPDATE_EPSILON_DEGREES,
  DEFAULT_CENTER,
  bearingDelta,
  bearingDistanceFromNorth,
  centerDistance,
  getCameraComponent,
  getMapComponent,
  isDefaultCenter,
  isFiniteLngLat,
  locationToCenter,
  navigationRouteBounds,
  normalizeBearing,
  regionBounds,
  regionCenter,
  regionInitialZoom,
  routeBounds,
  runCameraAction,
  sameLocation,
  uniqueSearchResults,
  type CameraAction,
  type LngLat,
  type MapViewBounds,
} from '@/components/map/map-screen-utils';
import type { MapPreset } from '@/constants/map-presets';
import type { MapPinType } from '@/constants/map-pins';
import { FileSystemService } from '@/services/files/filesystem.service';
import { MapService, type MapLibreModule } from '@/services/maps/map.service';
import { MapLocationService, type MapLocationIssue } from '@/services/maps/map-location.service';
import { startPresetRegionDownload } from '@/services/maps/map-region-downloads';
import { MapPresetsService } from '@/services/maps/map-presets.service';
import { getMissingRegionPrompt } from '@/services/maps/missing-region-prompt';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import { useThemeStore } from '@/stores/theme-store';
import { useSensorStore } from '@/stores/sensor-store';
import { CompassService } from '@/services/sensors/compass.service';
import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';
import { formatPoint } from '@/lib/geo';
import type {
  MapMarker,
  MapRegion,
  NavigationSession,
  OfflineMapSearchResult,
  RouteCoordinate,
  SavedRoute,
} from '@/types/maps';
import type { LocationObject } from 'expo-location';
import { useNetInfo } from '@react-native-community/netinfo';
import { useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { BottomSheetProvider } from '@swmansion/react-native-bottom-sheet';
import {
  AlertTriangle,
  Check,
  Layers,
  List,
  MapPin,
  Maximize2,
  Minimize2,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as React from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Keyboard,
  Linking,
  Modal,
  type TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Panel = 'offline' | 'saved' | null;
type ManagerTab = 'downloaded' | 'browse';
type TopMode = TopMapMode;

const WORLD_OVERVIEW_ZOOM = 1.1;
const SEARCH_INSET_WITH_COMPASS = 64;
const SEARCH_INSET_WITHOUT_COMPASS = 12;
const COMPASS_NORTH_EPSILON_DEGREES = 1.25;
const BEARING_UPDATE_EPSILON_DEGREES = 0.35;
const COMPASS_RESET_SUPPRESS_MS = 500;
const SEARCH_GESTURE_SUPPRESS_MS = 450;
const FLOATING_CONTROL_BOTTOM = 12;
export default function MapScreen() {
  const navigation = useNavigation();
  const { chromeHidden: fullscreen, setChromeHidden } = useTabsChrome();
  const { markerId } = useLocalSearchParams<{ markerId?: string }>();
  const insets = useSafeAreaInsets();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const colors = useThemeStore((state) => state.colors);
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
  const [spotColor, setSpotColor] = React.useState(colors.primary);
  const [spotEmergency, setSpotEmergency] = React.useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = React.useState<string | null>(null);
  const [markerActionsOpen, setMarkerActionsOpen] = React.useState(false);
  const [mapActionPoint, setMapActionPoint] = React.useState<LngLat | null>(null);
  const [navigationSession, setNavigationSession] = React.useState<NavigationSession | null>(null);
  const [editingMarker, setEditingMarker] = React.useState<MapMarker | null>(null);
  const [editTitle, setEditTitle] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editPhotoUri, setEditPhotoUri] = React.useState<string | null>(null);
  const [editPinType, setEditPinType] = React.useState<MapPinType>('custom');
  const [editColor, setEditColor] = React.useState(colors.primary);
  const [editEmergency, setEditEmergency] = React.useState(false);
  const [center, setCenter] = React.useState<LngLat>(DEFAULT_CENTER);
  const [viewedBounds, setViewedBounds] = React.useState<MapViewBounds | null>(null);
  const [zoom, setZoom] = React.useState<number>(WORLD_OVERVIEW_ZOOM);
  const mapZoomRef = React.useRef(WORLD_OVERVIEW_ZOOM);
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
  const netInfo = useNetInfo();
  const mapCanUseNetwork = netInfo.isConnected !== false;
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
  const mapViewportCenter = React.useMemo(
    () => (isDefaultCenter(center) ? mapInitialCenter : center),
    [center, mapInitialCenter]
  );
  const mapViewportZoom = React.useMemo(() => {
    const hasTrackedViewport = Math.abs(mapZoomRef.current - WORLD_OVERVIEW_ZOOM) >= 0.05;
    return hasTrackedViewport ? zoom : mapInitialZoom;
  }, [zoom, mapInitialZoom]);
  const hasActiveMapDownloads = React.useMemo(
    () => regions.some((region) => region.status === 'downloading' || region.status === 'queued'),
    [regions]
  );
  const mapStyle = React.useMemo(() => {
    if (downloadedRegions.length > 0) {
      return MapService.getLocalStyle(theme, colors);
    }
    if (mapCanUseNetwork) {
      return MapService.getThemedStyle(theme, colors);
    }
    return MapService.getOverviewStyle(theme, colors);
  }, [colors, downloadedRegions.length, mapCanUseNetwork, theme]);
  const mapHasBaseTiles = downloadedRegions.length > 0 || mapCanUseNetwork;
  const mapBackgroundColor = colors.background;
  const mapInstanceKey =
    downloadedRegions.length > 0
      ? 'offline-regions-map'
      : mapCanUseNetwork
        ? 'online-basemap'
        : 'world-overview-map';
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
  const filteredRoutes = React.useMemo(() => {
    const query = savedSearch.trim().toLowerCase();
    if (!query) return routes;
    return routes.filter((route) =>
      `${route.title} ${route.points.map((point) => point.title ?? '').join(' ')}`
        .toLowerCase()
        .includes(query)
    );
  }, [routes, savedSearch]);
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
    void OfflineMapService.getActiveNavigationSession().then(setNavigationSession);
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

  React.useEffect(() => {
    return () => setChromeHidden(false);
  }, [setChromeHidden]);

  useFocusEffect(
    React.useCallback(() => {
      void load({ syncNative: true });
    }, [])
  );

  const reduceModeEnabled = useBatteryReduceMode();
  const setStoreHeading = useSensorStore((state) => state.setHeading);
  useFocusEffect(
    React.useCallback(() => {
      let stop: (() => void) | undefined;
      let active = true;
      CompassService.isAvailable().then((ok) => {
        if (!active || !ok) return;
        stop = CompassService.start(setStoreHeading, { reduceModeEnabled });
      });
      return () => {
        active = false;
        stop?.();
        setStoreHeading(null);
      };
    }, [reduceModeEnabled, setStoreHeading])
  );

  React.useEffect(() => {
    activeMapKeyRef.current = mapInstanceKey;
    setMapReady(false);
    cameraRef.current = null;
    autoFocusedRegionIdRef.current = null;
  }, [canMountMap, mapInstanceKey]);

  React.useEffect(() => {
    if (!maplibre || !nativeMapAvailable) return;
    MapService.setNetworkConnected(maplibre, mapCanUseNetwork || hasActiveMapDownloads);
    return () => MapService.setNetworkConnected(maplibre, true);
  }, [maplibre, nativeMapAvailable, hasActiveMapDownloads, mapCanUseNetwork]);

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
    if (!hasActiveMapDownloads && !busy?.startsWith('download:')) return;
    const interval = setInterval(() => {
      void load({ syncNative: true });
    }, 1000);
    return () => clearInterval(interval);
  }, [hasActiveMapDownloads, busy]);

  React.useEffect(() => {
    let canceled = false;
    const abortController = new AbortController();
    const timeout = setTimeout(() => {
      const query = search.trim();
      if (query.length < 2) {
        setOfflineResults([]);
        return;
      }
      OfflineMapService.searchOffline(query)
        .then(async (localResults) => {
          const placeResults =
            query.length >= 3
              ? await import('@/services/maps/geocoding.service')
                  .then(({ GeocodingService }) =>
                    GeocodingService.search(query, 6, abortController.signal)
                  )
                  .catch(() => [])
              : [];
          if (!canceled) setOfflineResults(uniqueSearchResults([...localResults, ...placeResults]));
        })
        .catch(() => {
          if (!canceled) setOfflineResults([]);
        });
    }, 180);
    return () => {
      canceled = true;
      abortController.abort();
      clearTimeout(timeout);
    };
  }, [catalogVersion, markers, regions, routes, search]);

  React.useEffect(() => {
    if (!navigationSession || !userLocation) return;
    let canceled = false;
    import('@/services/maps/offline-routing.service').then(async ({ OfflineRoutingService }) => {
      const update = await OfflineRoutingService.updateLocation(navigationSession, userLocation);
      if (canceled) return;
      if (update.arrived) {
        setNavigationSession(null);
        return;
      }
      if (!update.shouldRecalculate) {
        setNavigationSession(update.session);
        return;
      }
      try {
        const rerouted = await OfflineRoutingService.recalculate(update.session, userLocation);
        if (!canceled) setNavigationSession(rerouted);
      } catch (routeError) {
        if (!canceled) {
          setNavigationSession(update.session);
          setError(
            routeError instanceof Error ? routeError.message : 'Unable to recalculate route.'
          );
        }
      }
    });
    return () => {
      canceled = true;
    };
  }, [navigationSession?.id, userLocation?.latitude, userLocation?.longitude]);

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
    let subscription: { remove: () => void } | null = null;
    if (!searchFocused && topMode !== 'search') {
      return () => undefined;
    }
    subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      closeSearchKeyboard();
      return true;
    });
    return () => subscription?.remove();
  }, [closeSearchKeyboard, searchFocused, topMode]);

  useFocusEffect(
    React.useCallback(() => {
      if (!searchFocused && topMode !== 'search') return undefined;
      const unsubscribe = navigation.addListener('beforeRemove', (event) => {
        event.preventDefault();
        closeSearchKeyboard();
      });
      return unsubscribe;
    }, [closeSearchKeyboard, navigation, searchFocused, topMode])
  );

  function openSpotDialog(lngLat: LngLat) {
    setMapActionPoint(null);
    setMarkerActionsOpen(false);
    setPendingSpot(lngLat);
    setSpotTitle('');
    setSpotDescription('');
    setSpotPhotoUri(null);
    setSpotPinType('custom');
    setSpotColor(colors.primary);
    setSpotEmergency(false);
  }

  async function cancelSpotDialog() {
    if (spotPhotoUri) await FileSystemService.deleteByUri(spotPhotoUri).catch(() => undefined);
    setPendingSpot(null);
    setSpotPhotoUri(null);
    setSpotPinType('custom');
    setSpotColor(colors.primary);
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
    setMapActionPoint(null);
    setMarkerActionsOpen(false);
    setEditingMarker(marker);
    setEditTitle(marker.title);
    setEditDescription(marker.description ?? '');
    setEditPhotoUri(marker.photoUri);
    setEditPinType(marker.pinType);
    setEditColor(marker.color || colors.primary);
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
    setEditColor(colors.primary);
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
        color: editColor,
        isEmergencyPin: editEmergency,
        photoUri: editPhotoUri,
      });
      setSelectedMarkerId(editingMarker.id);
      setEditingMarker(null);
      setEditTitle('');
      setEditDescription('');
      setEditPhotoUri(null);
      setEditPinType('custom');
      setEditColor(colors.primary);
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
        color: spotColor,
        isEmergencyPin: spotEmergency,
        longitude: pendingSpot[0],
        latitude: pendingSpot[1],
        photoUri: spotPhotoUri,
      });
      setPendingSpot(null);
      setSpotPhotoUri(null);
      setSpotPinType('custom');
      setSpotColor(colors.primary);
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
          centerDistance(
            locationToCenter(resolution.lastKnown),
            locationToCenter(resolution.current)
          ) > CENTER_UPDATE_EPSILON_DEGREES;
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

  async function downloadVisibleArea() {
    if (!viewedBounds) {
      setError('Move the map until Ark knows the visible area.');
      return;
    }
    setBusy('download:visible-area');
    setError(null);
    try {
      MapService.setNetworkConnected(maplibre, true);
      const regionId = await OfflineMapService.createRegionFromViewport({
        bounds: viewedBounds,
        zoom,
        styleUrl: MapService.getDefaultStyleUrl(),
      });
      const result = await OfflineMapService.refreshRegion(regionId);
      if (!result.ok) setError(result.reason ?? 'Unable to download the visible map area.');
    } catch (visibleAreaError) {
      setError(
        visibleAreaError instanceof Error
          ? visibleAreaError.message
          : 'Unable to download the visible map area.'
      );
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
    confirmDestructive({
      title: 'Delete offline region?',
      message: region.name,
      onConfirm: async () => {
        await OfflineMapService.deleteRegion(region.id);
        await load({ syncNative: true });
      },
    });
  }

  async function deleteMarker(marker: MapMarker) {
    confirmDestructive({
      title: 'Delete spot?',
      message: marker.title,
      onConfirm: async () => {
        await OfflineMapService.deleteMarker(marker.id);
        if (selectedMarkerId === marker.id) setSelectedMarkerId(null);
        if (selectedMarkerId === marker.id) setMarkerActionsOpen(false);
        if (editingMarker?.id === marker.id) setEditingMarker(null);
        await load();
      },
    });
  }

  async function deleteRoute(route: SavedRoute) {
    confirmDestructive({
      title: 'Delete route?',
      message: route.title,
      onConfirm: async () => {
        await OfflineMapService.deleteRoute(route.id);
        await load();
      },
    });
  }

  async function startNavigationToDestination(input: {
    busyKey: string;
    destination: RouteCoordinate;
    title: string;
  }) {
    let origin = userLocation;
    if (!origin) {
      setBusy(input.busyKey);
      const resolution = await MapLocationService.resolveUserLocation({
        requestPermission: true,
        showUserSettingsDialog: true,
      });
      if (resolution.current) {
        origin = {
          latitude: resolution.current.coords.latitude,
          longitude: resolution.current.coords.longitude,
        };
        setUserLocation(origin);
      }
    }
    if (!origin) {
      setError('Ark needs your current GPS position before it can calculate a route.');
      setBusy(null);
      return;
    }
    setBusy(input.busyKey);
    setError(null);
    try {
      const session = await OfflineMapService.startNavigation({
        origin,
        destination: input.destination,
        destinationTitle: input.title,
        profile: 'pedestrian',
      });
      setNavigationSession(session);
      if (session.route.routingMode === 'direct') {
        showSheetAlert(
          'Direct-line route',
          `${
            session.route.routingFallbackMessage ?? 'Road routing is unavailable.'
          } Ark will keep bearing and distance active.`
        );
      }
      setSelectedMarkerId(null);
      fitNavigationRoute(session);
    } catch (navigationError) {
      setError(
        navigationError instanceof Error ? navigationError.message : 'Unable to start navigation.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function startNavigationToMarker(marker: MapMarker) {
    await startNavigationToDestination({
      busyKey: `navigate:${marker.id}`,
      destination: { latitude: marker.latitude, longitude: marker.longitude },
      title: marker.title,
    });
  }

  async function startNavigationToMapPoint(lngLat: LngLat) {
    if (isPlacing || busy?.startsWith('navigate:')) return;
    const destination = { latitude: lngLat[1], longitude: lngLat[0] };
    setSelectedMarkerId(null);
    setActivePanel(null);
    await startNavigationToDestination({
      busyKey: 'navigate:map-point',
      destination,
      title: formatPoint(destination.latitude, destination.longitude),
    });
  }

  async function stopNavigation() {
    if (navigationSession) await OfflineMapService.stopNavigation(navigationSession.id);
    setNavigationSession(null);
  }

  async function downloadMissingRegion(preset: MapPreset) {
    await downloadPreset(preset);
  }

  function centerOn(nextCenter: LngLat, zoom = 13, duration = 420) {
    setCenter(nextCenter);
    setZoom(zoom);
    mapCenterRef.current = nextCenter;
    mapZoomRef.current = zoom;
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

  function fitNavigationRoute(session: NavigationSession) {
    const bounds = navigationRouteBounds(session);
    if (!bounds) return;
    const [west, south, east, north] = bounds;
    setCenter([(west + east) / 2, (south + north) / 2]);
    queueCameraAction({
      type: 'bounds',
      bounds,
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
    if (result.kind === 'place' && result.longitude != null && result.latitude != null) {
      centerOn([result.longitude, result.latitude], 14);
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
    ? mapCanUseNetwork
      ? 'Online map tiles are active. Download this area to keep it available offline.'
      : 'Low-detail world overview is available without network tiles.'
    : status.reason;
  const routingBusy = busy?.startsWith('navigate:') ?? false;

  const activeDownloadingRegion = React.useMemo(() => {
    return regions.find((r) => r.status === 'downloading' || r.status === 'queued') || null;
  }, [regions]);

  const bottomControlOffset = Math.max(
    insets.bottom + FLOATING_CONTROL_BOTTOM,
    FLOATING_CONTROL_BOTTOM
  );

  const mapContent = (
    <View className="bg-background flex-1" style={{ backgroundColor: mapBackgroundColor }}>
      <MapCanvas
        cameraRef={cameraRef}
        canMount={canMountMap}
        center={mapViewportCenter}
        fullscreen={fullscreen}
        hasDownloadedRegion={hasDownloadedRegion}
        initialZoom={mapViewportZoom}
        isSearchActive={searchFocused || topMode === 'search'}
        mapBearing={mapBearing}
        mapBackgroundColor={mapBackgroundColor}
        mapKey={mapInstanceKey}
        mapReady={mapReady}
        mapStyle={mapStyle}
        maplibre={maplibre}
        markers={visibleMarkers}
        navigationSession={navigationSession}
        routes={routes}
        selectedMarker={selectedMarker}
        showWorldOverview={!mapHasBaseTiles}
        status={mapStatus}
        suppressLongPressUntilRef={searchGestureSuppressUntilRef}
        userLocation={userLocation}
        onBearingChange={handleBearingChange}
        onBoundsChange={setViewedBounds}
        onCenterChange={handleCenterChange}
        onZoomChange={handleZoomChange}
        onDismissSearch={closeSearchKeyboard}
        onLongPress={(lngLat) => {
          setSelectedMarkerId(null);
          setMarkerActionsOpen(false);
          setMapActionPoint(lngLat);
        }}
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
          setMapActionPoint(null);
          setMarkerActionsOpen(true);
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
        <View className="absolute right-3 gap-2" style={{ bottom: bottomControlOffset }}>
          <MapFab label="Locate me" loading={busy === 'locate'} onPress={locateMe} text="Me" />
          <MapFab
            icon={MapPin}
            label="Add spot"
            onPress={() => {
              setSelectedMarkerId(null);
              setIsPlacing(true);
            }}
          />
          <MapFab
            active={activePanel === 'offline'}
            icon={Layers}
            label="Offline maps"
            onPress={() => setActivePanel('offline')}
          />
          <MapFab icon={List} label="Saved data" onPress={() => setActivePanel('saved')} />
          <MapFab
            icon={fullscreen ? Minimize2 : Maximize2}
            label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            onPress={() => setChromeHidden(!fullscreen)}
          />
        </View>
      ) : null}

      <View className="absolute left-3 w-72 gap-2" style={{ bottom: bottomControlOffset }}>
        {routingBusy ? (
          <Card className="border-primary/40 bg-background/95 flex-row items-center gap-3 p-3">
            <ActivityIndicator size="small" />
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-semibold">Calculating route</Text>
              <Text variant="small" className="text-muted-foreground">
                Longer offline routes can take a moment.
              </Text>
            </View>
          </Card>
        ) : null}
        {navigationSession ? (
          <NavigationStatusCard
            session={navigationSession}
            onFocus={() => fitNavigationRoute(navigationSession)}
            onStop={() => void stopNavigation()}
          />
        ) : null}
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
            style={{ bottom: bottomControlOffset }}>
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
        routes={filteredRoutes}
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

      <OfflineMapsPanel
        busyKey={busy}
        managerTab={managerTab}
        presetResults={presetResults}
        presetSearch={presetSearch}
        regions={regions}
        viewedBounds={viewedBounds}
        visible={activePanel === 'offline'}
        onChangePresetSearch={setPresetSearch}
        onChangeTab={setManagerTab}
        onClose={() => setActivePanel(null)}
        onDeleteRegion={deleteRegion}
        onDownloadPreset={downloadPreset}
        onDownloadRegion={startDownload}
        onDownloadVisibleArea={downloadVisibleArea}
        onFocusRegion={(region) => {
          fitRegion(region);
          setActivePanel(null);
        }}
        onPauseRegion={pauseRegion}
      />

      <MapPointActionSheet
        busy={routingBusy}
        point={mapActionPoint}
        visible={Boolean(mapActionPoint)}
        onDismiss={() => setMapActionPoint(null)}
        onRoute={() => {
          const point = mapActionPoint;
          setMapActionPoint(null);
          if (point) void startNavigationToMapPoint(point);
        }}
        onSave={() => {
          const point = mapActionPoint;
          setMapActionPoint(null);
          if (point) openSpotDialog(point);
        }}
      />

      <MarkerActionSheet
        busy={Boolean(selectedMarker && busy === `navigate:${selectedMarker.id}`)}
        marker={selectedMarker}
        visible={markerActionsOpen && Boolean(selectedMarker)}
        onDismiss={() => setMarkerActionsOpen(false)}
        onEdit={() => {
          const marker = selectedMarker;
          setMarkerActionsOpen(false);
          if (marker) openEditMarker(marker);
        }}
        onRoute={() => {
          const marker = selectedMarker;
          setMarkerActionsOpen(false);
          if (marker) void startNavigationToMarker(marker);
        }}
      />

      <SpotDialog
        busy={busy === 'spot'}
        color={spotColor}
        description={spotDescription}
        isEmergency={spotEmergency}
        lngLat={pendingSpot}
        photoUri={spotPhotoUri}
        pinType={spotPinType}
        title={spotTitle}
        onAttachPhoto={attachSpotPhoto}
        onCancel={cancelSpotDialog}
        onChangeColor={setSpotColor}
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
        color={editColor}
        description={editDescription}
        isEmergency={editEmergency}
        marker={editingMarker}
        photoUri={editPhotoUri}
        pinType={editPinType}
        title={editTitle}
        onAttachPhoto={attachEditPhoto}
        onCancel={cancelEditMarker}
        onChangeColor={setEditColor}
        onChangeDescription={setEditDescription}
        onChangeEmergency={setEditEmergency}
        onChangePinType={setEditPinType}
        onChangeTitle={setEditTitle}
        onRemovePhoto={removeEditPhoto}
        onSave={saveMarkerEdit}
      />

      <MissingRegionPromptModal
        visible={Boolean(visibleMissingRegionPrompt && netInfo.isConnected && !navigationSession)}
        busy={Boolean(
          visibleMissingRegionPrompt && busy === `download:${visibleMissingRegionPrompt.id}`
        )}
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

  if (fullscreen) {
    return (
      <View className="bg-background flex-1">
        <Modal
          animationType="fade"
          onRequestClose={() => setChromeHidden(false)}
          presentationStyle="fullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          visible>
          <BottomSheetProvider>{mapContent}</BottomSheetProvider>
        </Modal>
      </View>
    );
  }

  return mapContent;
}
