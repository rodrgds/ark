export type MapRegion = {
  id: string;
  name: string;
  provider: string;
  styleUrl?: string | null;
  north?: number | null;
  south?: number | null;
  east?: number | null;
  west?: number | null;
  minZoom?: number | null;
  maxZoom?: number | null;
  offlinePackId?: string | null;
  status: 'not_downloaded' | 'queued' | 'downloading' | 'downloaded' | 'failed';
  progress: number;
  sizeBytes?: number | null;
  createdAt: number;
  updatedAt: number;
};

export type MapMarker = {
  id: string;
  title: string;
  description: string | null;
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
