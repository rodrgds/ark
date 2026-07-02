export type MapRegionPackFormat = 'maplibre_offline_pack' | 'pmtiles' | 'mbtiles' | 'vector_tiles';

export type RoutingProfile = 'pedestrian' | 'bicycle' | 'car';

export type RoutingPreferences = {
  avoidFerries?: boolean;
  avoidHills?: boolean;
  avoidHighways?: boolean;
  avoidTolls?: boolean;
};

export type RoutingPackStatus =
  | 'not_downloaded'
  | 'queued'
  | 'downloading'
  | 'ready'
  | 'failed'
  | 'paused';

export type MapManifestRegion = {
  id: string;
  name: string;
  countryCode?: string;
  parentId?: string;
  level: 'world' | 'country' | 'region' | 'city';
  bbox: [number, number, number, number];
  center: [number, number];
  minZoom: number;
  maxZoom: number;
  estimatedSizeMb?: number;
  styleUrl?: string;
  tileUrlTemplate?: string;
  packFormat?: MapRegionPackFormat;
  packUrl?: string;
  routingPackUrl?: string;
  routingDataVersion?: string;
  routingChecksumSha256?: string;
  routingSizeMb?: number;
  dataVersion?: string;
  checksumSha256?: string;
  checksumSha256Url?: string;
  updatedAt?: string;
};

export type SavedMapPin = {
  id: string;
  title: string;
  description?: string;
  type:
    | 'home'
    | 'meeting_point'
    | 'hospital'
    | 'pharmacy'
    | 'police'
    | 'fire_station'
    | 'water'
    | 'shelter'
    | 'custom';
  coordinate: {
    latitude: number;
    longitude: number;
  };
  createdAt: string;
  updatedAt: string;
  isEmergencyPin?: boolean;
};

export type MapRegion = {
  id: string;
  name: string;
  provider: string;
  manifestRegionId?: string | null;
  manifestVersion?: number | null;
  styleUrl?: string | null;
  tileUrlTemplate?: string | null;
  packFormat?: MapRegionPackFormat | null;
  packUrl?: string | null;
  dataVersion?: string | null;
  checksumSha256?: string | null;
  checksumSha256Url?: string | null;
  regionUpdatedAt?: string | null;
  north?: number | null;
  south?: number | null;
  east?: number | null;
  west?: number | null;
  minZoom?: number | null;
  maxZoom?: number | null;
  offlinePackId?: string | null;
  status: 'not_downloaded' | 'queued' | 'downloading' | 'downloaded' | 'failed' | 'paused';
  progress: number;
  estimatedSizeMb?: number | null;
  sizeBytes?: number | null;
  routingPackUrl?: string | null;
  routingGraphUri?: string | null;
  routingStatus: RoutingPackStatus;
  routingProgress: number;
  routingSizeBytes?: number | null;
  routingDataVersion?: string | null;
  routingChecksumSha256?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MapMarker = {
  id: string;
  title: string;
  description: string | null;
  pinType: SavedMapPin['type'];
  isEmergencyPin: boolean;
  latitude: number;
  longitude: number;
  photoUri: string | null;
  icon: string | null;
  color: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SavedRoutePoint = {
  latitude: number;
  longitude: number;
  title?: string;
};

export type SavedRoute = {
  id: string;
  title: string;
  points: SavedRoutePoint[];
  distanceMeters: number | null;
  createdAt: number;
  updatedAt: number;
};

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type NavigationManeuver = {
  instruction: string;
  distanceMeters: number;
  durationSeconds?: number | null;
  streetName?: string | null;
  beginIndex: number;
  endIndex: number;
};

export type OfflineRoute = {
  id?: string;
  profile: RoutingProfile;
  routingPreferences?: RoutingPreferences;
  regionId: string;
  routingMode?: 'routed' | 'direct';
  routingFallbackReason?:
    | 'no_region'
    | 'navigation_not_downloaded'
    | 'navigation_downloading'
    | 'navigation_failed'
    | 'navigation_graph_missing'
    | 'engine_unavailable'
    | 'route_calculation_failed';
  routingFallbackMessage?: string;
  geometry: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
  maneuvers: NavigationManeuver[];
  createdAt?: number;
};

export type NavigationSessionStatus = 'active' | 'arrived' | 'stopped' | 'rerouting' | 'failed';

export type NavigationSession = {
  id: string;
  destinationTitle: string;
  destination: RouteCoordinate;
  profile: RoutingProfile;
  regionId: string;
  route: OfflineRoute;
  status: NavigationSessionStatus;
  remainingDistanceMeters: number | null;
  currentManeuverIndex: number;
  offRouteCount: number;
  lastLocation?: RouteCoordinate | null;
  lastReroutedAt?: number | null;
  createdAt: number;
  updatedAt: number;
};

export type NavigationLocationUpdate = {
  session: NavigationSession;
  nearestDistanceMeters: number;
  shouldRecalculate: boolean;
  arrived: boolean;
};

export type OfflineMapSearchResult = {
  id: string;
  kind: 'spot' | 'region' | 'route' | 'place' | 'track';
  title: string;
  subtitle: string;
  latitude?: number | null;
  longitude?: number | null;
  placeSource?: 'online' | 'cached' | 'offline';
};

export type OfflineMapPlace = {
  id: string;
  title: string;
  subtitle: string | null;
  latitude: number;
  longitude: number;
  source: 'bundled' | 'catalog' | 'photon';
  sourceRef: string | null;
  terms: string | null;
  createdAt: number;
  updatedAt: number;
  lastSeenAt: number | null;
};
