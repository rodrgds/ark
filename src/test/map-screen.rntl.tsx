import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { MapPreset } from '@/constants/map-presets';
import type { MapMarker, MapRegion, OfflineMapSearchResult, SavedRoute } from '@/types/maps';

installCommonRntlMocks(mock);

const { fireEvent, render, waitFor } = await import('@testing-library/react-native');

const now = new Date('2026-07-01T12:00:00Z').getTime();
const setChromeHidden = mock((_hidden: boolean) => undefined);
const setNetworkConnected = mock((_maplibre: unknown, _connected: boolean) => undefined);
const loadMapLibre = mock(async () => null);
const listRegions = mock(async () => [queuedRegion]);
const listMarkers = mock(async () => [portoMarker]);
const listRoutes = mock(async () => [evacuationRoute]);
const searchOffline = mock(
  async (_query: string): Promise<OfflineMapSearchResult[]> => [
    {
      id: portoMarker.id,
      kind: 'spot',
      title: portoMarker.title,
      subtitle: 'Emergency rally point',
      latitude: portoMarker.latitude,
      longitude: portoMarker.longitude,
    },
    {
      id: evacuationRoute.id,
      kind: 'route',
      title: evacuationRoute.title,
      subtitle: '2 saved points',
    },
    {
      id: 'offline-place-porto',
      kind: 'place',
      title: 'Porto offline',
      subtitle: 'Bundled place seed',
      latitude: 41.1579,
      longitude: -8.6291,
      placeSource: 'offline',
    },
  ]
);
const geocodeSearch = mock(
  async (_query: string): Promise<OfflineMapSearchResult[]> => [
    {
      id: 'place-porto-online',
      kind: 'place',
      title: 'Porto online',
      subtitle: 'Portugal',
      latitude: 41.1579,
      longitude: -8.6291,
      placeSource: 'online',
    },
    {
      id: 'place-porto-cached',
      kind: 'place',
      title: 'Porto cached',
      subtitle: 'Cached geocoder result',
      latitude: 41.15,
      longitude: -8.61,
      placeSource: 'cached',
    },
  ]
);
const refreshCatalog = mock(async () => catalogMeta);

const catalogMeta = {
  version: 1,
  schemaVersion: 1,
  updatedAt: '2026-07-01',
  generatedAt: '2026-07-01',
  source: 'test',
  count: 1,
};

const portugalPreset: MapPreset = {
  id: 'pt-north-centre',
  name: 'North and Centre Portugal',
  description: 'Regional map and navigation pack.',
  countryCode: 'PT',
  level: 'region',
  bounds: { north: 42.2, south: 39.2, east: -6.1, west: -9.5 },
  bbox: [-9.5, 39.2, -6.1, 42.2],
  center: [-8.2, 40.7],
  minZoom: 6,
  maxZoom: 14,
  estimatedSizeMb: 450,
  estimatedSize: '450 MB',
  packFormat: 'maplibre_offline_pack',
  routingPackUrl: 'https://example.com/pt-north-centre-routing.tar',
  routingSizeMb: 220,
  tags: ['recommended', 'portugal', 'porto'],
};

const queuedRegion: MapRegion = {
  id: 'region-porto',
  name: 'Porto offline region',
  provider: 'ark',
  manifestRegionId: 'pt-north-centre',
  manifestVersion: 1,
  styleUrl: null,
  tileUrlTemplate: null,
  packFormat: 'maplibre_offline_pack',
  packUrl: null,
  dataVersion: '2026-07',
  checksumSha256: null,
  checksumSha256Url: null,
  regionUpdatedAt: null,
  north: 42.2,
  south: 39.2,
  east: -6.1,
  west: -9.5,
  minZoom: 6,
  maxZoom: 14,
  offlinePackId: null,
  status: 'queued',
  progress: 0.35,
  estimatedSizeMb: 450,
  sizeBytes: null,
  routingPackUrl: portugalPreset.routingPackUrl,
  routingGraphUri: null,
  routingStatus: 'downloading',
  routingProgress: 0.25,
  routingSizeBytes: 220 * 1024 * 1024,
  routingDataVersion: 'routing-v1',
  routingChecksumSha256: 'sha256',
  createdAt: now,
  updatedAt: now,
};

