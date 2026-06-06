export type MapRegionPackFormat =
  | 'maplibre_offline_pack'
  | 'pmtiles'
  | 'mbtiles'
  | 'vector_tiles';

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

export type OfflineMapSearchResult = {
  id: string;
  kind: 'spot' | 'region' | 'route';
  title: string;
  subtitle: string;
  latitude?: number | null;
  longitude?: number | null;
};
