import type { MapPreset } from '@/constants/map-presets';
import type { MapRegion } from '@/types/maps';
import type { MapCatalogRegion } from './types/mapRegions';
import { getBestMissingRegionSuggestion } from './services/mapRegionSuggestionService';
import { isCoordinateInsideRegion } from './utils/bbox';

export type MissingRegionPromptInput = {
  latitude: number;
  longitude: number;
  viewedBounds?: [number, number, number, number] | null;
  regions: MapPreset[];
  downloadedRegions: Array<MapRegion | any>;
  zoom?: number;
};

/**
 * Estimate map zoom from viewed bounds when native zoom tracking is unavailable.
 * Uses the longitude span of the bounds as the primary signal.
 */
function estimateZoomFromBounds(bounds: [number, number, number, number]): number {
  const [west, , east] = bounds;
  const lngSpan = Math.abs(east - west);
  if (lngSpan <= 0) return 14;
  return Math.max(0, Math.min(20, Math.log2(360 / lngSpan)));
}

/**
 * Pure, synchronous suggestion function.
 *
 * Returns the single best undownloaded/undismissed predefined region for the
 * current viewport, or a dynamic region for uncatalogued areas.
 * Returns null if nothing should be suggested.
 *
 * There are NO internal cooldowns or throttles — the caller controls when
 * and how often to call this.  The only suppression is the explicit dismiss
 * list stored in `state`.
 */
export function getMissingRegionPrompt(input: MissingRegionPromptInput): MapPreset | null {
  return getMissingRegionCandidate(input);
}

function getMissingRegionCandidate(input: MissingRegionPromptInput): MapPreset | null {
  // Resolve the effective zoom:
  //  - prefer native zoom from MapLibre events
  //  - fall back to an estimate from viewed bounds
  //  - last resort: world-overview level (no suggestions will match)
  let zoom = input.zoom ?? 1;
  if (zoom < 2 && input.viewedBounds) {
    zoom = estimateZoomFromBounds(input.viewedBounds);
  }

  // Convert MapPreset[] to MapCatalogRegion[] for the suggestion algorithm
  const mappedRegions: MapCatalogRegion[] = input.regions.map((preset) => {
    const isVague =
      preset.id.includes('low-detail') ||
      preset.id.includes('base') ||
      preset.tags.includes('overview');
    return {
      id: preset.id,
      name: preset.name,
      parentId: preset.parentId,
      level: preset.level as any,
      bbox: preset.bbox,
      center: preset.center,
      minSuggestZoom: preset.minZoom,
      maxSuggestZoom: preset.maxZoom,
      estimatedSizeMb: preset.estimatedSizeMb,
      estimatedSize: preset.estimatedSize,
      autoSuggest: !isVague,
      downloadable: !isVague,
      description: preset.description,
      tags: preset.tags,
    };
  });

  // Resolve downloaded / downloading / dismissed IDs
  const downloadedRegionIds = new Set<string>();
  const activeDownloadRegionIds = new Set<string>();

  for (const r of input.downloadedRegions) {
    const matched = input.regions.find((preset) => {
      const rId = r.manifestRegionId || r.regionId || r.id;
      if (preset.id === rId || preset.name === r.name) return true;

      const rWest = r.west ?? r.bbox?.[0];
      const rSouth = r.south ?? r.bbox?.[1];
      const rEast = r.east ?? r.bbox?.[2];
      const rNorth = r.north ?? r.bbox?.[3];

      if (rWest != null && rSouth != null && rEast != null && rNorth != null) {
        const delta = 0.000001;
        return (
          Math.abs(preset.bbox[0] - rWest) < delta &&
          Math.abs(preset.bbox[1] - rSouth) < delta &&
          Math.abs(preset.bbox[2] - rEast) < delta &&
          Math.abs(preset.bbox[3] - rNorth) < delta
        );
      }
      return false;
    });

    if (matched) {
      if (r.status === 'downloaded') downloadedRegionIds.add(matched.id);
      else if (r.status === 'downloading' || r.status === 'queued')
        activeDownloadRegionIds.add(matched.id);
    } else {
      const directId = r.manifestRegionId || r.regionId || r.id;
      if (directId) {
        if (r.status === 'downloaded') downloadedRegionIds.add(directId);
        else if (r.status === 'downloading' || r.status === 'queued')
          activeDownloadRegionIds.add(directId);
      }
    }
  }

  // Run the core selection algorithm — only uses viewport center, never bbox intersection
  const suggestion = getBestMissingRegionSuggestion({
    viewport: { center: { latitude: input.latitude, longitude: input.longitude }, zoom },
    regions: mappedRegions,
    downloadedRegionIds,
    activeDownloadRegionIds,
    dismissedRegionIds: new Set(),
  });

  if (suggestion) {
    const originalPreset = input.regions.find((r) => r.id === suggestion.id);
    if (originalPreset) {
      // If the predefined suggestion is low detail, but user is zoomed in enough, prefer dynamic
      if (zoom >= 8 && (originalPreset.maxZoom ?? 14) < 14) {
        // Fall through to dynamic region fallback
      } else {
        return originalPreset;
      }
    }
  }

  // Dynamic region fallback: only when zoomed in enough
  if (zoom >= 8) {
    // 1. Check if ANY predefined region covering this coordinate is already downloaded
    const isPredefinedCovered = input.regions.some((r) => {
      if ((r.maxZoom ?? 14) < 14) return false;
      if (!isCoordinateInsideRegion(input.latitude, input.longitude, r.bbox)) return false;
      return input.downloadedRegions.some(
        (dl) => (dl.manifestRegionId === r.id || dl.name === r.name) && dl.status === 'downloaded'
      );
    });
    if (isPredefinedCovered) return null;

    // 2. Check if ANY dynamic region covering this coordinate is already downloaded
    const isCenterCovered = input.downloadedRegions.some((dlRegion) => {
      const r = dlRegion as any;
      if (r.status !== 'downloaded') return false;
      const maxZ = r.maxZoom ?? 14;
      if (maxZ < 14) return false; // Not covered by high-detail map

      const south = r.south ?? r.bounds?.south;
      const north = r.north ?? r.bounds?.north;
      const west = r.west ?? r.bounds?.west;
      const east = r.east ?? r.bounds?.east;
      if (south != null && north != null && west != null && east != null) {
        return (
          input.latitude >= south &&
          input.latitude <= north &&
          input.longitude >= west &&
          input.longitude <= east
        );
      }
      return false;
    });
    if (isCenterCovered) return null;

    let bounds = input.viewedBounds;
    if (!bounds) {
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

    const isDynamicDownloaded = input.downloadedRegions.some(
      (r) => (r.id === dynamicId || r.manifestRegionId === dynamicId) && r.status === 'downloaded'
    );
    if (isDynamicDownloaded) return null;

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

  return null;
}