const portoMarker: MapMarker = {
  id: 'marker-porto-shelter',
  title: 'Porto shelter',
  description: 'Emergency rally point',
  pinType: 'shelter',
  isEmergencyPin: true,
  latitude: 41.1579,
  longitude: -8.6291,
  photoUri: null,
  icon: null,
  color: null,
  createdAt: now,
  updatedAt: now,
};

const evacuationRoute: SavedRoute = {
  id: 'route-evacuation',
  title: 'Evacuation route',
  points: [
    { latitude: 41.1579, longitude: -8.6291, title: 'Porto shelter' },
    { latitude: 41.18, longitude: -8.68, title: 'High ground' },
  ],
  distanceMeters: 3200,
  createdAt: now,
  updatedAt: now,
};

mock.module('expo-router', () => ({
  router: {
    push: () => undefined,
  },
  useFocusEffect: (effect: () => void | (() => void)) => {
    React.useEffect(effect, [effect]);
  },
  useLocalSearchParams: () => ({}),
  useNavigation: () => ({
    addListener: () => () => undefined,
  }),
}));

mock.module('@react-native-community/netinfo', () => ({
  useNetInfo: () => ({ isConnected: false }),
}));

mock.module('@swmansion/react-native-bottom-sheet', () => ({
  BottomSheetProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

mock.module('react-native-svg', () => ({
  default: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('Svg', props, children),
  Path: (props: Record<string, unknown>) => React.createElement('Path', props),
}));

mock.module('expo-image-picker', () => ({
  MediaTypeOptions: { Images: 'Images' },
  launchCameraAsync: async () => ({ canceled: true, assets: [] }),
  launchImageLibraryAsync: async () => ({ canceled: true, assets: [] }),
  requestCameraPermissionsAsync: async () => ({ granted: false }),
  requestMediaLibraryPermissionsAsync: async () => ({ granted: false }),
}));

mock.module('@/components/layout/tabs-chrome', () => ({
  useTabsChrome: () => ({
    chromeHidden: false,
    setChromeHidden,
  }),
}));

mock.module('@/components/ui/sheet-alert', () => ({
  confirmDestructive: () => undefined,
  showSheetAlert: () => undefined,
}));

mock.module('@/services/files/filesystem.service', () => ({
  FileSystemService: {
    copyToAppDirectory: async () => 'file:///maps/spot.jpg',
    deleteByUri: async () => undefined,
    formatBytes: (bytes: number) => `${Math.round(bytes / 1024 / 1024)} MB`,
  },
}));

mock.module('@/services/maps/map.service', () => ({
  MapService: {
    getDefaultStyleUrl: () => 'https://tiles.example/style.json',
    getLocalStyle: () => ({ version: 8, sources: {}, layers: [] }),
    getOverviewStyle: () => ({ version: 8, sources: {}, layers: [] }),
    getRuntimeStatus: (_maplibre: unknown, checked: boolean) => ({
      available: false,
      checking: !checked,
      reason: checked
        ? 'MapLibre is unavailable in this test build.'
        : 'Checking whether the native MapLibre runtime is available.',
    }),
    loadMapLibre,
    setNetworkConnected,
  },
}));

mock.module('@/services/maps/map-location.service', () => ({
  MapLocationService: {
    resolveUserLocation: async () => ({ current: null, lastKnown: null, issue: null }),
  },
}));

mock.module('@/services/maps/map-presets.service', () => ({
  MapPresetsService: {
    findPresetForRegion: () => portugalPreset,
    getCatalogMeta: () => catalogMeta,
    getRegionUpdateState: () => ({ available: false }),
    getRegionsForBoundingBox: () => [portugalPreset],
    listPresets: () => [portugalPreset],
    recommendedForLocation: () => [portugalPreset],
    refreshCatalog,
    search: () => [portugalPreset],
  },
}));

mock.module('@/services/maps/map-region-downloads', () => ({
  startPresetRegionDownload: async () => ({ ok: true }),
}));

mock.module('@/services/maps/offline-map.service', () => ({
  OfflineMapService: {
    createMarker: async () => undefined,
    createRegionFromViewport: async () => 'region-visible',
    deleteMarker: async () => undefined,
    deleteRegion: async () => undefined,
    deleteRoute: async () => undefined,
    getActiveNavigationSession: async () => null,
    listMarkers,
    listRegions,
    listRoutes,
    pauseRegion: async () => ({ ok: true }),
    refreshRegion: async () => ({ ok: true }),
    searchOffline,
    startNavigation: async () => {
      throw new Error('Navigation unavailable in test.');
    },
    stopNavigation: async () => undefined,
    syncNativePacks: async () => undefined,
    updateMarker: async () => undefined,
  },
}));

mock.module('@/services/maps/geocoding.service', () => ({
  GeocodingService: {
    search: geocodeSearch,
  },
}));

mock.module('@/services/sensors/compass.service', () => ({
  CompassService: {
    isAvailable: async () => false,
    start: () => () => undefined,
  },
}));

mock.module('@/stores/sensor-store', () => ({
  useSensorStore: <T,>(selector: (state: { heading: null; setHeading: () => void }) => T) =>
    selector({ heading: null, setHeading: () => undefined }),
}));

describe('MapScreen', () => {
  beforeEach(() => {
    setChromeHidden.mockClear();
    setNetworkConnected.mockClear();
    loadMapLibre.mockClear();
    listRegions.mockClear();
    listMarkers.mockClear();
    listRoutes.mockClear();
    searchOffline.mockClear();
    geocodeSearch.mockClear();
    refreshCatalog.mockClear();
  });

  test('mounts fallback map search, saved data, and offline map recovery controls', async () => {
    const { default: MapScreen } = await import('@/app/(tabs)/map');

    const view = await render(<MapScreen />);

    expect(await view.findByText('World overview')).toBeOnTheScreen();
    expect(await view.findByText('MapLibre is unavailable in this test build.')).toBeOnTheScreen();
    expect(view.getByText('No downloaded map regions')).toBeOnTheScreen();

    const searchInput = view.getByLabelText('Search map places and saved data');
    await fireEvent(searchInput, 'focus');
    await fireEvent.changeText(searchInput, 'porto');

    expect(await view.findByText('Porto shelter')).toBeOnTheScreen();
    expect(view.getByText('Spot · Emergency rally point')).toBeOnTheScreen();
    expect(view.getByText('Evacuation route')).toBeOnTheScreen();
    expect(view.getByText('Route · 2 saved points')).toBeOnTheScreen();
    expect(view.getByText('Porto offline')).toBeOnTheScreen();
    expect(view.getByText('Offline place · Bundled place seed')).toBeOnTheScreen();
    expect(await view.findByText('Porto online')).toBeOnTheScreen();
    expect(view.getByText('Online place · Portugal')).toBeOnTheScreen();
    expect(view.getByText('Porto cached')).toBeOnTheScreen();
    expect(view.getByText('Cached place · Cached geocoder result')).toBeOnTheScreen();

    await waitFor(() => {
      expect(searchOffline).toHaveBeenCalledWith('porto');
    });
    await waitFor(() => {
      expect(geocodeSearch).toHaveBeenCalled();
    });

    await fireEvent.press(view.getByLabelText('Close map search'));
    await fireEvent.press(view.getByLabelText('Saved data'));

    expect(view.getByText('Saved spots and routes')).toBeOnTheScreen();
    expect(view.getByText(/Emergency rally point/)).toBeOnTheScreen();
    expect(view.getByText(/3\.2 km/)).toBeOnTheScreen();

    await fireEvent.press(view.getByLabelText('Offline maps'));

    expect(view.getByText('Offline maps')).toBeOnTheScreen();
    expect(view.getByText('Visible area')).toBeOnTheScreen();
    expect(view.getByText(/Move or zoom the map once/)).toBeOnTheScreen();
    expect(view.getByText('Porto offline region')).toBeOnTheScreen();
    expect(view.getByText(/navigation 25%/)).toBeOnTheScreen();
    expect(view.getByText('Queued')).toBeOnTheScreen();
  });
});
