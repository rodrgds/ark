import type { MapCatalogRegion } from '../types/mapRegions';
import { isCoordinateInsideRegion, getBboxArea } from '../utils/bbox';
import { getRegionAncestors, getRegionDepth } from '../utils/regionHierarchy';

export type Viewport = {
  center: {
    latitude: number;
    longitude: number;
  };
  zoom: number;
};

export type RegionSuggestionInput = {
  viewport: Viewport;
  regions: MapCatalogRegion[];
  downloadedRegionIds: Set<string>;
  dismissedRegionIds: Set<string>;
  activeDownloadRegionIds: Set<string>;
};

/**
 * Returns if the given zoom is within the suggestion zoom range of the region.
 */
export function isZoomWithinRegionSuggestRange(zoom: number, region: MapCatalogRegion): boolean {
  const minZ = region.minSuggestZoom ?? 0;
  const maxZ = region.maxSuggestZoom ?? 22;
  return zoom >= minZ && zoom <= maxZ;
}

/**
 * Deterministically sorts candidate regions for suggestions.
 * More specific regions (smaller bbox area, deeper in hierarchy) should be preferred.
 */
export function sortCandidateRegionsForSuggestion(
  candidates: MapCatalogRegion[],
  regions: MapCatalogRegion[]
): MapCatalogRegion[] {
  return [...candidates].sort((a, b) => {
    // 1. Deeper hierarchy first (child over parent)
    const depthA = getRegionDepth(a.id, regions);
    const depthB = getRegionDepth(b.id, regions);
    if (depthA !== depthB) {
      return depthB - depthA;
    }

    // 2. Smaller bbox area first
    const areaA = getBboxArea(a.bbox);
    const areaB = getBboxArea(b.bbox);
    if (Math.abs(areaA - areaB) > 0.000001) {
      return areaA - areaB;
    }

    // 3. Higher priority first
    const prioA = a.priority ?? 0;
    const prioB = b.priority ?? 0;
    return prioB - prioA;
  });
}

/**
 * Determines the single best undownloaded map region to suggest for the current viewport.
 *
 * Candidates are matched ONLY by whether the viewport center falls inside the region's bbox.
 * Viewport bounding-box intersection is intentionally NOT used for discovery because when
 * zoomed out the visible bounds span continents and would pull in distant, irrelevant regions
 * producing random/confusing suggestions.
 *
 * Returns null if no suggestion is appropriate or if a more specific suggestion was
 * dismissed or downloaded.
 */
export function getBestMissingRegionSuggestion(
  input: RegionSuggestionInput
): MapCatalogRegion | null {
  const { viewport, regions, downloadedRegionIds, dismissedRegionIds, activeDownloadRegionIds } =
    input;
  const { center, zoom } = viewport;

  // 1. Find all downloadable regions whose bbox contains the viewport center.
  //    This is the ONLY discovery mechanism — we never suggest a region the user
  //    is not geographically centered on.
  const containingRegions = regions.filter((region) => {
    if (region.downloadable === false || region.autoSuggest === false) {
      return false;
    }
    return isCoordinateInsideRegion(center.latitude, center.longitude, region.bbox);
  });

  if (containingRegions.length === 0) {
    return null;
  }

  // 2. Sort all matches by specificity (child / smaller area first)
  const sortedMatches = sortCandidateRegionsForSuggestion(containingRegions, regions);

  // 3. Find the most specific region that is applicable at the current zoom level
  const activeZoomMatches = sortedMatches.filter((r) => isZoomWithinRegionSuggestRange(zoom, r));
  const bestMatch = activeZoomMatches[0] ?? null;

  if (!bestMatch) {
    return null;
  }

  // 4. Check if the best match is already downloaded, downloading/queued, or dismissed.
  if (downloadedRegionIds.has(bestMatch.id)) {
    return null;
  }

  if (activeDownloadRegionIds.has(bestMatch.id)) {
    return null;
  }

  if (dismissedRegionIds.has(bestMatch.id)) {
    return null;
  }

  // 5. Check if any more specific matching region (even if out of suggest zoom) is downloaded.
  //    "If Porto is already downloaded, do not suggest Portugal just because Porto is inside Portugal."
  //    Find descendants of bestMatch that contain the coordinate.
  const descendants = sortedMatches.filter((r) => {
    if (r.id === bestMatch.id) return false;
    const ancestors = getRegionAncestors(r.id, regions);
    return ancestors.some((anc) => anc.id === bestMatch.id);
  });

  // If any descendant is already downloaded, do NOT suggest the parent
  const isAnyDescendantDownloaded = descendants.some((desc) => downloadedRegionIds.has(desc.id));
  if (isAnyDescendantDownloaded) {
    return null;
  }

  // If any descendant has been dismissed, do NOT suggest the parent either (prevent cascading)
  const isAnyDescendantDismissed = descendants.some((desc) => dismissedRegionIds.has(desc.id));
  if (isAnyDescendantDismissed) {
    return null;
  }

  return bestMatch;
}
