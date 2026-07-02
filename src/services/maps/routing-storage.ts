import type { MapPreset } from '@/constants/map-presets';
import type { MapRegion } from '@/types/maps';

const BYTES_PER_MB = 1024 * 1024;
const bundledCatalog = require('../../../assets/map-catalog.json') as {
  regions?: Array<Pick<MapPreset, 'id' | 'name' | 'routingSizeMb'>>;
};

export function estimatedRoutingPackBytesForPreset(
  preset?: Pick<MapPreset, 'routingSizeMb'> | null
) {
  if (!Number.isFinite(preset?.routingSizeMb) || !preset?.routingSizeMb) return null;
  if (preset.routingSizeMb <= 0) return null;
  return Math.ceil(preset.routingSizeMb * BYTES_PER_MB);
}

export function estimatedBundledRoutingPackBytesForRegion(
  region: Pick<MapRegion, 'manifestRegionId' | 'name'>
) {
  return estimatedRoutingPackBytesForPreset(findBundledRoutingPreset(region));
}

function findBundledRoutingPreset(region: Pick<MapRegion, 'manifestRegionId' | 'name'>) {
  return bundledCatalog.regions?.find(
    (preset) => preset.id === region.manifestRegionId || preset.name === region.name
  );
}
