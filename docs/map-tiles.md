# Map Tile Configuration

Ark's Map tab stores manifest-backed offline regions, saved emergency pins, route drafts, and validated manual bounds in SQLite. Native vector map rendering and offline pack downloads require a development build with MapLibre.

## Online Style URL

For the first native pass, use a style JSON from one of:

- MapTiler free tier: `https://api.maptiler.com/maps/streets/style.json?key=YOUR_KEY`
- OpenMapTiles-hosted styles if available for the target deployment.

Set `EXPO_PUBLIC_ARK_MAP_STYLE_URL` for the default runtime style. Region-specific overrides are
stored in `map_regions.style_url`. Do not hardcode private API keys into source control.

The source fallback is OpenFreeMap (`https://tiles.openfreemap.org/styles/liberty` for light,
`https://tiles.openfreemap.org/styles/dark` for dark/OLED). Treat public tile services as
development or early deployment sources until Ark has its own tile hosting contract or
self-hosted vector tile pipeline. The legacy MapLibre demo style is intentionally detected as a
demo source and should not be used as Ark's built-in default.

## Region Catalog

Ark loads a bundled fallback catalog from `assets/map-catalog.json`. Set
`EXPO_PUBLIC_ARK_MAP_CATALOG_URL` to fetch an updated catalog from an Ark-controlled server/CDN;
the last valid remote catalog is cached in SQLite so the map manager can still list regions
offline. Region rows persist manifest IDs, catalog version, data version, pack format, pack URL,
checksums, and estimated sizes so downloaded packs can later be refreshed when map data changes.
Remote catalogs can use the compact manifest shape from `src/types/maps.ts` (`id`, `name`,
`bbox`, `center`, `minZoom`, `maxZoom`, optional pack/checksum/version fields). Ark normalizes that
into the richer UI catalog shape locally, so server manifests do not need app-specific
`description`, `estimatedSize`, or `tags` fields.

## Offline Path

Preferred storage model:

1. Download PMTiles or MapLibre offline packs to `FileSystemService.dir('maps')`.
2. Store region metadata in `map_regions`.
3. Store saved points in `map_markers`.
4. Store simple route drafts in `routes`.

`OfflineMapService.refreshRegion()` calls `OfflineManager.createPack()` when MapLibre is available
and persists native pack IDs in `offline_pack_id`. PMTiles/MBTiles/vector-pack manifest rows are
accepted and preserved for the future self-hosted tile path, but this app version deliberately does
not treat those pack URLs as MapLibre native offline packs; download attempts fail with a clear
unsupported-pack message until a local pack renderer/importer exists. Ark also searches saved spots,
planned regions, and route drafts offline. Remaining map work is Android/iOS dev-build verification,
production style/source configuration, local PMTiles rendering, and a real offline geocoder/place
index.
