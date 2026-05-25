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
  dataVersion?: string;
  checksumSha256?: string;
  checksumSha256Url?: string;
  updatedAt?: string;
  tags: string[];
};

export type MapCatalog = {
  version: number;
  updatedAt: string;
  source: string;
  regions: MapPreset[];
};
