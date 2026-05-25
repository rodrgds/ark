import type { MapPreset } from '@/constants/map-presets';
import type { MapRegion } from '@/types/maps';
import {
  getRegionsForBoundingBox,
  getRegionForCoordinate,
  isPresetDownloaded,
  type DownloadedRegionLike,
} from '@/services/maps/map-region-utils';

export type MissingRegionPromptState = {
  lastPromptedAt: number;
  lastPromptedRegionId?: string;
  dismissedRegionIds: string[];
};

export type MissingRegionPromptInput = {
  latitude: number;
  longitude: number;
  viewedBounds?: [number, number, number, number] | null;
  regions: MapPreset[];
  downloadedRegions: Array<MapRegion | DownloadedRegionLike>;
  state: MissingRegionPromptState;
  now?: number;
  throttleMs?: number;
};

export const MISSING_REGION_PROMPT_THROTTLE_MS = 90_000;

export function createMissingRegionPromptState(): MissingRegionPromptState {
  return {
    lastPromptedAt: 0,
    dismissedRegionIds: [],
  };
}

export function dismissMissingRegionPrompt(
  state: MissingRegionPromptState,
  regionId: string
): MissingRegionPromptState {
  return {
    ...state,
    dismissedRegionIds: Array.from(new Set([...state.dismissedRegionIds, regionId])),
  };
}

export function clearMissingRegionPromptDismissal(
  state: MissingRegionPromptState,
  regionId: string
): MissingRegionPromptState {
  return {
    ...state,
    dismissedRegionIds: state.dismissedRegionIds.filter((id) => id !== regionId),
  };
}

export function getMissingRegionPrompt(input: MissingRegionPromptInput) {
  const now = input.now ?? Date.now();
  const throttleMs = input.throttleMs ?? MISSING_REGION_PROMPT_THROTTLE_MS;
  const region = getMissingRegionCandidate(input);

  if (!region) return null;

  const isSameRegion = input.state.lastPromptedRegionId === region.id;
  const isThrottled = now - input.state.lastPromptedAt < throttleMs;
  if (isSameRegion && isThrottled) return null;

  return region;
}

function getMissingRegionCandidate(input: MissingRegionPromptInput) {
  const predefined = [
    getRegionForCoordinate(input.latitude, input.longitude, input.regions),
    ...(input.viewedBounds ? getRegionsForBoundingBox(input.viewedBounds, input.regions) : []),
  ];

  const seen = new Set<string>();
  const matchedPredefined = predefined.find((region) => {
    if (!region || seen.has(region.id)) return false;
    seen.add(region.id);
    if (isPresetDownloaded(region, input.downloadedRegions)) return false;
    if (input.state.dismissedRegionIds.includes(region.id)) return false;
    return true;
  });

  if (matchedPredefined) return matchedPredefined;

  // If no predefined preset matches, check if the current center is covered by ANY downloaded region
  const isCenterCovered = input.downloadedRegions.some((dlRegion) => {
    const r = dlRegion as any;
    if (r.bounds) {
      return (
        input.latitude >= r.bounds.south &&
        input.latitude <= r.bounds.north &&
        input.longitude >= r.bounds.west &&
        input.longitude <= r.bounds.east
      );
    }
    if (r.south != null) {
      return (
        input.latitude >= r.south &&
        input.latitude <= r.north &&
        input.longitude >= r.west &&
        input.longitude <= r.east
      );
    }
    return false;
  });

  if (isCenterCovered) return undefined;

  // Generate a dynamic region for the current area
  let bounds = input.viewedBounds;
  if (!bounds) {
    // Generate a ~20km box around the center
    const latDelta = 0.1;
    const lngDelta = 0.1 / Math.cos((input.latitude * Math.PI) / 180);
    bounds = [
      input.longitude - lngDelta,
      input.latitude - latDelta,
      input.longitude + lngDelta,
      input.latitude + latDelta,
    ];
  }

  const dynamicId = `dynamic-${Math.round(bounds[0] * 10)}-${Math.round(bounds[1] * 10)}`;
  if (input.state.dismissedRegionIds.includes(dynamicId)) return undefined;
  
  // Also verify this dynamic region isn't already downloaded
  const isDynamicCovered = input.downloadedRegions.some(r => r.id === dynamicId || r.manifestRegionId === dynamicId);
  if (isDynamicCovered) return undefined;

  return {
    id: dynamicId,
    name: 'this area',
    description: 'Custom offline region for the current map view.',
    bounds: {
      west: bounds[0],
      south: bounds[1],
      east: bounds[2],
      north: bounds[3],
    },
    bbox: [bounds[0], bounds[1], bounds[2], bounds[3]] as [number, number, number, number],
    center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] as [number, number],
    level: 'region' as const,
    minZoom: 8,
    maxZoom: 14,
    estimatedSize: '150 MB',
    estimatedSizeMb: 150,
    tags: [],
  };
}

export function markMissingRegionPromptShown(
  state: MissingRegionPromptState,
  regionId: string,
  now = Date.now()
): MissingRegionPromptState {
  return {
    ...state,
    lastPromptedAt: now,
    lastPromptedRegionId: regionId,
  };
}
