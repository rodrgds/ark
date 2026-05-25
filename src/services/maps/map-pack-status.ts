type OfflinePackSizeLike = {
  completedResourceSize?: number;
  completedTileSize?: number;
};

export function sizeFromPackStatus(status: OfflinePackSizeLike) {
  const resourceBytes = Math.max(0, status.completedResourceSize ?? 0);
  const tileBytes = Math.max(0, status.completedTileSize ?? 0);
  const total = resourceBytes + tileBytes;
  return total > 0 ? total : null;
}
