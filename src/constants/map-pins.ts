import type { SavedMapPin } from '@/types/maps';

export type MapPinType = SavedMapPin['type'];

export const BRAND_AMBER = '#F2B84B';

export const MAP_PIN_TYPES: Array<{
  type: MapPinType;
  label: string;
  color: string;
}> = [
  { type: 'home', label: 'Home', color: BRAND_AMBER },
  { type: 'meeting_point', label: 'Meeting point', color: '#95A78B' },
  { type: 'water', label: 'Water', color: '#38BDF8' },
  { type: 'shelter', label: 'Shelter', color: '#A78BFA' },
  { type: 'custom', label: 'Custom', color: BRAND_AMBER },
];

export const MAP_PIN_COLOR_OPTIONS = [
  BRAND_AMBER,
  '#95A78B',
  '#38BDF8',
  '#F87171',
  '#34D399',
  '#F59E0B',
  '#E879F9',
  '#F8FAFC',
] as const;

export function normalizeMapPinType(type?: string | null): MapPinType {
  return MAP_PIN_TYPES.some((pin) => pin.type === type) ? (type as MapPinType) : 'custom';
}

export function getMapPinMeta(type?: string | null) {
  return MAP_PIN_TYPES.find((pin) => pin.type === normalizeMapPinType(type)) ?? MAP_PIN_TYPES[4];
}
