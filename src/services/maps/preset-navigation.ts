import type { MapPreset } from '@/constants/map-presets';
import type { MapRegion } from '@/types/maps';

export function presetIncludesNavigation(preset: Pick<MapPreset, 'routingPackUrl'>) {
  return Boolean(preset.routingPackUrl);
}

export function presetTotalSizeMb(
  preset: Pick<MapPreset, 'estimatedSizeMb' | 'routingSizeMb' | 'routingPackUrl'>
) {
  const map = preset.estimatedSizeMb ?? 0;
  const routing = presetIncludesNavigation(preset) ? (preset.routingSizeMb ?? 0) : 0;
  return map + routing;
}

export function formatPresetTotalSize(
  preset: Pick<MapPreset, 'estimatedSizeMb' | 'estimatedSize' | 'routingSizeMb' | 'routingPackUrl'>
) {
  const totalMb = presetTotalSizeMb(preset);
  if (!totalMb) return preset.estimatedSize ?? 'Size unavailable';
  if (presetIncludesNavigation(preset) && preset.estimatedSizeMb && preset.routingSizeMb) {
    return `Map + navigation: ${Math.round(totalMb)} MB`;
  }
  return `About ${Math.round(totalMb)} MB`;
}

export function routingStatusLabel(region: Pick<MapRegion, 'routingStatus' | 'routingProgress'>) {
  switch (region.routingStatus) {
    case 'ready':
      return 'navigation ready';
    case 'downloading':
      return `navigation ${Math.round((region.routingProgress ?? 0) * 100)}%`;
    case 'queued':
      return 'navigation queued';
    case 'paused':
      return 'navigation paused';
    case 'failed':
      return 'navigation failed';
    default:
      return null;
  }
}
