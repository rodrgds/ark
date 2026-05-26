import type { SavedMapPin } from '@/types/maps';

export type MapPinType = SavedMapPin['type'];

export const MAP_PIN_TYPES: Array<{
  type: MapPinType;
  label: string;
  color: string;
}> = [
  { type: 'home', label: 'Home', color: '#F2B84B' },
  { type: 'meeting_point', label: 'Meeting point', color: '#95A78B' },
  { type: 'hospital', label: 'Hospital', color: '#EF4444' },
  { type: 'pharmacy', label: 'Pharmacy', color: '#22C55E' },
  { type: 'police', label: 'Police', color: '#60A5FA' },
  { type: 'fire_station', label: 'Fire station', color: '#F97316' },
  { type: 'water', label: 'Water', color: '#38BDF8' },
  { type: 'shelter', label: 'Shelter', color: '#A78BFA' },
  { type: 'custom', label: 'Custom', color: '#F2B84B' },
];

export function normalizeMapPinType(type?: string | null): MapPinType {
  return MAP_PIN_TYPES.some((pin) => pin.type === type) ? (type as MapPinType) : 'custom';
}

export function getMapPinMeta(type?: string | null) {
  return MAP_PIN_TYPES.find((pin) => pin.type === normalizeMapPinType(type)) ?? MAP_PIN_TYPES[2];
}
