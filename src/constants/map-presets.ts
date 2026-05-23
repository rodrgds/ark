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

export const MAP_PRESETS: MapPreset[] = [
  {
    id: 'portugal-overview',
    name: 'Portugal overview',
    description: 'Country-scale roads, towns, coast, and fallback navigation.',
    bounds: { north: 42.3, south: 36.8, east: -6.1, west: -9.7 },
    minZoom: 5,
    maxZoom: 11,
    estimatedSize: '120-260 MB',
    tags: ['Portugal', 'Iberia', 'recommended'],
  },
  {
    id: 'lisbon-field-area',
    name: 'Lisbon field area',
    description: 'Compact test pack for Lisbon, Cascais, Sintra, and Setubal.',
    bounds: { north: 39.05, south: 38.42, east: -8.72, west: -9.55 },
    minZoom: 8,
    maxZoom: 15,
    estimatedSize: '180-420 MB',
    tags: ['Portugal', 'Lisbon', 'urban'],
  },
  {
    id: 'porto-north',
    name: 'Porto and North',
    description: 'Northern Portugal corridor from Porto toward Braga and Guimaraes.',
    bounds: { north: 41.75, south: 40.95, east: -7.75, west: -8.95 },
    minZoom: 8,
    maxZoom: 14,
    estimatedSize: '160-360 MB',
    tags: ['Portugal', 'Porto', 'north'],
  },
  {
    id: 'algarve-coast',
    name: 'Algarve coast',
    description: 'Southern coastal navigation from Sagres to Vila Real de Santo Antonio.',
    bounds: { north: 37.45, south: 36.85, east: -7.35, west: -9.05 },
    minZoom: 8,
    maxZoom: 14,
    estimatedSize: '140-320 MB',
    tags: ['Portugal', 'Algarve', 'coast'],
  },
  {
    id: 'iberia-low-detail',
    name: 'Iberia low detail',
    description: 'Wide-area planning fallback for Portugal and Spain.',
    bounds: { north: 44.4, south: 35.5, east: 4.5, west: -10.0 },
    minZoom: 4,
    maxZoom: 9,
    estimatedSize: '220-520 MB',
    tags: ['Portugal', 'Spain', 'Iberia'],
  },
  {
    id: 'western-europe-base',
    name: 'Western Europe base',
    description: 'Low zoom continental context for long-range route planning.',
    bounds: { north: 55.2, south: 35.0, east: 16.5, west: -11.0 },
    minZoom: 3,
    maxZoom: 7,
    estimatedSize: '180-480 MB',
    tags: ['Europe', 'overview'],
  },
];
