import type { MapManifestRegion } from '@/types/maps';

export type MapPreset = {
  id: string;
  name: string;
  description: string;
  countryCode?: string;
  parentId?: string;
  level: MapManifestRegion['level'];
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  bbox: MapManifestRegion['bbox'];
  center: MapManifestRegion['center'];
  minZoom: number;
  maxZoom: number;
  estimatedSizeMb?: number;
  estimatedSize: string;
  styleUrl?: string;
  tileUrlTemplate?: string;
  packFormat?: MapManifestRegion['packFormat'];
  packUrl?: string;
  routingPackUrl?: string;
  routingDataVersion?: string;
  routingChecksumSha256?: string;
  routingSizeMb?: number;
  dataVersion?: string;
  checksumSha256?: string;
  checksumSha256Url?: string;
  updatedAt?: string;
  tags: string[];
};

export type MapCatalog = {
  version: number;
  schemaVersion?: number;
  updatedAt: string;
  generatedAt?: string;
  expiresAt?: string;
  source: string;
  sourceUrl?: string;
  fetchedAt?: string;
  verifiedSha256?: string;
  regions: MapPreset[];
};
