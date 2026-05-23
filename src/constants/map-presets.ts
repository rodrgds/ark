export type MapPreset = {
  id: string;
  name: string;
  description: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  minZoom: number;
  maxZoom: number;
  estimatedSize: string;
  tags: string[];
};

export type MapCatalog = {
  version: number;
  updatedAt: string;
  source: string;
  regions: MapPreset[];
};
