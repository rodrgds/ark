export type MapRegionLevel =
  | 'world'
  | 'continent'
  | 'macroregion'
  | 'country'
  | 'region'
  | 'city';

export type MapRegionPackFormat =
  | 'maplibre_offline_pack'
  | 'pmtiles'
  | 'mbtiles'
  | 'vector_tiles';

export type MapRegion = {
  id: string;
  name: string;
  parentId?: string;
  level: MapRegionLevel;
  bbox: [number, number, number, number]; // [west, south, east, north]
  center: [number, number]; // [longitude, latitude]
  minSuggestZoom?: number;
  maxSuggestZoom?: number;
  minDownloadZoom?: number;
  maxDownloadZoom?: number;
  estimatedSizeMb?: number;
  estimatedSize?: string;
  priority?: number;

  // Control flags
  autoSuggest?: boolean;
  downloadable?: boolean;

  // Metadata/URLs for future remote CDN loading
  styleUrl?: string;
  tileUrlTemplate?: string;
  packFormat?: MapRegionPackFormat;
  packUrl?: string;
  checksum?: string;
  version?: string;
  updatedAt?: string;
  tags?: string[];
  description?: string;
};
