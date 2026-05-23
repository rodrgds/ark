# Map Tile Configuration

Ark's current Map tab stores planned regions, saved spots, route drafts, and validated manual bounds in SQLite. Native vector map rendering and offline pack downloads require a development build with MapLibre.

## Online Style URL

For the first native pass, use a style JSON from one of:

- MapTiler free tier: `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY`
- OpenMapTiles-hosted styles if available for the target deployment.

Set `EXPO_PUBLIC_ARK_MAP_STYLE_URL` for the default runtime style. Region-specific overrides are
stored in `map_regions.style_url`. Do not hardcode private API keys into source control.

The source fallback is `https://demotiles.maplibre.org/style.json`. Treat it as a development
preview only, not a production map source.

## Offline Path

Preferred storage model:

1. Download PMTiles or MapLibre offline packs to `FileSystemService.dir('maps')`.
2. Store region metadata in `map_regions`.
3. Store saved points in `map_markers`.
4. Store simple route drafts in `routes`.

`OfflineMapService.refreshRegion()` already calls `OfflineManager.createPack()` when MapLibre is
available and persists native pack IDs in `offline_pack_id`. Ark also searches saved spots, planned
regions, and route drafts offline. Remaining map work is on-device verification, production style
configuration, local PMTiles rendering, and a real offline geocoder/place index.
