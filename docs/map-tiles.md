# Map Tile Configuration

Ark's current Map tab stores planned regions, saved spots, and route drafts in SQLite. Actual vector map rendering still needs MapLibre in a development build.

## Online Style URL

For the first native pass, use a style JSON from one of:

- MapTiler free tier: `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY`
- OpenMapTiles-hosted styles if available for the target deployment.

Store the style URL with `map_regions.style_url`. Do not hardcode private API keys into source control.

## Offline Path

Preferred storage model:

1. Download PMTiles or MapLibre offline packs to `FileSystemService.dir('maps')`.
2. Store region metadata in `map_regions`.
3. Store saved points in `map_markers`.
4. Store simple route drafts in `routes`.

When MapLibre is installed, replace `OfflineMapService.refreshRegion()` with `OfflineManager.createPack()` and persist native pack IDs in `offline_pack_id`.
